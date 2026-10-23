import { createTestApp, resetDb, seedCatalog, signUp, SHIPPING, type TestApp } from './app';
import { MockPaymentProvider } from '../../src/payment/mock-payment.provider';
import type { PaymentChargeParams } from '../../src/payment/payment.interface';

/**
 * The mock hosted payment page: test cards (`simulation`), stored payment
 * details, and the PCI boundary (card data never accepted or stored).
 */
describe('Payment: mock hosted page simulation and payment details (e2e)', () => {
  let t: TestApp;
  let catalog: Awaited<ReturnType<typeof seedCatalog>>;
  const mock = new MockPaymentProvider();

  /** Turns the spy into a test-mode provider that behaves like the real mock. */
  function useMockBehaviour() {
    Object.defineProperty(t.payments, 'testMode', { value: true, configurable: true, writable: true });
    jest.spyOn(t.payments, 'charge').mockImplementation(async (params: PaymentChargeParams) => {
      t.payments.calls.push(params);
      return mock.charge(params);
    });
  }

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => t.close());
  beforeEach(async () => {
    await resetDb(t.prisma);
    t.payments.reset();
    jest.restoreAllMocks();
    delete (t.payments as { testMode?: boolean }).testMode;
    catalog = await seedCatalog(t.prisma);
  });

  async function guestOrder(quantity = 1) {
    const guest = t.agent();
    await guest.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity }).expect(201);
    const res = await guest.post('/v1/orders').send({ ...SHIPPING, customerEmail: 'g@example.test' }).expect(201);
    // A browser that exchanged the token for the order cookie (payment page refresh).
    const browser = t.agent();
    await browser.post(`/v1/orders/${res.body.id}/access`).send({ token: res.body.accessToken }).expect(200);
    return { order: res.body as { id: string; total: string }, token: res.body.accessToken as string, browser };
  }

  const pay = (browser: ReturnType<TestApp['agent']>, orderId: string, body: Record<string, unknown>) =>
    browser.post(`/v1/orders/${orderId}/pay`).send(body);

  it('GET /payment/config exposes the provider and test mode (no secrets)', async () => {
    let res = await t.http().get('/v1/payment/config').expect(200);
    expect(res.body).toEqual({
      enabled: true,
      provider: 'spy',
      testMode: false,
      methods: ['card', 'bit', 'apple_pay'],
      installments: { max: 12, minTotal: 300 },
    });
    useMockBehaviour();
    res = await t.http().get('/v1/payment/config').expect(200);
    expect(res.body.testMode).toBe(true);
  });

  it('declined test card -> 402 with a reason, FAILED attempt, order stays pending and can be retried', async () => {
    useMockBehaviour();
    const { order, browser } = await guestOrder();

    const declined = await pay(browser, order.id, {
      method: 'card',
      simulation: 'decline',
      cardBrand: 'visa',
      cardLast4: '0002',
      installments: 1,
    }).expect(402);
    expect(declined.body.declineCode).toBe('card_declined');

    const poor = await pay(browser, order.id, { method: 'card', simulation: 'insufficient_funds', cardBrand: 'visa', cardLast4: '9995' }).expect(402);
    expect(poor.body.declineCode).toBe('insufficient_funds');

    let row = await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.status).toBe('PENDING_PAYMENT');
    expect(row.paymentClaimedAt).toBeNull();
    expect(row.paymentMethod).toBeNull();
    expect(row.cardLast4).toBeNull();

    // Retry with another method.
    await pay(browser, order.id, { method: 'bit', simulation: 'success' }).expect(200);
    row = await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.status).toBe('CONFIRMED');
    expect(row.paymentMethod).toBe('bit');
    expect(row.paymentInstallments).toBeNull();
    expect(row.cardBrand).toBeNull();

    const attempts = await t.prisma.paymentAttempt.findMany({ where: { orderId: order.id }, orderBy: { createdAt: 'asc' } });
    expect(attempts.map((a) => [a.status, a.error])).toEqual([
      ['FAILED', 'card_declined'],
      ['FAILED', 'insufficient_funds'],
      ['SUCCEEDED', null],
    ]);
  });

  it('a successful card payment stores method, installments, brand and last 4', async () => {
    useMockBehaviour();
    const { order, browser } = await guestOrder(4); // 4 x 100 = 400 >= 300 minimum
    await pay(browser, order.id, {
      method: 'card',
      simulation: '3ds',
      cardBrand: 'mastercard',
      cardLast4: '3220',
      installments: 3,
    }).expect(200);

    expect(t.payments.calls[0]).toMatchObject({ method: 'card', installments: 3, simulation: '3ds' });
    const row = await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row).toMatchObject({
      status: 'CONFIRMED',
      paymentMethod: 'card',
      paymentInstallments: 3,
      cardBrand: 'mastercard',
      cardLast4: '3220',
    });

    // The customer order view carries the display fields.
    const view = await browser.get(`/v1/orders/${order.id}`).expect(200);
    expect(view.body).toMatchObject({ paymentMethod: 'card', paymentInstallments: 3, cardBrand: 'mastercard', cardLast4: '3220' });
  });

  it('rejects installments below the minimum total or for non-card methods', async () => {
    useMockBehaviour();
    const { order, browser } = await guestOrder(1); // 100 + shipping < 300
    await pay(browser, order.id, { method: 'card', installments: 2, simulation: 'success' }).expect(400);
    await pay(browser, order.id, { method: 'bit', installments: 2, simulation: 'success' }).expect(400);
    expect(t.payments.calls).toHaveLength(0);
  });

  it('validates installments, last 4 and brand', async () => {
    useMockBehaviour();
    const { order, browser } = await guestOrder(4);
    await pay(browser, order.id, { method: 'card', installments: 13 }).expect(400);
    await pay(browser, order.id, { method: 'card', installments: 0 }).expect(400);
    await pay(browser, order.id, { method: 'card', cardLast4: '12345' }).expect(400);
    await pay(browser, order.id, { method: 'card', cardLast4: 'abcd' }).expect(400);
    await pay(browser, order.id, { method: 'card', cardBrand: 'discover' }).expect(400);
    await pay(browser, order.id, { method: 'paypal' }).expect(400);
    await pay(browser, order.id, { simulation: 'steal' }).expect(400);
    expect(t.payments.calls).toHaveLength(0);
    expect((await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PENDING_PAYMENT');
  });

  it('never accepts or stores raw card data (fields are stripped by the whitelist)', async () => {
    useMockBehaviour();
    const { order, browser } = await guestOrder();
    await pay(browser, order.id, {
      method: 'card',
      cardBrand: 'visa',
      cardLast4: '4242',
      simulation: 'success',
      cardNumber: '4242424242424242',
      cvv: '123',
      expiry: '12/30',
      idNumber: '000000018',
    }).expect(200);

    const params = t.payments.calls[0] as unknown as Record<string, unknown>;
    for (const field of ['cardNumber', 'cvv', 'expiry', 'idNumber']) expect(params).not.toHaveProperty(field);
    const row = await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(JSON.stringify(row)).not.toContain('4242424242424242');
    expect(row.cardLast4).toBe('4242');
  });

  it('rejects `simulation` when the bound provider is not in test mode, without charging', async () => {
    const { order, browser } = await guestOrder();
    await pay(browser, order.id, { method: 'card', simulation: 'decline' }).expect(400);
    await pay(browser, order.id, { method: 'card', simulation: 'success' }).expect(400);
    expect(t.payments.calls).toHaveLength(0);

    // Without `simulation` the real provider is used as usual.
    await pay(browser, order.id, { method: 'card', cardBrand: 'visa', cardLast4: '4242' }).expect(200);
    expect(t.payments.calls[0]).not.toHaveProperty('simulation');
    // A real provider gets no browser-supplied card display data, and none is stored.
    expect(t.payments.calls[0]).not.toHaveProperty('displayHint');
    const row = await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row).toMatchObject({ paymentMethod: 'card', cardBrand: null, cardLast4: null });
  });

  it('stores the card brand and last 4 the provider reports, not what the browser sent', async () => {
    const { order, browser } = await guestOrder();
    t.payments.nextResult = {
      success: true,
      transactionId: 'spy_real',
      details: { method: 'card', cardBrand: 'isracard', cardLast4: '1111', installments: 1 },
    };
    await pay(browser, order.id, { method: 'card', cardBrand: 'visa', cardLast4: '4242' }).expect(200);
    const row = await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row).toMatchObject({ paymentMethod: 'card', cardBrand: 'isracard', cardLast4: '1111', paymentInstallments: 1 });
  });

  it('rejects `simulation` in production even with the mock bound', async () => {
    useMockBehaviour();
    const { order, browser } = await guestOrder();
    const prev = { env: process.env.NODE_ENV, enabled: process.env.PAYMENTS_ENABLED };
    process.env.NODE_ENV = 'production';
    process.env.PAYMENTS_ENABLED = 'true';
    try {
      await pay(browser, order.id, { method: 'card', simulation: 'decline' }).expect(400);
      const res = await t.http().get('/v1/payment/config').expect(200);
      expect(res.body.testMode).toBe(false);
    } finally {
      process.env.NODE_ENV = prev.env;
      if (prev.enabled === undefined) delete process.env.PAYMENTS_ENABLED;
      else process.env.PAYMENTS_ENABLED = prev.enabled;
    }
    expect(t.payments.calls).toHaveLength(0);
  });

  it('checks ownership before looking at payment details (404, not 400)', async () => {
    useMockBehaviour();
    const { order } = await guestOrder();
    await t.http().post(`/v1/orders/${order.id}/pay`).send({ simulation: 'decline' }).expect(404);
    await t.http().post('/v1/payment/charge').send({ orderId: order.id, method: 'card' }).expect(404);
  });

  it('/payment/charge accepts the same details', async () => {
    useMockBehaviour();
    const { order, token } = await guestOrder();
    await t
      .http()
      .post('/v1/payment/charge')
      .set('X-Order-Token', token)
      .send({ orderId: order.id, method: 'apple_pay', simulation: 'success' })
      .expect(200);
    const row = await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(row.paymentMethod).toBe('apple_pay');
  });

  it('admin payments endpoint lists attempts and details; admins only', async () => {
    useMockBehaviour();
    const { order, browser } = await guestOrder();
    await pay(browser, order.id, { method: 'card', simulation: 'decline', cardBrand: 'visa', cardLast4: '0002' }).expect(402);
    await pay(browser, order.id, { method: 'card', simulation: 'success', cardBrand: 'visa', cardLast4: '4242' }).expect(200);

    const user = await signUp(t);
    await user.agent.get(`/v1/admin/orders/${order.id}/payments`).expect(403);
    await t.http().get(`/v1/admin/orders/${order.id}/payments`).expect(401);

    const admin = await signUp(t, { admin: true });
    const res = await admin.agent.get(`/v1/admin/orders/${order.id}/payments`).expect(200);
    expect(res.body).toMatchObject({ paymentMethod: 'card', cardBrand: 'visa', cardLast4: '4242', paymentInstallments: 1 });
    expect(res.body.attempts.map((a: { status: string; error: string | null }) => [a.status, a.error])).toEqual([
      ['SUCCEEDED', null],
      ['FAILED', 'card_declined'],
    ]);
    expect(res.body.attempts[0]).not.toHaveProperty('ipAddress');
    await admin.agent.get('/v1/admin/orders/missing/payments').expect(404);
  });
});
