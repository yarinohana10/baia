import { createTestApp, resetDb, seedCatalog, SHIPPING, type TestApp } from './app';

/**
 * PAYMENTS_ENABLED=false (the production default until a real provider
 * exists): the store stays browsable and the cart usable, but the SERVER
 * refuses order creation and every payment endpoint.
 */
describe('Payments flag (e2e)', () => {
  let t: TestApp;
  let catalog: Awaited<ReturnType<typeof seedCatalog>>;
  const saved = { enabled: process.env.PAYMENTS_ENABLED, env: process.env.NODE_ENV };

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => t.close());
  beforeEach(async () => {
    await resetDb(t.prisma);
    t.payments.reset();
    catalog = await seedCatalog(t.prisma);
  });
  afterEach(() => {
    if (saved.enabled === undefined) delete process.env.PAYMENTS_ENABLED;
    else process.env.PAYMENTS_ENABLED = saved.enabled;
    process.env.NODE_ENV = saved.env;
  });

  /** An order created while payments were on, so the pay endpoints have something to refuse. */
  async function pendingOrder() {
    const guest = t.agent();
    await guest.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 1 }).expect(201);
    const res = await guest.post('/v1/orders').send({ ...SHIPPING, customerEmail: 'flag@example.test' }).expect(201);
    return { order: res.body, token: res.body.accessToken as string };
  }

  it('is on by default outside production and reported by the public config', async () => {
    delete process.env.PAYMENTS_ENABLED;
    const res = await t.http().get('/v1/payment/config').expect(200);
    expect(res.body).toMatchObject({ enabled: true, provider: 'spy' });
  });

  it('is off by default in production, and an explicit value wins either way', async () => {
    delete process.env.PAYMENTS_ENABLED;
    process.env.NODE_ENV = 'production';
    expect((await t.http().get('/v1/payment/config').expect(200)).body.enabled).toBe(false);
    process.env.PAYMENTS_ENABLED = 'true';
    expect((await t.http().get('/v1/payment/config').expect(200)).body.enabled).toBe(true);
    process.env.NODE_ENV = 'test';
    process.env.PAYMENTS_ENABLED = 'false';
    expect((await t.http().get('/v1/payment/config').expect(200)).body.enabled).toBe(false);
  });

  it('flag off: POST /orders is refused with 403 PAYMENTS_DISABLED and nothing is created', async () => {
    const guest = t.agent();
    await guest.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 1 }).expect(201);
    process.env.PAYMENTS_ENABLED = 'false';
    const res = await guest.post('/v1/orders').send({ ...SHIPPING, customerEmail: 'flag@example.test' }).expect(403);
    expect(res.body.code).toBe('PAYMENTS_DISABLED');
    expect(await t.prisma.order.count()).toBe(0);
    expect((await t.prisma.productVariant.findUniqueOrThrow({ where: { id: catalog.inStock.id } })).stockQuantity).toBe(5);

    // The cart is untouched and still usable; turning the flag on lets the same cart check out.
    const cart = await guest.get('/v1/cart').expect(200);
    expect(cart.body.items).toHaveLength(1);
    await guest.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 1 }).expect(201);
    process.env.PAYMENTS_ENABLED = 'true';
    await guest.post('/v1/orders').send({ ...SHIPPING, customerEmail: 'flag@example.test' }).expect(201);
  });

  it('flag off: every payment endpoint answers 403, even with a valid order and token', async () => {
    const { order, token } = await pendingOrder();
    process.env.PAYMENTS_ENABLED = 'false';
    for (const call of [
      () => t.http().post('/v1/payment/charge').set('X-Order-Token', token).send({ orderId: order.id }),
      () => t.http().post(`/v1/orders/${order.id}/pay`).set('X-Order-Token', token).send({}),
      () => t.http().post('/v1/payment/webhook').send({}),
    ]) {
      const res = await call();
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('PAYMENTS_DISABLED');
    }
    expect(t.payments.calls).toHaveLength(0);
    expect((await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PENDING_PAYMENT');

    // Reading config, browsing and looking at an existing order keep working.
    await t.http().get('/v1/payment/config').expect(200);
    await t.http().get(`/v1/orders/${order.id}`).set('X-Order-Token', token).expect(200);
    await t.http().get('/v1/checkout/quote').expect(200);
  });

  it('flag on: payment works again', async () => {
    const { order, token } = await pendingOrder();
    process.env.PAYMENTS_ENABLED = 'false';
    await t.http().post('/v1/payment/charge').set('X-Order-Token', token).send({ orderId: order.id }).expect(403);
    process.env.PAYMENTS_ENABLED = 'true';
    await t.http().post('/v1/payment/charge').set('X-Order-Token', token).send({ orderId: order.id }).expect(200);
  });
});
