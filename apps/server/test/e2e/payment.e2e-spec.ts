import { createTestApp, resetDb, seedCatalog, signUp, SHIPPING, type TestApp } from './app';

describe('Payment: ownership, server-side amount, idempotency (e2e)', () => {
  let t: TestApp;
  let catalog: Awaited<ReturnType<typeof seedCatalog>>;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => t.close());
  beforeEach(async () => {
    await resetDb(t.prisma);
    t.payments.reset();
    catalog = await seedCatalog(t.prisma);
  });

  async function guestOrder(quantity = 2) {
    const guest = t.agent();
    await guest.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity }).expect(201);
    const res = await guest.post('/v1/orders').send({ ...SHIPPING, customerEmail: 'g@example.test' }).expect(201);
    return { order: res.body, token: res.body.accessToken as string };
  }

  const charge = (orderId: string, token?: string, extra: Record<string, unknown> = {}) => {
    const req = t.http().post('/v1/payment/charge');
    if (token) req.set('X-Order-Token', token);
    return req.send({ orderId, ...extra });
  };

  it('lets a guest pay with only the order cookie (after a page refresh)', async () => {
    const { order, token } = await guestOrder();
    const browser = t.agent();
    await browser.post(`/v1/orders/${order.id}/access`).send({ token }).expect(200);
    await t.http().post(`/v1/orders/${order.id}/pay`).expect(404);
    const res = await browser.post(`/v1/orders/${order.id}/pay`).expect(200);
    expect(res.body.success).toBe(true);
    const row = await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.status).toBe('CONFIRMED');
  });

  it('rejects a charge without ownership proof (404) and leaves the order pending', async () => {
    const { order } = await guestOrder();
    await charge(order.id).expect(404);
    await charge(order.id, 'A'.repeat(43)).expect(404);
    expect(t.payments.calls).toHaveLength(0);
    const row = await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.status).toBe('PENDING_PAYMENT');
  });

  it("rejects another user's charge, and admins cannot pay for others", async () => {
    const owner = await signUp(t);
    const other = await signUp(t);
    const admin = await signUp(t, { admin: true });
    await owner.agent.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 1 }).expect(201);
    const { body: order } = await owner.agent.post('/v1/orders').send(SHIPPING).expect(201);

    await other.agent.post('/v1/payment/charge').send({ orderId: order.id }).expect(404);
    await admin.agent.post('/v1/payment/charge').send({ orderId: order.id }).expect(404);
    expect(t.payments.calls).toHaveLength(0);

    const ok = await owner.agent.post('/v1/payment/charge').send({ orderId: order.id }).expect(200);
    expect(ok.body.status).toBe('CONFIRMED');
  });

  it('confirms with a valid guest token and records a successful attempt', async () => {
    const { order, token } = await guestOrder();
    const res = await charge(order.id, token).expect(200);
    expect(res.body).toMatchObject({ success: true, status: 'CONFIRMED', orderId: order.id });

    const row = await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.status).toBe('CONFIRMED');
    expect(row.paymentRef).toBe(res.body.transactionId);
    const attempts = await t.prisma.paymentAttempt.findMany({ where: { orderId: order.id } });
    expect(attempts).toHaveLength(1);
    expect(attempts[0].status).toBe('SUCCEEDED');
  });

  it('computes the amount server-side and ignores client amount/email/currency', async () => {
    const { order, token } = await guestOrder(2);
    await charge(order.id, token, { amount: 0.01, currency: 'USD', customerEmail: 'attacker@evil.test' }).expect(200);

    // 2 x 100 + 29.90 shipping (below free-shipping threshold)
    expect(t.payments.calls).toHaveLength(1);
    expect(t.payments.calls[0]).toMatchObject({
      amount: 229.9,
      currency: 'ILS',
      orderId: order.id,
      customerEmail: 'g@example.test',
    });
    const attempt = await t.prisma.paymentAttempt.findFirstOrThrow({ where: { orderId: order.id } });
    expect(Number(attempt.amount)).toBe(229.9);
  });

  it('is idempotent: a second charge does not hit the provider again', async () => {
    const { order, token } = await guestOrder();
    const first = await charge(order.id, token).expect(200);
    const second = await charge(order.id, token).expect(200);
    expect(second.body).toMatchObject({ success: true, alreadyPaid: true, transactionId: first.body.transactionId });
    expect(t.payments.calls).toHaveLength(1);
    expect(await t.prisma.paymentAttempt.count({ where: { orderId: order.id } })).toBe(1);
  });

  it('concurrent charges reach the provider exactly once', async () => {
    const { order, token } = await guestOrder();
    t.payments.delayMs = 150;
    const results = await Promise.all([charge(order.id, token), charge(order.id, token), charge(order.id, token)]);
    expect(t.payments.calls).toHaveLength(1);
    expect(results.filter((r) => r.status === 200 && !r.body.alreadyPaid)).toHaveLength(1);
    for (const r of results) expect([200, 409]).toContain(r.status);
    expect(await t.prisma.paymentAttempt.count({ where: { orderId: order.id } })).toBe(1);
  });

  it('a declined payment returns 402, records FAILED, and can be retried', async () => {
    const { order, token } = await guestOrder();
    t.payments.nextResult = { success: false, transactionId: '', error: 'card_declined' };
    await charge(order.id, token).expect(402);
    let row = await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.status).toBe('PENDING_PAYMENT');
    expect(row.paymentClaimedAt).toBeNull();

    await charge(order.id, token).expect(200);
    row = await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.status).toBe('CONFIRMED');
    const statuses = (await t.prisma.paymentAttempt.findMany({ where: { orderId: order.id }, orderBy: { createdAt: 'asc' } })).map(
      (a) => a.status,
    );
    expect(statuses).toEqual(['FAILED', 'SUCCEEDED']);
  });

  it('refuses to charge a cancelled order', async () => {
    const { order, token } = await guestOrder();
    await t.prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });
    await charge(order.id, token).expect(409);
    expect(t.payments.calls).toHaveLength(0);
  });

  it('the webhook endpoint is disabled (404) when no verifier is configured', async () => {
    await t.http().post('/v1/payment/webhook').send({}).expect(404);
  });

  it('rate-limits charge attempts per IP', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) statuses.push((await charge('missing-order')).status);
    expect(statuses.slice(0, 10).every((s) => s === 404)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
  });
});
