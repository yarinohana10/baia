import { createTestApp, resetDb, signUp, type TestApp } from './app';

describe('Newsletter & marketing consent (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => t.close());
  beforeEach(async () => resetDb(t.prisma));

  it('requires explicit consent to subscribe', async () => {
    await t.http().post('/v1/newsletter/subscribe').send({ email: 'a@example.com' }).expect(400);
    await t.http().post('/v1/newsletter/subscribe').send({ email: 'a@example.com', consent: false }).expect(400);
    await t.http().post('/v1/newsletter/subscribe').send({ email: 'a@example.com', consent: 'yes' }).expect(400);
    await t.http().post('/v1/newsletter/subscribe').send({ email: 'bad', consent: true }).expect(400);
    expect(await t.prisma.newsletterSubscriber.count()).toBe(0);
  });

  it('subscribes idempotently, unsubscribes and re-subscribes', async () => {
    const body = { email: ' Dana@Example.com ', consent: true, locale: 'en', source: 'footer' };
    const res = await t.http().post('/v1/newsletter/subscribe').send(body).expect(200);
    expect(res.body).toEqual({ subscribed: true });
    await t.http().post('/v1/newsletter/subscribe').send(body).expect(200);

    let rows = await t.prisma.newsletterSubscriber.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ email: 'dana@example.com', locale: 'en', source: 'footer', unsubscribedAt: null });

    await t.http().post('/v1/newsletter/unsubscribe').send({ email: 'dana@example.com' }).expect(200);
    rows = await t.prisma.newsletterSubscriber.findMany();
    expect(rows[0].unsubscribedAt).not.toBeNull();

    // Unknown addresses get the same answer (no enumeration).
    const unknown = await t.http().post('/v1/newsletter/unsubscribe').send({ email: 'nobody@example.com' }).expect(200);
    expect(unknown.body).toEqual({ ok: true });

    await t.http().post('/v1/newsletter/subscribe').send({ ...body, source: 'checkout' }).expect(200);
    rows = await t.prisma.newsletterSubscriber.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].unsubscribedAt).toBeNull();
    expect(rows[0].source).toBe('footer');
  });

  it('manages the signed-in user’s consent', async () => {
    await t.http().get('/v1/newsletter/me').expect(401);
    await t.http().put('/v1/newsletter/me').send({ consent: true }).expect(401);

    const u = await signUp(t);
    const initial = await u.agent.get('/v1/newsletter/me').expect(200);
    expect(initial.body).toMatchObject({ marketingConsent: false });

    const on = await u.agent.put('/v1/newsletter/me').send({ consent: true, source: 'register', locale: 'he' }).expect(200);
    expect(on.body.marketingConsent).toBe(true);
    expect(on.body.marketingConsentAt).toBeTruthy();
    const sub = await t.prisma.newsletterSubscriber.findUniqueOrThrow({ where: { email: u.email } });
    expect(sub).toMatchObject({ source: 'register', unsubscribedAt: null });

    const off = await u.agent.put('/v1/newsletter/me').send({ consent: false }).expect(200);
    expect(off.body.marketingConsent).toBe(false);
    const after = await t.prisma.newsletterSubscriber.findUniqueOrThrow({ where: { email: u.email } });
    expect(after.unsubscribedAt).not.toBeNull();

    await u.agent.put('/v1/newsletter/me').send({ consent: 'yes' }).expect(400);
  });

  it('keeps the account flag in sync with public subscribe/unsubscribe', async () => {
    const u = await signUp(t);
    await t.http().post('/v1/newsletter/subscribe').send({ email: u.email, consent: true }).expect(200);
    expect((await u.agent.get('/v1/newsletter/me').expect(200)).body.marketingConsent).toBe(true);
    await t.http().post('/v1/newsletter/unsubscribe').send({ email: u.email }).expect(200);
    expect((await u.agent.get('/v1/newsletter/me').expect(200)).body.marketingConsent).toBe(false);
  });

  it('lists, filters and exports subscribers for admins', async () => {
    const customer = await signUp(t);
    const admin = await signUp(t, { admin: true });
    await t.http().get('/v1/admin/newsletter').expect(401);
    await customer.agent.get('/v1/admin/newsletter').expect(403);
    await customer.agent.get('/v1/admin/newsletter/export.csv').expect(403);

    await t.http().post('/v1/newsletter/subscribe').send({ email: 'one@example.com', consent: true }).expect(200);
    await t.http().post('/v1/newsletter/subscribe').send({ email: '=cmd@example.com', consent: true }).expect(200);
    await t.http().post('/v1/newsletter/subscribe').send({ email: 'left@example.com', consent: true }).expect(200);
    await t.http().post('/v1/newsletter/unsubscribe').send({ email: 'left@example.com' }).expect(200);

    const all = await admin.agent.get('/v1/admin/newsletter').expect(200);
    expect(all.body).toMatchObject({ total: 3, activeCount: 2 });

    const active = await admin.agent.get('/v1/admin/newsletter?active=true').expect(200);
    expect(active.body.total).toBe(2);

    const search = await admin.agent.get('/v1/admin/newsletter?search=ONE%40').expect(200);
    expect(search.body.subscribers.map((s: { email: string }) => s.email)).toEqual(['one@example.com']);

    const csv = await admin.agent.get('/v1/admin/newsletter/export.csv?active=true').expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.headers['content-disposition']).toContain('attachment');
    expect(csv.text.charCodeAt(0)).toBe(0xfeff);
    expect(csv.text).toContain('"one@example.com"');
    expect(csv.text).toContain(`"'=cmd@example.com"`);
    expect(csv.text).not.toContain('left@example.com');
  });

  it('rate limits public subscribe', async () => {
    for (let i = 0; i < 10; i += 1) {
      await t.http().post('/v1/newsletter/subscribe').send({ email: `r${i}@example.com`, consent: true }).expect(200);
    }
    await t.http().post('/v1/newsletter/subscribe').send({ email: 'r11@example.com', consent: true }).expect(429);
  });
});
