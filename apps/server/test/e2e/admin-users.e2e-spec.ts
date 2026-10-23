import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { ORIGIN, resetDb } from './app';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { EmailModule } from '../../src/email/email.module';
import { AuthModule } from '../../src/auth/auth.module';
import { AdminUsersModule } from '../../src/admin-users/admin-users.module';
import { authRouter } from '../../src/auth/auth.router';
import { captureEmails, settledEmails, waitForEmail } from './mail';
import { OwnerBootstrapService } from '../../src/admin-users/owner-bootstrap.service';

const PASSWORD = 'Sup3r-secret-password!';
const OWNER = 'owner@example.test';

// Only the modules under test: independent of the rest of the app.
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), PrismaModule, EmailModule, AuthModule, AdminUsersModule],
})
class AdminE2eModule {}

async function createApp() {
  const moduleRef = await Test.createTestingModule({ imports: [AdminE2eModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true, logger: false });
  app.use(authRouter);
  app.setGlobalPrefix('v1');
  await app.init();
  const server = app.getHttpServer();
  return {
    app,
    prisma: app.get(PrismaService),
    http: () => request(server),
    agent: () => request.agent(server),
    close: () => app.close(),
  };
}
type TestApp = Awaited<ReturnType<typeof createApp>>;

/**
 * Admin management: Owner pinning, Admin Invitations, Order Claim.
 * Real better-auth sign-up / email verification / sessions on a real DB.
 */
describe('Admin users, Owner, invitations & Order Claim (e2e)', () => {
  let t: TestApp;
  let mail: ReturnType<typeof captureEmails>;

  beforeAll(async () => {
    process.env.OWNER_EMAIL = OWNER;
    t = await createApp();
    mail = captureEmails(t);
  });
  afterAll(async () => t.close());
  beforeEach(async () => {
    await resetDb(t.prisma);
    mail.sent.length = 0;
  });

  /** Registers via the real endpoint; returns an agent with the session cookie. */
  async function register(email: string, name = 'Test User') {
    const agent = t.agent();
    const res = await agent.post('/api/auth/sign-up/email').set('Origin', ORIGIN).send({ email, password: PASSWORD, name });
    if (res.status !== 200) throw new Error(`sign-up failed: ${res.status} ${JSON.stringify(res.body)}`);
    return agent;
  }

  /** Completes email verification through the link in the verification email. */
  async function verify(email: string) {
    const msg = await waitForEmail(mail, (m) => m.to === email && /verify-email\?token=/.test(m.text));
    const token = decodeURIComponent(/verify-email\?token=([^\s"&<)]+)/.exec(msg.text)![1]);
    await t.http().get(`/api/auth/verify-email?token=${encodeURIComponent(token)}`).set('Origin', ORIGIN).expect((r) => expect(r.status).toBeLessThan(400));
  }

  async function signIn(email: string) {
    const agent = t.agent();
    await agent.post('/api/auth/sign-in/email').set('Origin', ORIGIN).send({ email, password: PASSWORD }).expect(200);
    return agent;
  }

  const roleOf = async (email: string) => (await t.prisma.user.findUniqueOrThrow({ where: { email } })).role;

  /** Owner registered + verified + promoted, with a fresh session. */
  async function ownerAgent() {
    await register(OWNER, 'Owner');
    await verify(OWNER);
    return signIn(OWNER);
  }

  let orderSeq = 0;
  function guestOrder(customerEmail: string) {
    orderSeq += 1;
    return t.prisma.order.create({
      data: {
        orderNumber: `T-${Date.now()}-${orderSeq}`,
        customerEmail,
        subtotal: 100,
        shippingCost: 0,
        total: 100,
        shippingCity: 'Tel Aviv',
        shippingStreet: 'Dizengoff',
        shippingNumber: '1',
      },
    });
  }

  describe('Owner', () => {
    it('is promoted when the email is verified, never before', async () => {
      await register(OWNER, 'Owner');
      expect(await roleOf(OWNER)).toBe('CUSTOMER');

      // Boot while unverified: still nothing.
      await t.app.get(OwnerBootstrapService).onApplicationBootstrap();
      expect(await roleOf(OWNER)).toBe('CUSTOMER');

      await verify(OWNER);
      expect(await roleOf(OWNER)).toBe('ADMIN');
    });

    it('is re-promoted by the boot step if the role was lost, without touching anyone else', async () => {
      const owner = await ownerAgent();
      const other = 'other-admin@example.test';
      await register(other);
      await t.prisma.user.update({ where: { email: other }, data: { emailVerified: true, role: 'ADMIN' } });
      await t.prisma.user.update({ where: { email: OWNER }, data: { role: 'CUSTOMER' } });

      await t.app.get(OwnerBootstrapService).onApplicationBootstrap();

      expect(await roleOf(OWNER)).toBe('ADMIN');
      expect(await roleOf(other)).toBe('ADMIN');
      void owner;
    });

    it('an admin added from the screen survives re-running the boot ("deploy") step; boot never demotes', async () => {
      const owner = await ownerAgent();
      const friend = 'friend@example.test';
      await register(friend);
      await verify(friend);

      await owner.post('/v1/admin/users').send({ email: friend }).expect(201);
      expect(await roleOf(friend)).toBe('ADMIN');

      for (let i = 0; i < 2; i++) await t.app.get(OwnerBootstrapService).onApplicationBootstrap();
      expect(await roleOf(friend)).toBe('ADMIN');
      expect(await roleOf(OWNER)).toBe('ADMIN');
    });

    it('matches OWNER_EMAIL case-insensitively', async () => {
      await register('OWNER@Example.Test', 'Owner');
      await verify('owner@example.test');
      expect(await roleOf('owner@example.test')).toBe('ADMIN');
    });
  });

  describe('admin API permissions', () => {
    it('lists admins/invitations for any admin but only the Owner can change them', async () => {
      const owner = await ownerAgent();
      const second = 'second@example.test';
      await register(second);
      await verify(second);
      await owner.post('/v1/admin/users').send({ email: second }).expect(201);
      const secondAgent = await signIn(second);

      const asOwner = await owner.get('/v1/admin/users').expect(200);
      expect(asOwner.body.canManage).toBe(true);
      expect(asOwner.body.admins.map((a: any) => [a.email, a.isOwner])).toEqual([
        [OWNER, true],
        [second, false],
      ]);

      const asAdmin = await secondAgent.get('/v1/admin/users').expect(200);
      expect(asAdmin.body.canManage).toBe(false);

      const target = await t.prisma.user.findUniqueOrThrow({ where: { email: second } });
      await secondAgent.post('/v1/admin/users').send({ email: 'x@example.test' }).expect(403);
      await secondAgent.delete(`/v1/admin/users/${target.id}`).expect(403);
      await secondAgent.delete('/v1/admin/users/invitations/whatever').expect(403);
      expect(await roleOf(second)).toBe('ADMIN');
      expect(await t.prisma.adminInvitation.count()).toBe(0);
    });

    it('rejects customers and anonymous callers', async () => {
      await t.http().get('/v1/admin/users').expect(401);
      const customer = await register('cust@example.test');
      await customer.get('/v1/admin/users').expect(403);
      await customer.post('/v1/admin/users').send({ email: 'a@example.test' }).expect(403);
    });

    it('cannot set a password through the API (field is ignored; no user is created)', async () => {
      const owner = await ownerAgent();
      const res = await owner.post('/v1/admin/users').send({ email: 'ghost@example.test', password: 'Password-123456' }).expect(201);
      expect(res.body.action).toBe('invited');
      expect(await t.prisma.user.count({ where: { email: 'ghost@example.test' } })).toBe(0);
    });
  });

  describe('Admin Invitation', () => {
    it('is created for an email without an account, is idempotent, and sends the invitation email (he default, en on request)', async () => {
      const owner = await ownerAgent();
      mail.sent.length = 0;

      const first = await owner.post('/v1/admin/users').send({ email: ' New.Admin@Example.test ' }).expect(201);
      expect(first.body).toMatchObject({ action: 'invited', email: 'new.admin@example.test' });
      await owner.post('/v1/admin/users').set('x-locale', 'en').send({ email: 'new.admin@example.test' }).expect(201);
      expect(await t.prisma.adminInvitation.count()).toBe(1);

      const sent = (await settledEmails(mail)).filter((m) => m.to === 'new.admin@example.test');
      expect(sent).toHaveLength(2);
      expect(sent[0].html).toContain('dir="rtl"');
      expect(sent[0].text).toContain('/he/register');
      expect(sent[1].text).toContain('/en/register');

      const list = await owner.get('/v1/admin/users').expect(200);
      expect(list.body.invitations).toMatchObject([{ email: 'new.admin@example.test', invitedByEmail: OWNER }]);
    });

    it('applies on registration + verification, and is consumed', async () => {
      const owner = await ownerAgent();
      const invitee = 'invitee@example.test';
      await owner.post('/v1/admin/users').send({ email: invitee }).expect(201);

      await register(invitee);
      expect(await roleOf(invitee)).toBe('CUSTOMER'); // registered but not verified yet
      await verify(invitee);

      expect(await roleOf(invitee)).toBe('ADMIN');
      expect(await t.prisma.adminInvitation.count()).toBe(0);
    });

    it('an unverified account with an invited email gets nothing, even after signing in', async () => {
      const owner = await ownerAgent();
      const invitee = 'unverified@example.test';
      await owner.post('/v1/admin/users').send({ email: invitee }).expect(201);
      await register(invitee);
      await signIn(invitee);

      expect(await roleOf(invitee)).toBe('CUSTOMER');
      expect(await t.prisma.adminInvitation.count()).toBe(1);
      // Adding an existing but unverified account also only creates an invitation.
      const again = await owner.post('/v1/admin/users').send({ email: invitee }).expect(201);
      expect(again.body.action).toBe('invited');
      expect(await roleOf(invitee)).toBe('CUSTOMER');
    });

    it('adding an already verified account promotes it immediately (no invitation)', async () => {
      const owner = await ownerAgent();
      const user = 'verified@example.test';
      await register(user);
      await verify(user);
      const res = await owner.post('/v1/admin/users').send({ email: user }).expect(201);
      expect(res.body.action).toBe('promoted');
      expect(await t.prisma.adminInvitation.count()).toBe(0);
      const again = await owner.post('/v1/admin/users').send({ email: user }).expect(201);
      expect(again.body.action).toBe('already-admin');
    });

    it('can be revoked, after which verifying grants nothing', async () => {
      const owner = await ownerAgent();
      const invitee = 'revoked@example.test';
      await owner.post('/v1/admin/users').send({ email: invitee }).expect(201);
      const inv = await t.prisma.adminInvitation.findFirstOrThrow();
      await owner.delete(`/v1/admin/users/invitations/${inv.id}`).expect(200);
      await owner.delete(`/v1/admin/users/invitations/${inv.id}`).expect(404);

      await register(invitee);
      await verify(invitee);
      expect(await roleOf(invitee)).toBe('CUSTOMER');
    });
  });

  describe('removing admins', () => {
    it('demotes to CUSTOMER, keeps the account and revokes sessions immediately', async () => {
      const owner = await ownerAgent();
      const victim = 'victim@example.test';
      await register(victim);
      await verify(victim);
      await owner.post('/v1/admin/users').send({ email: victim }).expect(201);
      const victimAgent = await signIn(victim);
      await victimAgent.get('/v1/admin/users').expect(200);

      const user = await t.prisma.user.findUniqueOrThrow({ where: { email: victim } });
      expect(await t.prisma.session.count({ where: { userId: user.id } })).toBeGreaterThan(0);
      await owner.delete(`/v1/admin/users/${user.id}`).expect(200);

      expect(await roleOf(victim)).toBe('CUSTOMER');
      expect(await t.prisma.session.count({ where: { userId: user.id } })).toBe(0);
      await victimAgent.get('/v1/admin/users').expect(401);
    });

    it('never removes the Owner, and 404s for unknown users / 400 for non-admins', async () => {
      const owner = await ownerAgent();
      const ownerRow = await t.prisma.user.findUniqueOrThrow({ where: { email: OWNER } });
      await owner.delete(`/v1/admin/users/${ownerRow.id}`).expect(403);
      expect(await roleOf(OWNER)).toBe('ADMIN');

      await owner.delete('/v1/admin/users/nope').expect(404);
      await register('plain@example.test');
      const plain = await t.prisma.user.findUniqueOrThrow({ where: { email: 'plain@example.test' } });
      await owner.delete(`/v1/admin/users/${plain.id}`).expect(400);
    });
  });

  describe('Order Claim', () => {
    it('attaches guest orders only after verification, case-insensitively, changing only userId', async () => {
      const email = 'shopper@example.test';
      const mixed = await guestOrder('Shopper@Example.TEST');
      const other = await guestOrder('someone-else@example.test');
      const alreadyOwned = await register('owner-of-order@example.test');
      void alreadyOwned;
      const taken = await guestOrder(email);
      const takenBy = await t.prisma.user.findUniqueOrThrow({ where: { email: 'owner-of-order@example.test' } });
      await t.prisma.order.update({ where: { id: taken.id }, data: { userId: takenBy.id } });

      await register(email);
      await signIn(email); // unverified sign-in claims nothing
      expect((await t.prisma.order.findUniqueOrThrow({ where: { id: mixed.id } })).userId).toBeNull();

      await verify(email);
      const me = await t.prisma.user.findUniqueOrThrow({ where: { email } });
      const claimed = await t.prisma.order.findUniqueOrThrow({ where: { id: mixed.id } });
      expect(claimed.userId).toBe(me.id);
      expect({ ...claimed, userId: null }).toEqual({ ...mixed, userId: null }); // nothing else (not even updatedAt) changed
      expect((await t.prisma.order.findUniqueOrThrow({ where: { id: other.id } })).userId).toBeNull();
      expect((await t.prisma.order.findUniqueOrThrow({ where: { id: taken.id } })).userId).toBe(takenBy.id);

      // Orders placed later while logged out are picked up on the next sign-in.
      const later = await guestOrder(email);
      await signIn(email);
      expect((await t.prisma.order.findUniqueOrThrow({ where: { id: later.id } })).userId).toBe(me.id);
    });
  });
});
