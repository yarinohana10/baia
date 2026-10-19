import { createTestApp, resetDb, seedCatalog, signUp, SHIPPING, type TestApp } from './app';
import { captureEmails, settledEmails, waitForEmail } from './mail';

const STORE_INBOX = 'store@example.test';
const HOUR = 60 * 60 * 1000;

describe('Cancellations: self-service window, requests, admin review (e2e)', () => {
  let t: TestApp;
  let catalog: Awaited<ReturnType<typeof seedCatalog>>;
  let mail: ReturnType<typeof captureEmails>;

  beforeAll(async () => {
    t = await createTestApp();
    mail = captureEmails(t);
  });
  afterAll(async () => t.close());
  beforeEach(async () => {
    await resetDb(t.prisma);
    t.payments.reset();
    catalog = await seedCatalog(t.prisma);
    await t.prisma.siteConfig.create({ data: { id: 'default', contactEmail: STORE_INBOX, selfCancelWindowHours: 48 } });
    mail.clear();
  });

  const stock = async () => (await t.prisma.productVariant.findUniqueOrThrow({ where: { id: catalog.inStock.id } })).stockQuantity;

  /** 2 × 100 + 29.90 shipping = 229.90 */
  async function guestOrder({ pay = true } = {}) {
    const guest = t.agent();
    await guest.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 2 }).expect(201);
    const res = await guest.post('/v1/orders').send({ ...SHIPPING, customerEmail: 'buyer@example.test' }).expect(201);
    const token = res.body.accessToken as string;
    if (pay) {
      await t.http().post('/v1/payment/charge').set('X-Order-Token', token).send({ orderId: res.body.id }).expect(200);
      // Let the (fire-and-forget) confirmation + store alert land before clearing.
      await waitForEmail(mail, (m) => m.subject.includes(`אישור הזמנה ${res.body.orderNumber}`));
      await waitForEmail(mail, (m) => m.to === STORE_INBOX && m.subject.includes(res.body.orderNumber));
    }
    mail.clear();
    return { order: res.body, token };
  }

  const ageOrder = (id: string, hours: number) =>
    t.prisma.order.update({ where: { id }, data: { paidAt: new Date(Date.now() - hours * HOUR) } });

  describe('self-service cancel', () => {
    it('shows eligibility with a deadline on the order', async () => {
      const { order, token } = await guestOrder();
      const res = await t.http().get(`/v1/orders/${order.id}`).set('X-Order-Token', token).expect(200);
      expect(res.body.cancellation).toMatchObject({ canSelfCancel: true, canRequest: true, requiresReturn: false, openRequest: null, windowHours: 48 });
      const deadline = new Date(res.body.cancellation.selfCancelDeadline).getTime();
      expect(deadline).toBeGreaterThan(Date.now() + 47 * HOUR);
    });

    it('cancels, restocks, refunds in full and emails customer + store', async () => {
      const { order, token } = await guestOrder();
      expect(await stock()).toBe(3);
      const res = await t
        .http()
        .post(`/v1/orders/${order.id}/cancel`)
        .set('X-Order-Token', token)
        .send({ reason: 'SIZE', details: 'Too small' })
        .expect(200);
      expect(res.body.status).toBe('CANCELLED');
      expect(res.body.cancelledAt).toBeTruthy();
      expect(res.body.cancellation).toMatchObject({ canSelfCancel: false, canRequest: false });
      expect(await stock()).toBe(5);
      expect(t.payments.refundAmounts).toEqual([229.9]);

      const request = await t.prisma.cancellationRequest.findFirstOrThrow({ where: { orderId: order.id } });
      expect(request).toMatchObject({ status: 'AUTO_CANCELLED', reason: 'SIZE', details: 'Too small' });
      expect(Number(request.refundAmount)).toBe(229.9);
      expect(Number(request.feeAmount)).toBe(0);

      const customer = await waitForEmail(mail, (m) => m.to === 'buyer@example.test');
      expect(customer.text).toContain('229.90');
      const alert = await waitForEmail(mail, (m) => m.to === STORE_INBOX);
      expect(alert.text).toContain('מידה לא מתאימה');

      // Second attempt: nothing left to cancel, no second refund.
      await t.http().post(`/v1/orders/${order.id}/cancel`).set('X-Order-Token', token).send({ reason: 'SIZE' }).expect(409);
      expect(t.payments.refunds).toHaveLength(1);
    });

    it('cancels an unpaid order without a refund or store alert', async () => {
      const { order, token } = await guestOrder({ pay: false });
      await t.http().post(`/v1/orders/${order.id}/cancel`).set('X-Order-Token', token).send({ reason: 'ORDERED_BY_MISTAKE' }).expect(200);
      expect(t.payments.refunds).toHaveLength(0);
      const sent = await settledEmails(mail);
      expect(sent.map((m) => m.to)).toEqual(['buyer@example.test']);
    });

    it('is closed after the window, once shipped, and for strangers', async () => {
      const { order, token } = await guestOrder();
      await t.http().post(`/v1/orders/${order.id}/cancel`).send({ reason: 'SIZE' }).expect(404);
      const stranger = await signUp(t);
      await stranger.agent.post(`/v1/orders/${order.id}/cancel`).send({ reason: 'SIZE' }).expect(404);
      const admin = await signUp(t, { admin: true });
      await admin.agent.post(`/v1/orders/${order.id}/cancel`).send({ reason: 'SIZE' }).expect(404);
      await t.http().post(`/v1/orders/${order.id}/cancel`).set('X-Order-Token', token).send({ reason: 'BOGUS' }).expect(400);

      await ageOrder(order.id, 49);
      const late = await t.http().post(`/v1/orders/${order.id}/cancel`).set('X-Order-Token', token).send({ reason: 'SIZE' }).expect(409);
      expect(late.body.code).toBe('SELF_CANCEL_UNAVAILABLE');
      const view = await t.http().get(`/v1/orders/${order.id}`).set('X-Order-Token', token).expect(200);
      expect(view.body.cancellation).toMatchObject({ canSelfCancel: false, selfCancelDeadline: null, canRequest: true });
      expect(t.payments.refunds).toHaveLength(0);
    });

    it('lets signed-in owners cancel their own order', async () => {
      const member = await signUp(t);
      await member.agent.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 1 }).expect(201);
      const { body: order } = await member.agent.post('/v1/orders').send(SHIPPING).expect(201);
      await member.agent.post('/v1/payment/charge').send({ orderId: order.id }).expect(200);
      const mine = await member.agent.get('/v1/orders/my').expect(200);
      expect(mine.body.orders[0].cancellation.canSelfCancel).toBe(true);
      await member.agent.post(`/v1/orders/${order.id}/cancel`).send({ reason: 'CHANGED_MIND' }).expect(200);
    });
  });

  describe('cancellation requests', () => {
    it('files a request after the window, emails both sides, and blocks duplicates', async () => {
      const { order, token } = await guestOrder();
      await ageOrder(order.id, 72);
      const res = await t
        .http()
        .post(`/v1/orders/${order.id}/cancellation-request`)
        .set('X-Order-Token', token)
        .send({ reason: 'SHIPPING_DELAY', details: 'Need it sooner', contactPhone: '050-7654321' })
        .expect(201);
      expect(res.body.cancellation.openRequest).toMatchObject({ status: 'REQUESTED', reason: 'SHIPPING_DELAY' });
      expect(res.body.cancellation.canRequest).toBe(false);
      expect(res.body.status).toBe('CONFIRMED');

      const customer = await waitForEmail(mail, (m) => m.to === 'buyer@example.test');
      expect(customer.subject).toContain('בקשת ביטול');
      const alert = await waitForEmail(mail, (m) => m.to === STORE_INBOX);
      expect(alert.text).toContain('אחרי חלון הביטול');
      expect(alert.text).toContain('050-7654321');

      const dup = await t
        .http()
        .post(`/v1/orders/${order.id}/cancellation-request`)
        .set('X-Order-Token', token)
        .send({ reason: 'OTHER' })
        .expect(409);
      expect(dup.body.code).toBe('CANCELLATION_ALREADY_REQUESTED');
    });

    it('accepts requests for shipped orders and flags the return', async () => {
      const { order, token } = await guestOrder();
      const admin = await signUp(t, { admin: true });
      await admin.agent.put(`/v1/admin/orders/${order.id}/status`).send({ status: 'SHIPPED', trackingNumber: 'IL1' }).expect(200);
      await waitForEmail(mail, (m) => m.subject.includes('נשלחה'));
      mail.clear();
      await t.http().post(`/v1/orders/${order.id}/cancellation-request`).set('X-Order-Token', token).send({ reason: 'SIZE' }).expect(201);
      const customer = await waitForEmail(mail, (m) => m.to === 'buyer@example.test');
      expect(customer.text).toContain('יש להחזיר את הפריטים');
    });
  });

  describe('public /cancellations form', () => {
    it('404s on a mismatch, cancels instantly inside the window, otherwise files a request', async () => {
      const a = await guestOrder();
      const base = { orderNumber: a.order.orderNumber, email: 'buyer@example.test', reason: 'CHANGED_MIND', phone: undefined };
      await t.http().post('/v1/cancellations').send({ ...base, email: 'nope@example.test' }).expect(404);

      const requested = await t.http().post('/v1/cancellations').send({ ...base }).expect(201);
      expect(requested.body.outcome).toBe('REQUESTED');
      expect(requested.body.accessToken).toMatch(/^v1_/);

      await t.prisma.productVariant.update({ where: { id: catalog.inStock.id }, data: { stockQuantity: 5 } });
      const b = await guestOrder();
      const instant = await t
        .http()
        .post('/v1/cancellations')
        .send({ orderNumber: b.order.orderNumber.toLowerCase(), email: 'BUYER@example.test', reason: 'SIZE', instant: true })
        .expect(201);
      expect(instant.body.outcome).toBe('CANCELLED');
      expect(instant.body.order.status).toBe('CANCELLED');
      expect(t.payments.refundAmounts).toEqual([229.9]);
    });
  });

  describe('admin review', () => {
    async function openRequest(hoursSincePaid: number) {
      const { order, token } = await guestOrder();
      await ageOrder(order.id, hoursSincePaid);
      await t.http().post(`/v1/orders/${order.id}/cancellation-request`).set('X-Order-Token', token).send({ reason: 'SIZE' }).expect(201);
      mail.clear();
      return order;
    }

    it('lists requests with window status and a suggested fee', async () => {
      await openRequest(72);
      const admin = await signUp(t, { admin: true });
      await t.http().get('/v1/admin/cancellations').expect(401);
      const res = await admin.agent.get('/v1/admin/cancellations').query({ status: 'REQUESTED' }).expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.requests[0]).toMatchObject({
        status: 'REQUESTED',
        insideWindow: false,
        requiresReturn: false,
        suggestedFee: 11.5, // 5% of 229.90, below ₪100
        order: { customerEmail: 'buyer@example.test', paid: true, hasPaymentRef: true },
      });
      expect(res.body.requests[0].order.paymentRef).toBeUndefined();

      const counts = await admin.agent.get('/v1/admin/notifications/counts').expect(200);
      expect(counts.body).toMatchObject({ pendingCancellations: 1, newContactMessages: 0, newOrders: 0, ordersToFulfil: 1 });
    });

    it('approves with a fee: cancels, restocks, refunds total − fee, emails the customer', async () => {
      const order = await openRequest(72);
      const admin = await signUp(t, { admin: true });
      const { body } = await admin.agent.get('/v1/admin/cancellations').expect(200);
      const id = body.requests[0].id;
      const res = await admin.agent.put(`/v1/admin/cancellations/${id}`).send({ action: 'approve', feeAmount: 11.5, adminNote: 'Return received' }).expect(200);
      expect(res.body).toMatchObject({ status: 'APPROVED', feeAmount: '11.5', refundAmount: '218.4', refundFailed: false });
      expect(t.payments.refundAmounts).toEqual([218.4]);
      expect(await stock()).toBe(5);
      const row = await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(row.status).toBe('CANCELLED');
      const email = await waitForEmail(mail, (m) => m.to === 'buyer@example.test');
      expect(email.text).toContain('218.40');
      expect(email.text).toContain('11.50');

      await admin.agent.put(`/v1/admin/cancellations/${id}`).send({ action: 'approve' }).expect(409);
      expect(t.payments.refunds).toHaveLength(1);
    });

    it('rejects with a note and emails the customer; the order continues', async () => {
      const order = await openRequest(72);
      const admin = await signUp(t, { admin: true });
      const { body } = await admin.agent.get('/v1/admin/cancellations').expect(200);
      await admin.agent
        .put(`/v1/admin/cancellations/${body.requests[0].id}`)
        .send({ action: 'reject', adminNote: 'Already with the courier' })
        .expect(200);
      const email = await waitForEmail(mail, (m) => m.to === 'buyer@example.test');
      expect(email.text).toContain('Already with the courier');
      const row = await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(row.status).toBe('CONFIRMED');
      expect(t.payments.refunds).toHaveLength(0);
      await admin.agent.put(`/v1/admin/cancellations/${body.requests[0].id}`).send({ action: 'maybe' }).expect(400);
    });

    it('admin cancel from the orders screen refunds and closes the open request', async () => {
      const order = await openRequest(72);
      const admin = await signUp(t, { admin: true });
      const res = await admin.agent.post(`/v1/admin/orders/${order.id}/cancel`).send({ refund: true }).expect(200);
      expect(res.body.status).toBe('CANCELLED');
      expect(res.body.refundAmount).toBe(229.9);
      const request = await t.prisma.cancellationRequest.findFirstOrThrow({ where: { orderId: order.id } });
      expect(request.status).toBe('APPROVED');
      await admin.agent.post(`/v1/admin/orders/${order.id}/cancel`).send({ refund: true }).expect(409);
      expect(t.payments.refunds).toHaveLength(1);
    });
  });
});
