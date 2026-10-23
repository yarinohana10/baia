import { createTestApp, resetDb, seedCatalog, signUp, SHIPPING, type TestApp } from './app';
import { captureEmails, settledEmails, waitForEmail } from './mail';

const STORE_INBOX = 'store@example.test';

describe('Cancellations: direct until shipped, requests after, refunds (e2e)', () => {
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
    await t.prisma.siteConfig.create({ data: { id: 'default', contactEmail: STORE_INBOX } });
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
      // The purchase may also trip a low-stock alert; let it land so clear() leaves a clean slate.
      await settledEmails(mail, 100);
    }
    mail.clear();
    return { order: res.body, token };
  }

  /** Ships the order as an admin (the point after which a customer can only file a request). */
  async function ship(orderId: string) {
    const admin = await signUp(t, { admin: true });
    await admin.agent.put(`/v1/admin/orders/${orderId}/status`).send({ status: 'SHIPPED', trackingNumber: 'IL1' }).expect(200);
    await waitForEmail(mail, (m) => m.subject.includes('נשלחה'));
    mail.clear();
    return admin;
  }

  describe('self-service cancel', () => {
    it('is open on a paid order at any age before shipping', async () => {
      const { order, token } = await guestOrder();
      // Days later the 48h window of the old policy is long gone: still cancellable.
      await t.prisma.order.update({ where: { id: order.id }, data: { createdAt: new Date(Date.now() - 20 * 24 * 3600_000), paidAt: new Date(Date.now() - 20 * 24 * 3600_000) } });
      const res = await t.http().get(`/v1/orders/${order.id}`).set('X-Order-Token', token).expect(200);
      expect(res.body.cancellation).toEqual({ canSelfCancel: true, canRequest: false, requiresReturn: false, openRequest: null });
    });

    it('cancels, restocks once, records a Refund that the provider settles, and emails customer + store', async () => {
      const { order, token } = await guestOrder();
      expect(await stock()).toBe(3);
      const res = await t
        .http()
        .post(`/v1/orders/${order.id}/cancel`)
        .set('X-Order-Token', token)
        .send({ reason: 'SIZE', details: 'Too small' })
        .expect(200);
      // The provider (spy) settled the refund at once, so the order is already REFUNDED.
      expect(res.body.status).toBe('REFUNDED');
      expect(res.body.cancelledAt).toBeTruthy();
      expect(res.body.cancellation).toMatchObject({ canSelfCancel: false, canRequest: false });
      expect(res.body.refunds).toEqual([expect.objectContaining({ status: 'COMPLETED', amount: '229.9' })]);
      expect(await stock()).toBe(5);
      expect(t.payments.refundAmounts).toEqual([229.9]);

      const request = await t.prisma.cancellationRequest.findFirstOrThrow({ where: { orderId: order.id } });
      expect(request).toMatchObject({ status: 'AUTO_CANCELLED', reason: 'SIZE', details: 'Too small' });
      expect(Number(request.refundAmount)).toBe(229.9);
      expect(Number(request.feeAmount)).toBe(0);

      const customer = await waitForEmail(mail, (m) => m.to === 'buyer@example.test');
      expect(customer.subject).toContain(order.orderNumber);
      expect(customer.text).toContain('229.90');
      const alert = await waitForEmail(mail, (m) => m.to === STORE_INBOX && m.subject.includes(order.orderNumber));
      expect(alert.text).toContain('מידה לא מתאימה');
      expect(alert.text).toContain('הלקוח/ה ביטל/ה');

      // Second attempt: nothing left to cancel, no second refund, no second restock.
      await t.http().post(`/v1/orders/${order.id}/cancel`).set('X-Order-Token', token).send({ reason: 'SIZE', contactPhone: '052-123-4567' }).expect(409);
      expect(t.payments.refunds).toHaveLength(1);
      expect(await stock()).toBe(5);
    });

    it('cancels an unpaid order without a refund; customer and store are both told', async () => {
      const { order, token } = await guestOrder({ pay: false });
      await t.http().post(`/v1/orders/${order.id}/cancel`).set('X-Order-Token', token).send({ reason: 'ORDERED_BY_MISTAKE' }).expect(200);
      expect(t.payments.refunds).toHaveLength(0);
      expect(await t.prisma.refund.count()).toBe(0);
      const sent = await settledEmails(mail);
      expect(sent.filter((m) => m.subject.includes(order.orderNumber)).map((m) => m.to).sort()).toEqual(['buyer@example.test', STORE_INBOX]);
    });

    it('is closed once shipped, and for strangers', async () => {
      const { order, token } = await guestOrder();
      await t.http().post(`/v1/orders/${order.id}/cancel`).send({ reason: 'SIZE' }).expect(404);
      const stranger = await signUp(t);
      await stranger.agent.post(`/v1/orders/${order.id}/cancel`).send({ reason: 'SIZE' }).expect(404);
      const admin = await signUp(t, { admin: true });
      await admin.agent.post(`/v1/orders/${order.id}/cancel`).send({ reason: 'SIZE' }).expect(404);
      await t.http().post(`/v1/orders/${order.id}/cancel`).set('X-Order-Token', token).send({ reason: 'BOGUS' }).expect(400);

      await ship(order.id);
      const late = await t.http().post(`/v1/orders/${order.id}/cancel`).set('X-Order-Token', token).send({ reason: 'SIZE', contactPhone: '052-123-4567' }).expect(409);
      expect(late.body.code).toBe('SELF_CANCEL_UNAVAILABLE');
      const view = await t.http().get(`/v1/orders/${order.id}`).set('X-Order-Token', token).expect(200);
      expect(view.body.cancellation).toMatchObject({ canSelfCancel: false, canRequest: true, requiresReturn: true });
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

    it('when the provider cannot refund, the order stays CANCELLED with a PENDING refund an admin completes without restocking again', async () => {
      const { order, token } = await guestOrder();
      t.payments.failRefunds = true;
      const res = await t.http().post(`/v1/orders/${order.id}/cancel`).set('X-Order-Token', token).send({ reason: 'SIZE' }).expect(200);
      expect(res.body.status).toBe('CANCELLED');
      expect(res.body.refunds).toEqual([expect.objectContaining({ status: 'PENDING', amount: '229.9' })]);
      expect(await stock()).toBe(5);

      const customerMail = await waitForEmail(mail, (m) => m.to === 'buyer@example.test');
      expect(customerMail.text).toContain('בטיפול');
      const alert = await waitForEmail(mail, (m) => m.to === STORE_INBOX && m.subject.includes(order.orderNumber));
      expect(alert.subject).toContain('נדרש זיכוי');
      mail.clear();

      const admin = await signUp(t, { admin: true });
      const pending = await admin.agent.get('/v1/admin/refunds').query({ status: 'PENDING' }).expect(200);
      expect(pending.body).toMatchObject({ total: 1, pendingCount: 1 });
      expect((await admin.agent.get('/v1/admin/notifications/counts').expect(200)).body.pendingRefunds).toBe(1);
      expect(pending.body.refunds[0]).toMatchObject({ amount: '229.9', order: { orderNumber: order.orderNumber, status: 'CANCELLED' } });
      const detail = await admin.agent.get(`/v1/admin/orders/${order.id}`).expect(200);
      expect(detail.body.allowedTransitions).toEqual(['REFUNDED']);
      expect(detail.body.refunds).toHaveLength(1);

      const refundId = pending.body.refunds[0].id;
      await t.http().post(`/v1/admin/refunds/${refundId}/complete`).send({}).expect(401);
      const done = await admin.agent.post(`/v1/admin/refunds/${refundId}/complete`).send({ providerRef: 'dash_1', note: 'Refunded in the dashboard' }).expect(200);
      expect(done.body).toMatchObject({ status: 'COMPLETED', providerRef: 'dash_1', completedByEmail: admin.email });
      const row = await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(row.status).toBe('REFUNDED');
      expect(await stock()).toBe(5); // restocked at cancel time only
      const refundMail = await waitForEmail(mail, (m) => m.to === 'buyer@example.test');
      expect(refundMail.subject).toContain(order.orderNumber);
      expect(refundMail.text).toContain('229.90');

      await admin.agent.post(`/v1/admin/refunds/${refundId}/complete`).send({}).expect(409);
      const after = await admin.agent.get('/v1/admin/refunds').query({ status: 'PENDING' }).expect(200);
      expect(after.body.pendingCount).toBe(0);
    });
  });

  describe('cancellation requests (shipped orders)', () => {
    it('files a request, emails both sides with the order number, and blocks duplicates', async () => {
      const { order, token } = await guestOrder();
      await ship(order.id);
      const res = await t
        .http()
        .post(`/v1/orders/${order.id}/cancellation-request`)
        .set('X-Order-Token', token)
        .send({ reason: 'SHIPPING_DELAY', details: 'Need it sooner', contactPhone: '050-7654321' })
        .expect(201);
      expect(res.body.cancellation.openRequest).toMatchObject({ status: 'REQUESTED', reason: 'SHIPPING_DELAY' });
      expect(res.body.cancellation.canRequest).toBe(false);
      expect(res.body.status).toBe('SHIPPED');

      const customer = await waitForEmail(mail, (m) => m.to === 'buyer@example.test');
      expect(customer.subject).toContain('בקשת ביטול');
      expect(customer.subject).toContain(order.orderNumber);
      expect(customer.text).toContain('יש להחזיר את הפריטים');
      const alert = await waitForEmail(mail, (m) => m.to === STORE_INBOX);
      expect(alert.subject).toContain(order.orderNumber);
      expect(alert.text).toContain('050-7654321');

      const dup = await t
        .http()
        .post(`/v1/orders/${order.id}/cancellation-request`)
        .set('X-Order-Token', token)
        .send({ reason: 'OTHER', contactPhone: '052-123-4567' })
        .expect(409);
      expect(dup.body.code).toBe('CANCELLATION_ALREADY_REQUESTED');
    });

    it('requires a contact phone so the store can call the customer', async () => {
      const { order, token } = await guestOrder();
      await ship(order.id);
      const missing = await t
        .http()
        .post(`/v1/orders/${order.id}/cancellation-request`)
        .set('X-Order-Token', token)
        .send({ reason: 'SIZE' })
        .expect(400);
      expect(JSON.stringify(missing.body)).toContain('contactPhone');
      await t
        .http()
        .post('/v1/cancellations')
        .send({ orderNumber: order.orderNumber, email: 'buyer@example.test', reason: 'SIZE', contactPhone: '  ' })
        .expect(400);
    });

    it('refuses a request while the order can still be cancelled directly', async () => {
      const { order, token } = await guestOrder();
      const res = await t.http().post(`/v1/orders/${order.id}/cancellation-request`).set('X-Order-Token', token).send({ reason: 'SIZE', contactPhone: '052-123-4567' }).expect(409);
      expect(res.body.code).toBe('CANCELLATION_NOT_ALLOWED');
    });
  });

  describe('public /cancellations form', () => {
    it('404s on a mismatch, cancels instantly before shipping, files a request after', async () => {
      const a = await guestOrder();
      const base = { orderNumber: a.order.orderNumber, email: 'buyer@example.test', reason: 'CHANGED_MIND', contactPhone: '052-123-4567' };
      await t.http().post('/v1/cancellations').send({ ...base, email: 'nope@example.test' }).expect(404);

      await ship(a.order.id);
      const requested = await t.http().post('/v1/cancellations').send({ ...base }).expect(201);
      expect(requested.body.outcome).toBe('REQUESTED');
      expect(requested.body.accessToken).toMatch(/^v1_/);

      await t.prisma.productVariant.update({ where: { id: catalog.inStock.id }, data: { stockQuantity: 5 } });
      const b = await guestOrder();
      const instant = await t
        .http()
        .post('/v1/cancellations')
        .send({ orderNumber: b.order.orderNumber.toLowerCase(), email: 'BUYER@example.test', reason: 'SIZE', contactPhone: '052-123-4567' })
        .expect(201);
      expect(instant.body.outcome).toBe('CANCELLED');
      expect(instant.body.order.status).toBe('REFUNDED');
      expect(t.payments.refundAmounts).toEqual([229.9]);
    });
  });

  describe('admin review', () => {
    async function openRequest() {
      const { order, token } = await guestOrder();
      await ship(order.id);
      await t.http().post(`/v1/orders/${order.id}/cancellation-request`).set('X-Order-Token', token).send({ reason: 'SIZE', contactPhone: '052-123-4567' }).expect(201);
      await settledEmails(mail, 100);
      mail.clear();
      return order;
    }

    it('lists requests with a suggested fee', async () => {
      await openRequest();
      const admin = await signUp(t, { admin: true });
      await t.http().get('/v1/admin/cancellations').expect(401);
      const res = await admin.agent.get('/v1/admin/cancellations').query({ status: 'REQUESTED' }).expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.requests[0]).toMatchObject({
        status: 'REQUESTED',
        requiresReturn: true,
        suggestedFee: 11.5, // 5% of 229.90, below ₪100
        order: { customerEmail: 'buyer@example.test', paid: true, hasPaymentRef: true },
      });
      expect(res.body.requests[0].insideWindow).toBeUndefined();
      expect(res.body.requests[0].order.paymentRef).toBeUndefined();

      const counts = await admin.agent.get('/v1/admin/notifications/counts').expect(200);
      expect(counts.body).toMatchObject({ pendingCancellations: 1, newContactMessages: 0, newOrders: 0 });
    });

    it('approves with a fee: cancels, restocks, refunds total − fee, emails both sides', async () => {
      const order = await openRequest();
      const admin = await signUp(t, { admin: true });
      const { body } = await admin.agent.get('/v1/admin/cancellations').expect(200);
      const id = body.requests[0].id;
      const res = await admin.agent.put(`/v1/admin/cancellations/${id}`).send({ action: 'approve', feeAmount: 11.5, adminNote: 'Return received' }).expect(200);
      expect(res.body).toMatchObject({ status: 'APPROVED', feeAmount: '11.5', refundAmount: '218.4', refundPending: false });
      expect(t.payments.refundAmounts).toEqual([218.4]);
      expect(await stock()).toBe(5);
      const row = await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(row.status).toBe('REFUNDED');
      const refund = await t.prisma.refund.findFirstOrThrow({ where: { orderId: order.id } });
      expect(refund).toMatchObject({ status: 'COMPLETED', completedByEmail: null });
      expect(Number(refund.amount)).toBe(218.4);
      const email = await waitForEmail(mail, (m) => m.to === 'buyer@example.test');
      expect(email.text).toContain('218.40');
      expect(email.text).toContain('11.50');
      const alert = await waitForEmail(mail, (m) => m.to === STORE_INBOX && m.subject.includes(order.orderNumber));
      expect(alert.text).toContain('11.50');

      await admin.agent.put(`/v1/admin/cancellations/${id}`).send({ action: 'approve' }).expect(409);
      expect(t.payments.refunds).toHaveLength(1);
    });

    it('rejects with a note and emails the customer; the order continues', async () => {
      const order = await openRequest();
      const admin = await signUp(t, { admin: true });
      const { body } = await admin.agent.get('/v1/admin/cancellations').expect(200);
      await admin.agent
        .put(`/v1/admin/cancellations/${body.requests[0].id}`)
        .send({ action: 'reject', adminNote: 'Already with the courier' })
        .expect(200);
      const email = await waitForEmail(mail, (m) => m.to === 'buyer@example.test');
      expect(email.text).toContain('Already with the courier');
      const row = await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(row.status).toBe('SHIPPED');
      expect(t.payments.refunds).toHaveLength(0);
      await admin.agent.put(`/v1/admin/cancellations/${body.requests[0].id}`).send({ action: 'maybe' }).expect(400);
    });

    it('admin cancel from the orders screen refunds and closes the open request', async () => {
      const order = await openRequest();
      const admin = await signUp(t, { admin: true });
      const res = await admin.agent.post(`/v1/admin/orders/${order.id}/cancel`).send({ refund: true }).expect(200);
      expect(res.body.status).toBe('REFUNDED');
      expect(res.body.refundAmount).toBe(229.9);
      const request = await t.prisma.cancellationRequest.findFirstOrThrow({ where: { orderId: order.id } });
      expect(request.status).toBe('APPROVED');
      await admin.agent.post(`/v1/admin/orders/${order.id}/cancel`).send({ refund: true }).expect(409);
      expect(t.payments.refunds).toHaveLength(1);
    });

    it('admin cancel of a paid order without refund records no Refund', async () => {
      const { order } = await guestOrder();
      const admin = await signUp(t, { admin: true });
      const res = await admin.agent.post(`/v1/admin/orders/${order.id}/cancel`).send({ refund: false }).expect(200);
      expect(res.body.status).toBe('CANCELLED');
      expect(await t.prisma.refund.count()).toBe(0);
      expect(t.payments.refunds).toHaveLength(0);
    });
  });
});
