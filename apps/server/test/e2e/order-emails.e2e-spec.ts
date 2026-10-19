import { createTestApp, resetDb, seedCatalog, signUp, SHIPPING, type TestApp } from './app';
import { captureEmails, settledEmails, waitForEmail } from './mail';
import { OrdersService } from '../../src/orders/orders.service';

const STORE_INBOX = 'store@example.test';

describe('Order emails, order lookup and guest tracking (e2e)', () => {
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

  async function paidGuestOrder(extra: Record<string, unknown> = {}) {
    const guest = t.agent();
    await guest.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 1 }).expect(201);
    const res = await guest
      .post('/v1/orders')
      .send({ ...SHIPPING, customerEmail: 'Guest@Example.test', ...extra })
      .expect(201);
    const token = res.body.accessToken as string;
    await t.http().post('/v1/payment/charge').set('X-Order-Token', token).send({ orderId: res.body.id }).expect(200);
    // Emails are fire-and-forget: wait for both so later mail.clear() calls are deterministic.
    await waitForEmail(mail, (m) => m.to === 'Guest@Example.test' && m.subject.includes(res.body.orderNumber));
    await waitForEmail(mail, (m) => m.to === STORE_INBOX && m.subject.includes(res.body.orderNumber));
    return { order: res.body, token };
  }

  const tokenFromLink = (text: string) => /#token=([A-Za-z0-9_-]+)/.exec(text)?.[1];

  describe('confirmation', () => {
    it('sets paidAt and emails a working guest link without invalidating the original token', async () => {
      const { order, token } = await paidGuestOrder({ locale: 'en' });
      const row = await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(row.paidAt).toBeInstanceOf(Date);

      const email = await waitForEmail(mail, (m) => m.to === 'Guest@Example.test' && /confirmed/.test(m.subject));
      expect(email.subject).toContain(order.orderNumber);
      expect(email.text).toContain(`/en/order-confirmation/${order.id}#token=`);
      expect(email.text).toContain('/en/order-status');
      expect(email.text).toContain('/en/cancel-order');
      expect(email.text).toContain('48 hours');
      expect(email.text).not.toMatch(/\?token=/);

      const linkToken = tokenFromLink(email.text)!;
      const browser = t.agent();
      await browser.post(`/v1/orders/${order.id}/access`).send({ token: linkToken }).expect(200);
      await browser.get(`/v1/orders/${order.id}`).expect(200);
      // The token from checkout still works too (no rotation).
      await t.http().get(`/v1/orders/${order.id}`).set('X-Order-Token', token).expect(200);
      // A link token is bound to its order.
      const other = await paidGuestOrder();
      await t.http().get(`/v1/orders/${other.order.id}`).set('X-Order-Token', linkToken).expect(404);
    });

    it('alerts the store inbox about the new paid order', async () => {
      const { order } = await paidGuestOrder();
      const alert = await waitForEmail(mail, (m) => m.to === STORE_INBOX);
      expect(alert.subject).toContain(order.orderNumber);
      expect(alert.text).toContain('/he/admin/orders?q=');
    });

    it('describes the pickup point and links members to their account', async () => {
      const point = await t.prisma.pickupPoint.create({ data: { name: 'נקודת איסוף - קניון', city: 'אופקים', address: 'הרצל 10' } });
      const member = await signUp(t);
      await member.agent.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 1 }).expect(201);
      const res = await member.agent
        .post('/v1/orders')
        .send({ customerEmail: member.email, recipientName: 'Dana', phone: '050-1234567', deliveryMethod: 'PICKUP_POINT', pickupPointId: point.id })
        .expect(201);
      await member.agent.post('/v1/payment/charge').send({ orderId: res.body.id }).expect(200);
      const email = await waitForEmail(mail, (m) => m.to === member.email && m.subject.includes(res.body.orderNumber));
      expect(email.text).toContain('איסוף מנקודת חלוקה: נקודת איסוף - קניון, הרצל 10, אופקים');
      expect(email.text).toContain('/he/account/orders');
      expect(email.text).not.toContain('#token=');
    });
  });

  describe('POST /orders/lookup', () => {
    it('finds the order by number + email (case-insensitive) and returns a usable token', async () => {
      const { order } = await paidGuestOrder();
      const res = await t
        .http()
        .post('/v1/orders/lookup')
        .send({ orderNumber: order.orderNumber.toLowerCase(), email: 'guest@EXAMPLE.test' })
        .expect(200);
      expect(res.body.order.id).toBe(order.id);
      expect(res.body.order.accessTokenHash).toBeUndefined();
      expect(res.body.order.cancellation).toMatchObject({ canSelfCancel: true, canRequest: true });
      await t.http().get(`/v1/orders/${order.id}`).set('X-Order-Token', res.body.accessToken).expect(200);
    });

    it('answers every mismatch with the same 404', async () => {
      const { order } = await paidGuestOrder();
      const wrongEmail = await t.http().post('/v1/orders/lookup').send({ orderNumber: order.orderNumber, email: 'x@example.test' });
      const wrongNumber = await t.http().post('/v1/orders/lookup').send({ orderNumber: 'BA-NOPE', email: 'guest@example.test' });
      expect(wrongEmail.status).toBe(404);
      expect(wrongNumber.status).toBe(404);
      expect(wrongEmail.body).toEqual(wrongNumber.body);
      expect(wrongEmail.body.code).toBe('ORDER_LOOKUP_FAILED');
    });

    it('is rate-limited', async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 12; i++) {
        statuses.push((await t.http().post('/v1/orders/lookup').send({ orderNumber: 'BA-X', email: 'a@example.test' })).status);
      }
      expect(statuses.slice(0, 10).every((s) => s === 404)).toBe(true);
      expect(statuses.slice(10)).toEqual([429, 429]);
    });
  });

  describe('fulfilment emails', () => {
    it('SHIPPED stamps shippedAt and emails the tracking number', async () => {
      process.env.TRACKING_URL_TEMPLATE = 'https://track.example/?n={tracking}';
      try {
        const { order } = await paidGuestOrder();
        const admin = await signUp(t, { admin: true });
        mail.clear();
        await admin.agent.put(`/v1/admin/orders/${order.id}/status`).send({ status: 'SHIPPED', trackingNumber: 'IL123' }).expect(200);
        const row = await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
        expect(row.shippedAt).toBeInstanceOf(Date);
        const email = await waitForEmail(mail, (m) => m.to === 'Guest@Example.test' && m.subject.includes('נשלחה'));
        expect(email.text).toContain('IL123');
        expect(email.text).toContain('https://track.example/?n=IL123');
        expect(email.text).toContain('#token=');

        // The customer can no longer cancel instantly once shipped.
        const lookup = await t.http().post('/v1/orders/lookup').send({ orderNumber: order.orderNumber, email: 'guest@example.test' });
        expect(lookup.body.order.cancellation).toMatchObject({ canSelfCancel: false, canRequest: true, requiresReturn: true });
      } finally {
        delete process.env.TRACKING_URL_TEMPLATE;
      }
    });

    it('pickup orders say the parcel is on its way to the pickup point', async () => {
      const point = await t.prisma.pickupPoint.create({ data: { name: 'נקודה בנגב', city: 'באר שבע', address: 'הרצל 1', hours: '9-18' } });
      const { order } = await paidGuestOrder({ deliveryMethod: 'PICKUP_POINT', pickupPointId: point.id });
      const admin = await signUp(t, { admin: true });
      mail.clear();
      await admin.agent.put(`/v1/admin/orders/${order.id}/status`).send({ status: 'SHIPPED' }).expect(200);
      const email = await waitForEmail(mail, (m) => m.to === 'Guest@Example.test' && m.subject.includes('נשלחה'));
      expect(email.text).toContain('החבילה בדרך לנקודת האיסוף');
      expect(email.text).toContain('נקודה בנגב - הרצל 1, באר שבע');
    });

    it('DELIVERED and admin cancellations email the customer; the unpaid-order sweeper does not', async () => {
      const { order } = await paidGuestOrder();
      const admin = await signUp(t, { admin: true });
      mail.clear();
      await admin.agent.put(`/v1/admin/orders/${order.id}/status`).send({ status: 'DELIVERED' }).expect(200);
      await waitForEmail(mail, (m) => m.subject.includes('נמסרה'));

      await t.prisma.productVariant.update({ where: { id: catalog.inStock.id }, data: { stockQuantity: 5 } });
      const second = await paidGuestOrder();
      mail.clear();
      await admin.agent.put(`/v1/admin/orders/${second.order.id}/status`).send({ status: 'CANCELLED' }).expect(200);
      const cancelled = await waitForEmail(mail, (m) => m.subject.includes('בוטלה'));
      expect(cancelled.text).toContain(second.order.orderNumber);
      const row = await t.prisma.order.findUniqueOrThrow({ where: { id: second.order.id } });
      expect(row.cancelledAt).toBeInstanceOf(Date);

      // Abandoned, unpaid order released by the sweeper: no email.
      const guest = t.agent();
      await guest.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 1 }).expect(201);
      const unpaid = await guest.post('/v1/orders').send({ ...SHIPPING, customerEmail: 'abandoned@example.test' }).expect(201);
      await t.prisma.order.update({ where: { id: unpaid.body.id }, data: { createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) } });
      mail.clear();
      expect(await t.app.get(OrdersService).releaseExpiredPendingOrders(60 * 60 * 1000)).toBe(1);
      expect(await settledEmails(mail)).toHaveLength(0);
    });

    it('an admin status change cannot overwrite a concurrent cancellation', async () => {
      const { order, token } = await paidGuestOrder();
      const admin = await signUp(t, { admin: true });
      const service = t.app.get(OrdersService);
      // Simulate the admin having read CONFIRMED just before the customer cancelled.
      await t.http().post(`/v1/orders/${order.id}/cancel`).set('X-Order-Token', token).send({ reason: 'SIZE' }).expect(200);
      await expect(service.updateStatus(order.id, 'SHIPPED')).rejects.toThrow();
      const row = await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(row.status).toBe('CANCELLED');
      await admin.agent.put(`/v1/admin/orders/${order.id}/status`).send({ status: 'SHIPPED' }).expect(409);
    });
  });

  describe('admin CSV export', () => {
    it('exports orders for a date range, admin only', async () => {
      const { order } = await paidGuestOrder();
      const today = new Date().toISOString().slice(0, 10);
      await t.http().get('/v1/admin/orders/export').expect(401);
      const admin = await signUp(t, { admin: true });
      const res = await admin.agent.get('/v1/admin/orders/export').query({ from: today, to: today }).expect(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain(order.orderNumber);
      expect(res.text.split('\r\n')[0]).toContain('orderNumber');
      const none = await admin.agent.get('/v1/admin/orders/export').query({ from: '2000-01-01', to: '2000-01-02' }).expect(200);
      expect(none.text).not.toContain(order.orderNumber);
      await admin.agent.get('/v1/admin/orders/export').query({ from: 'yesterday' }).expect(400);
    });
  });
});
