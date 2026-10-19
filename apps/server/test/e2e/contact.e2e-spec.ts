import { EmailService } from '../../src/email/email.service';
import { MemoryEmailTransport } from '../../src/email/transports/console.transport';
import { createTestApp, resetDb, signUp, type TestApp } from './app';

const flush = () => new Promise((resolve) => setTimeout(resolve, 50));

const MESSAGE = {
  name: 'Dana Levi',
  email: 'Dana@Example.com',
  phone: '050-1234567',
  orderNumber: 'BA-1001',
  subject: 'Size question',
  message: 'Hi!\nDoes the Aria one-piece run small?',
  locale: 'en',
};

describe('Contact form (e2e)', () => {
  let t: TestApp;
  const mail = new MemoryEmailTransport();

  beforeAll(async () => {
    t = await createTestApp();
    t.app.get(EmailService).setTransport(mail);
  });
  afterAll(async () => t.close());
  beforeEach(async () => {
    await resetDb(t.prisma);
    mail.clear();
    delete process.env.ADMIN_NOTIFY_EMAIL;
  });

  it('stores the message, notifies the store (reply-to = customer) and auto-replies', async () => {
    await t.prisma.siteConfig.create({ data: { id: 'default', contactEmail: 'shop@baia.test' } });

    const res = await t.http().post('/v1/contact').send(MESSAGE).expect(201);
    expect(res.body).toEqual({ ok: true });
    await flush();

    const rows = await t.prisma.contactMessage.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: 'Dana Levi',
      email: 'dana@example.com',
      orderNumber: 'BA-1001',
      locale: 'en',
      status: 'NEW',
    });

    const toStore = mail.sent.find((m) => m.to === 'shop@baia.test');
    expect(toStore).toBeDefined();
    expect(toStore!.replyTo).toBe('dana@example.com');
    expect(toStore!.subject).toContain('Dana Levi');
    expect(toStore!.html).toContain('BA-1001');

    const autoReply = mail.sent.find((m) => m.to === 'dana@example.com');
    expect(autoReply?.subject).toBe('We received your message - BAIA');
  });

  it('falls back to ADMIN_NOTIFY_EMAIL when there is no site config row', async () => {
    process.env.ADMIN_NOTIFY_EMAIL = 'owner@baia.test';
    await t.http().post('/v1/contact').send({ name: 'נועה', email: 'noa@example.com', message: 'שלום' }).expect(201);
    await flush();
    expect(mail.sent.map((m) => m.to).sort()).toEqual(['noa@example.com', 'owner@baia.test']);
    const reply = mail.sent.find((m) => m.to === 'noa@example.com');
    expect(reply?.subject).toBe('קיבלנו את פנייתך - BAIA');
  });

  it('validates input', async () => {
    const res = await t.http().post('/v1/contact').send({ name: '', email: 'nope', message: '' }).expect(400);
    const fields = (res.body.errors as { field: string }[]).map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'email', 'message']));
    await t.http().post('/v1/contact').send({ ...MESSAGE, phone: 'abc' }).expect(400);
    await t.http().post('/v1/contact').send({ ...MESSAGE, locale: 'fr' }).expect(400);
    expect(await t.prisma.contactMessage.count()).toBe(0);
  });

  it('silently drops honeypot submissions', async () => {
    await t.http().post('/v1/contact').send({ ...MESSAGE, website: 'http://spam.example' }).expect(201);
    await flush();
    expect(await t.prisma.contactMessage.count()).toBe(0);
    expect(mail.sent).toHaveLength(0);
  });

  it('rate limits submissions per IP', async () => {
    for (let i = 0; i < 5; i += 1) await t.http().post('/v1/contact').send(MESSAGE).expect(201);
    await t.http().post('/v1/contact').send(MESSAGE).expect(429);
  });

  it('lets admins list, count, search and mark messages handled', async () => {
    const customer = await signUp(t);
    const admin = await signUp(t, { admin: true });
    await t.http().get('/v1/admin/contact-messages').expect(401);
    await customer.agent.get('/v1/admin/contact-messages').expect(403);

    await t.http().post('/v1/contact').send({ ...MESSAGE, name: 'First' }).expect(201);
    await t.http().post('/v1/contact').send({ ...MESSAGE, name: 'Second', orderNumber: 'BA-2002' }).expect(201);

    const list = await admin.agent.get('/v1/admin/contact-messages').expect(200);
    expect(list.body).toMatchObject({ total: 2, newCount: 2, page: 1 });
    expect(list.body.messages[0].name).toBe('Second');

    const first = list.body.messages.find((m: { name: string }) => m.name === 'First');
    const updated = await admin.agent
      .put(`/v1/admin/contact-messages/${first.id}`)
      .send({ status: 'HANDLED' })
      .expect(200);
    expect(updated.body.status).toBe('HANDLED');
    await admin.agent.put(`/v1/admin/contact-messages/${first.id}`).send({ status: 'NOPE' }).expect(400);
    await admin.agent.put('/v1/admin/contact-messages/missing').send({ status: 'HANDLED' }).expect(404);

    const count = await admin.agent.get('/v1/admin/contact-messages/count?status=NEW').expect(200);
    expect(count.body).toEqual({ count: 1 });

    const handled = await admin.agent.get('/v1/admin/contact-messages?status=HANDLED').expect(200);
    expect(handled.body.messages.map((m: { name: string }) => m.name)).toEqual(['First']);

    const search = await admin.agent.get('/v1/admin/contact-messages?search=BA-2002').expect(200);
    expect(search.body.messages.map((m: { name: string }) => m.name)).toEqual(['Second']);

    // NEW first, then HANDLED.
    const all = await admin.agent.get('/v1/admin/contact-messages').expect(200);
    expect(all.body.messages.map((m: { status: string }) => m.status)).toEqual(['NEW', 'HANDLED']);
  });
});
