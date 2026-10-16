import { createTestApp, ORIGIN, resetDb, signUp, type TestApp } from './app';

const PASSWORD = 'Sup3r-secret-password!';

/** The account page relies on better-auth's own update-user and change-password endpoints. */
describe('Account profile & password (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => t.close());
  beforeEach(async () => resetDb(t.prisma));

  it('update-user changes the name but never the role or email', async () => {
    const a = await signUp(t);
    await a.agent
      .post('/api/auth/update-user')
      .set('Origin', ORIGIN)
      .send({ name: 'Noa Cohen', role: 'ADMIN', email: 'evil@example.test' })
      .expect((res) => expect([200, 400]).toContain(res.status));
    const user = await t.prisma.user.findUniqueOrThrow({ where: { id: a.user.id } });
    expect(user.role).toBe('CUSTOMER');
    expect(user.email).toBe(a.email);

    await a.agent.post('/api/auth/update-user').set('Origin', ORIGIN).send({ name: 'Noa Cohen' }).expect(200);
    expect((await t.prisma.user.findUniqueOrThrow({ where: { id: a.user.id } })).name).toBe('Noa Cohen');
  });

  it('change-password needs the current password and revokes other sessions', async () => {
    const a = await signUp(t);
    // A second device signed in to the same account.
    const other = t.agent();
    await other.post('/api/auth/sign-in/email').set('Origin', ORIGIN).send({ email: a.email, password: PASSWORD }).expect(200);
    expect(await t.prisma.session.count({ where: { userId: a.user.id } })).toBe(2);

    await a.agent
      .post('/api/auth/change-password')
      .set('Origin', ORIGIN)
      .send({ currentPassword: 'wrong-password', newPassword: 'N3w-password-123' })
      .expect(400);

    await a.agent
      .post('/api/auth/change-password')
      .set('Origin', ORIGIN)
      .send({ currentPassword: PASSWORD, newPassword: 'N3w-password-123', revokeOtherSessions: true })
      .expect(200);

    // Only the session that changed the password survives (better-auth issues it a fresh one).
    expect(await t.prisma.session.count({ where: { userId: a.user.id } })).toBe(1);
    await a.agent.get('/v1/addresses').expect(200);

    await t
      .http()
      .post('/api/auth/sign-in/email')
      .set('Origin', ORIGIN)
      .send({ email: a.email, password: PASSWORD })
      .expect(401);
    await t
      .http()
      .post('/api/auth/sign-in/email')
      .set('Origin', ORIGIN)
      .send({ email: a.email, password: 'N3w-password-123' })
      .expect(200);
  });
});
