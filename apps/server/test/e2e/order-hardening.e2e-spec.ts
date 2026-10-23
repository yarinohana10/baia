import { createTestApp, resetDb, seedCatalog, signUp, SHIPPING, type TestApp } from './app';
import { captureEmails, settledEmails, waitForEmail } from './mail';
import { OrdersService, orderNumbers } from '../../src/orders/orders.service';

const STORE_INBOX = 'store@example.test';

describe('Orders: checkout hardening, status history, refunds, resend (e2e)', () => {
  let t: TestApp;
  let catalog: Awaited<ReturnType<typeof seedCatalog>>;
  let mail: ReturnType<typeof captureEmails>;

  beforeAll(async () => {
    t = await createTestApp();
    mail = captureEmails(t);
  });
  afterAll(async () => t.close());
  beforeEach(async () => {
    jest.restoreAllMocks();
    delete process.env.ADMIN_NOTIFY_EMAIL;
    await resetDb(t.prisma);
    t.payments.reset();
    catalog = await seedCatalog(t.prisma);
    await t.prisma.siteConfig.create({ data: { id: 'default', contactEmail: STORE_INBOX } });
    mail.clear();
  });

  const stockOf = async (id: string) => (await t.prisma.productVariant.findUniqueOrThrow({ where: { id } })).stockQuantity;

  async function guestOrder(opts: { pay?: boolean; quantity?: number; email?: string; inbox?: string; extra?: Record<string, unknown> } = {}) {
    const { pay = true, quantity = 1, email = 'buyer@example.test', inbox = STORE_INBOX, extra = {} } = opts;
    const guest = t.agent();
    await guest.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity }).expect(201);
    const res = await guest.post('/v1/orders').send({ ...SHIPPING, customerEmail: email, ...extra }).expect(201);
    const token = res.body.accessToken as string;
    if (pay) {
      await t.http().post('/v1/payment/charge').set('X-Order-Token', token).send({ orderId: res.body.id, method: 'bit' }).expect(200);
      await waitForEmail(mail, (m) => m.to === email && m.subject.includes(res.body.orderNumber));
      await waitForEmail(mail, (m) => m.to === inbox && m.subject.includes(res.body.orderNumber));
    }
    return { order: res.body as { id: string; orderNumber: string; total: string }, token };
  }

  describe('checkout concurrency', () => {
    it('a double-submitted cart creates exactly one order and decrements stock once', async () => {
      const guest = t.agent();
      await guest.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 2 }).expect(201);
      const body = { ...SHIPPING, customerEmail: 'dbl@example.test' };
      const results = await Promise.all([guest.post('/v1/orders').send(body), guest.post('/v1/orders').send(body), guest.post('/v1/orders').send(body)]);
      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual([201, 400, 400]);
      expect(results.find((r) => r.status === 400)!.body.code).toBe('CART_EMPTY');
      expect(await t.prisma.order.count()).toBe(1);
      expect(await stockOf(catalog.inStock.id)).toBe(3);
      expect(await t.prisma.cartItem.count()).toBe(0);
    });

    it('checkouts that buy the same variants in opposite order never 500 or deadlock', async () => {
      const [a, b] = [catalog.inStock, catalog.lowStock];
      await t.prisma.productVariant.updateMany({ where: { id: { in: [a.id, b.id] } }, data: { stockQuantity: 100 } });
      const carts = await Promise.all(
        Array.from({ length: 8 }, async (_, i) => {
          const agent = t.agent();
          const [first, second] = i % 2 === 0 ? [a, b] : [b, a];
          await agent.post('/v1/cart/items').send({ variantId: first.id, quantity: 1 }).expect(201);
          await agent.post('/v1/cart/items').send({ variantId: second.id, quantity: 1 }).expect(201);
          return agent;
        }),
      );
      const results = await Promise.all(carts.map((agent) => agent.post('/v1/orders').send({ ...SHIPPING, customerEmail: 'x@example.test' })));
      expect(results.map((r) => r.status)).toEqual(Array(8).fill(201));
      expect(await stockOf(a.id)).toBe(92);
      expect(await stockOf(b.id)).toBe(92);
    });

    it('never oversells: parallel checkouts for the last unit yield one order', async () => {
      await t.prisma.productVariant.update({ where: { id: catalog.inStock.id }, data: { stockQuantity: 1 } });
      const agents = await Promise.all(
        Array.from({ length: 5 }, async () => {
          const agent = t.agent();
          await agent.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 1 }).expect(201);
          return agent;
        }),
      );
      const results = await Promise.all(agents.map((agent) => agent.post('/v1/orders').send({ ...SHIPPING, customerEmail: 'z@example.test' })));
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(results.filter((r) => r.status === 400).every((r) => r.body.code === 'OUT_OF_STOCK')).toBe(true);
      expect(await stockOf(catalog.inStock.id)).toBe(0);
    });

    it('retries with a fresh order number when two checkouts draw the same one', async () => {
      const guest = t.agent();
      await guest.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 1 }).expect(201);
      const collision = 'BA-COLLIDE-000001';
      await t.prisma.order.create({
        data: {
          orderNumber: collision,
          customerEmail: 'old@example.test',
          subtotal: 1,
          shippingCost: 0,
          total: 1,
          shippingCity: 'x',
          shippingStreet: 'x',
          shippingNumber: '1',
        },
      });
      // The first number drawn is taken by "another checkout"; the second is free.
      const draw = jest.spyOn(orderNumbers, 'next').mockReturnValueOnce(collision);
      const res = await guest.post('/v1/orders').send({ ...SHIPPING, customerEmail: 'new@example.test' });
      expect([res.status, res.body.code]).toEqual([201, undefined]);
      expect(draw).toHaveBeenCalledTimes(2);
      expect(res.body.orderNumber).not.toBe(collision);
      expect(await t.prisma.order.count()).toBe(2);
      expect(await stockOf(catalog.inStock.id)).toBe(4); // the failed attempt rolled back
      expect(await t.prisma.cartItem.count()).toBe(0);
    });
  });

  describe('money', () => {
    it('adds prices, shipping and discount exactly (no float drift)', async () => {
      await t.prisma.product.update({ where: { id: catalog.product.id }, data: { basePrice: '33.33' } });
      await t.prisma.coupon.create({ data: { code: 'TEN', discountType: 'PERCENTAGE', value: 10 } });
      const guest = t.agent();
      await guest.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 3 }).expect(201);
      const res = await guest.post('/v1/orders').send({ ...SHIPPING, customerEmail: 'm@example.test', couponCode: 'ten' }).expect(201);
      // 3 x 33.33 = 99.99; 10% = 10.00 (rounded); courier 29.90
      expect(res.body.subtotal).toBe('99.99');
      expect(res.body.discountAmount).toBe('10');
      expect(res.body.shippingCost).toBe('29.9');
      expect(res.body.total).toBe('119.89');
    });

    it('keeps shipping on a fully discounted cart', async () => {
      await t.prisma.coupon.create({ data: { code: 'FREE', discountType: 'PERCENTAGE', value: 100 } });
      const guest = t.agent();
      await guest.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 1 }).expect(201);
      const res = await guest.post('/v1/orders').send({ ...SHIPPING, customerEmail: 'f@example.test', couponCode: 'FREE' }).expect(201);
      expect(res.body.subtotal).toBe('100');
      expect(res.body.discountAmount).toBe('100');
      expect(res.body.total).toBe('29.9');
    });
  });

  describe('Back Soon', () => {
    it('refuses to order a product that went Back Soon after it was added to the cart', async () => {
      const guest = t.agent();
      await guest.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 1 }).expect(201);
      await t.prisma.product.update({ where: { id: catalog.product.id }, data: { backSoon: true } });
      const res = await guest.post('/v1/orders').send({ ...SHIPPING, customerEmail: 'b@example.test' }).expect(400);
      expect(res.body.code).toBe('VARIANT_UNAVAILABLE');
      expect(await stockOf(catalog.inStock.id)).toBe(5);
    });
  });

  describe('status history and fulfilment timestamps', () => {
    it('records every change with who made it, and keeps shipped/delivered timestamps consistent', async () => {
      const { order } = await guestOrder();
      const admin = await signUp(t, { admin: true });
      const put = (status: string) => admin.agent.put(`/v1/admin/orders/${order.id}/status`).send({ status, trackingNumber: 'IL9' });
      const row = () => t.prisma.order.findUniqueOrThrow({ where: { id: order.id } });

      await put('PROCESSING').expect(200);
      await put('SHIPPED').expect(200);
      let r = await row();
      expect(r.shippedAt).toBeInstanceOf(Date);
      expect(r.deliveredAt).toBeNull();
      await put('DELIVERED').expect(200);
      r = await row();
      expect(r.deliveredAt).toBeInstanceOf(Date);
      expect(r.paidAt).toBeInstanceOf(Date);

      // An admin correcting a mistake clears the later stamps.
      await put('SHIPPED').expect(200);
      expect((await row()).deliveredAt).toBeNull();
      await put('PROCESSING').expect(200);
      expect((await row()).shippedAt).toBeNull();

      const detail = await admin.agent.get(`/v1/admin/orders/${order.id}`).expect(200);
      const events = detail.body.statusEvents as { fromStatus: string | null; toStatus: string; changedByEmail: string | null }[];
      expect(events.map((e) => [e.fromStatus, e.toStatus, e.changedByEmail])).toEqual([
        [null, 'PENDING_PAYMENT', 'buyer@example.test'],
        ['PENDING_PAYMENT', 'CONFIRMED', 'buyer@example.test'],
        ['CONFIRMED', 'PROCESSING', admin.email],
        ['PROCESSING', 'SHIPPED', admin.email],
        ['SHIPPED', 'DELIVERED', admin.email],
        ['DELIVERED', 'SHIPPED', admin.email],
        ['SHIPPED', 'PROCESSING', admin.email],
      ]);
    });

    it('the unpaid-order sweeper is a system change: event without an actor, and no email', async () => {
      const { order } = await guestOrder({ pay: false });
      await t.prisma.order.update({ where: { id: order.id }, data: { createdAt: new Date(Date.now() - 2 * 3600_000) } });
      mail.clear();
      expect(await t.app.get(OrdersService).releaseExpiredPendingOrders(3600_000)).toBe(1);
      const events = await t.prisma.orderStatusEvent.findMany({ where: { orderId: order.id }, orderBy: { createdAt: 'asc' } });
      expect(events.map((e) => [e.toStatus, e.changedByEmail])).toEqual([
        ['PENDING_PAYMENT', 'buyer@example.test'],
        ['CANCELLED', null],
      ]);
      expect((await settledEmails(mail)).filter((m) => m.subject.includes(order.orderNumber))).toHaveLength(0);
      expect(await t.prisma.refund.count()).toBe(0);
      expect(await stockOf(catalog.inStock.id)).toBe(5);
    });

    it('lets the customer see the history (without who changed it) and their refunds', async () => {
      const { order, token } = await guestOrder();
      const view = await t.http().get(`/v1/orders/${order.id}`).set('X-Order-Token', token).expect(200);
      expect(view.body.statusEvents.map((e: { toStatus: string }) => e.toStatus)).toEqual(['PENDING_PAYMENT', 'CONFIRMED']);
      expect(view.body.statusEvents[0].changedByEmail).toBeUndefined();
      expect(view.body.refunds).toEqual([]);
    });
  });

  describe('emails', () => {
    it('in-progress goes to the customer; shipped and delivered too, each with the order number', async () => {
      const { order } = await guestOrder();
      const admin = await signUp(t, { admin: true });
      mail.clear();
      await admin.agent.put(`/v1/admin/orders/${order.id}/status`).send({ status: 'PROCESSING' }).expect(200);
      const processing = await waitForEmail(mail, (m) => m.to === 'buyer@example.test');
      expect(processing.subject).toContain(order.orderNumber);
      await admin.agent.put(`/v1/admin/orders/${order.id}/status`).send({ status: 'SHIPPED', trackingNumber: 'IL1' }).expect(200);
      await waitForEmail(mail, (m) => m.subject.includes(order.orderNumber) && m.subject.includes('נשלחה'));
      await admin.agent.put(`/v1/admin/orders/${order.id}/status`).send({ status: 'DELIVERED' }).expect(200);
      await waitForEmail(mail, (m) => m.subject.includes(order.orderNumber) && m.subject.includes('נמסרה'));
      expect((await settledEmails(mail)).every((m) => m.to === 'buyer@example.test')).toBe(true);
    });

    it('the business alert lists every item with colour and size, address, contact and payment method', async () => {
      const { order } = await guestOrder({ quantity: 2, extra: { shippingApartment: '7', shippingZip: '12345' } });
      const alert = await waitForEmail(mail, (m) => m.to === STORE_INBOX && m.subject.includes(order.orderNumber));
      expect(alert.subject).toContain('הזמנה חדשה');
      for (const piece of ['בגד ים', 'Black', 'M', 'Dizengoff 1', 'Tel Aviv', 'דירה 7', 'Dana Levi', '050-1234567', 'buyer@example.test', 'Bit']) {
        expect(alert.text).toContain(piece);
      }
      expect(alert.text).toContain('2 × בגד ים');
    });

    it('goes to ADMIN_NOTIFY_EMAIL first, then the site contact email', async () => {
      process.env.ADMIN_NOTIFY_EMAIL = 'ops@example.test';
      const { order } = await guestOrder({ inbox: 'ops@example.test' });
      const ops = await waitForEmail(mail, (m) => m.to === 'ops@example.test' && m.subject.includes(order.orderNumber));
      expect(ops.subject).toContain(order.orderNumber);
      expect(mail.sent.some((m) => m.to === STORE_INBOX && m.subject.includes(order.orderNumber))).toBe(false);
    });

    it('admin can resend any order email; each is re-rendered, logged, and refused for the wrong state', async () => {
      const { order } = await guestOrder();
      const admin = await signUp(t, { admin: true });
      const resend = (template: string) => admin.agent.post(`/v1/admin/orders/${order.id}/resend-email`).send({ template });

      await t.http().post(`/v1/admin/orders/${order.id}/resend-email`).send({ template: 'order-confirmation' }).expect(401);
      await resend('bogus').expect(400);
      await resend('order-shipped').expect(409);
      await resend('order-cancelled').expect(409);
      await resend('refund-completed').expect(409);

      mail.clear();
      for (const template of ['order-confirmation', 'admin-new-order']) {
        const res = await resend(template).expect(200);
        expect(res.body.status).toBe('SENT');
      }
      expect(mail.sent.map((m) => m.to).sort()).toEqual(['buyer@example.test', STORE_INBOX]);
      expect(mail.sent.every((m) => m.subject.includes(order.orderNumber))).toBe(true);

      await admin.agent.put(`/v1/admin/orders/${order.id}/status`).send({ status: 'SHIPPED', trackingNumber: 'IL1' }).expect(200);
      await resend('order-shipped').expect(200);
      await resend('order-processing').expect(200);
      await admin.agent.put(`/v1/admin/orders/${order.id}/status`).send({ status: 'DELIVERED' }).expect(200);
      await resend('order-delivered').expect(200);

      await admin.agent.post(`/v1/admin/orders/${order.id}/cancel`).send({ refund: true }).expect(200);
      await resend('order-cancelled').expect(200);
      await resend('refund-completed').expect(200);

      const logs = await admin.agent.get(`/v1/admin/orders/${order.id}/emails`).expect(200);
      const templates = (logs.body as { template: string }[]).map((l) => l.template);
      for (const name of ['order-confirmation', 'admin-new-order', 'order-shipped', 'order-delivered', 'order-cancelled', 'refund-completed', 'admin-order-cancelled']) {
        expect(templates).toContain(name);
      }
    });
  });

  describe('refunds', () => {
    it('admin setting REFUNDED on a paid order goes through a Refund record and restocks once', async () => {
      const { order } = await guestOrder({ quantity: 2 });
      expect(await stockOf(catalog.inStock.id)).toBe(3);
      t.payments.failRefunds = true; // the provider cannot settle: the admin does it by hand
      const admin = await signUp(t, { admin: true });
      const res = await admin.agent.put(`/v1/admin/orders/${order.id}/status`).send({ status: 'REFUNDED' }).expect(200);
      expect(res.body.status).toBe('REFUNDED');
      expect(res.body.allowedTransitions).toEqual([]);
      expect(res.body.refunds).toEqual([expect.objectContaining({ status: 'COMPLETED', completedByEmail: admin.email })]);
      expect(await stockOf(catalog.inStock.id)).toBe(5);
      const events = (await t.prisma.orderStatusEvent.findMany({ where: { orderId: order.id }, orderBy: { createdAt: 'asc' } })).map((e) => e.toStatus);
      expect(events).toEqual(['PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'REFUNDED']);
      await admin.agent.put(`/v1/admin/orders/${order.id}/status`).send({ status: 'CANCELLED' }).expect(409);
      expect(await stockOf(catalog.inStock.id)).toBe(5);
    });

    it('REFUNDED is refused for an order that was never paid', async () => {
      const { order } = await guestOrder({ pay: false });
      const admin = await signUp(t, { admin: true });
      await admin.agent.put(`/v1/admin/orders/${order.id}/status`).send({ status: 'REFUNDED' }).expect(409);
      await admin.agent.put(`/v1/admin/orders/${order.id}/status`).send({ status: 'CANCELLED' }).expect(200);
      await admin.agent.put(`/v1/admin/orders/${order.id}/status`).send({ status: 'REFUNDED' }).expect(409);
    });

    it('two concurrent cancels restock once and create one Refund', async () => {
      const { order } = await guestOrder({ quantity: 2 });
      t.payments.failRefunds = true;
      const admin = await signUp(t, { admin: true });
      const results = await Promise.all([
        admin.agent.put(`/v1/admin/orders/${order.id}/status`).send({ status: 'CANCELLED' }),
        admin.agent.put(`/v1/admin/orders/${order.id}/status`).send({ status: 'CANCELLED' }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(await stockOf(catalog.inStock.id)).toBe(5);
      expect(await t.prisma.refund.count()).toBe(1);
    });

    it('an admin can mark a refund failed; it stays visible and can still be completed', async () => {
      const { order } = await guestOrder();
      t.payments.failRefunds = true;
      const admin = await signUp(t, { admin: true });
      await admin.agent.put(`/v1/admin/orders/${order.id}/status`).send({ status: 'CANCELLED' }).expect(200);
      const refund = await t.prisma.refund.findFirstOrThrow({ where: { orderId: order.id } });
      const failed = await admin.agent.post(`/v1/admin/refunds/${refund.id}/fail`).send({ note: 'Card closed' }).expect(200);
      expect(failed.body).toMatchObject({ status: 'FAILED', note: 'Card closed' });
      const failedList = await admin.agent.get('/v1/admin/refunds').query({ status: 'FAILED' }).expect(200);
      expect(failedList.body.total).toBe(1);
      await admin.agent.post(`/v1/admin/refunds/${refund.id}/fail`).send({}).expect(409);
      await admin.agent.post(`/v1/admin/refunds/${refund.id}/complete`).send({ providerRef: 'bank' }).expect(200);
      expect((await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('REFUNDED');
      await admin.agent.post('/v1/admin/refunds/nope/complete').send({}).expect(404);
      await admin.agent.get('/v1/admin/refunds').query({ status: 'WHATEVER' }).expect(400);
    });

    it('a charge that lands after the order was cancelled is refunded and leaves a durable record', async () => {
      const guest = t.agent();
      await guest.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 1 }).expect(201);
      const res = await guest.post('/v1/orders').send({ ...SHIPPING, customerEmail: 'late@example.test' }).expect(201);
      const admin = await signUp(t, { admin: true });
      t.payments.delayMs = 300;
      const charging = t.http().post('/v1/payment/charge').set('X-Order-Token', res.body.accessToken).send({ orderId: res.body.id });
      const inFlight = charging.then((r) => r);
      await new Promise((r) => setTimeout(r, 120));
      await admin.agent.put(`/v1/admin/orders/${res.body.id}/status`).send({ status: 'CANCELLED' }).expect(200);
      const charged = await inFlight;
      expect(charged.status).toBe(409);
      expect(t.payments.refunds).toEqual(['spy_1']);
      const refund = await t.prisma.refund.findFirstOrThrow({ where: { orderId: res.body.id } });
      expect(refund.status).toBe('COMPLETED');
      expect(Number(refund.amount)).toBe(Number(res.body.total));

      // When the provider cannot refund it either, the record stays PENDING for an admin.
      await t.prisma.productVariant.update({ where: { id: catalog.inStock.id }, data: { stockQuantity: 5 } });
      await guest.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 1 }).expect(201);
      const second = await guest.post('/v1/orders').send({ ...SHIPPING, customerEmail: 'late@example.test' }).expect(201);
      t.payments.failRefunds = true;
      const charging2 = t.http().post('/v1/payment/charge').set('X-Order-Token', second.body.accessToken).send({ orderId: second.body.id });
      const inFlight2 = charging2.then((r) => r);
      await new Promise((r) => setTimeout(r, 120));
      await admin.agent.put(`/v1/admin/orders/${second.body.id}/status`).send({ status: 'CANCELLED' }).expect(200);
      await inFlight2;
      const pending = await t.prisma.refund.findFirstOrThrow({ where: { orderId: second.body.id } });
      expect(pending.status).toBe('PENDING');
      expect(pending.note).toContain('spy_');
    });
  });

  describe('admin order list', () => {
    it('filters by Israel calendar day (from/to), status and search; the CSV honours the same filters', async () => {
      const { order: a } = await guestOrder({ email: 'a@example.test' });
      await t.prisma.productVariant.update({ where: { id: catalog.inStock.id }, data: { stockQuantity: 5 } });
      const { order: b } = await guestOrder({ email: 'b@example.test', pay: false });
      // a: just before the Israel midnight that starts 2026-03-02 (winter, UTC+2 -> 21:59Z on the 1st is still the 2nd? no: 22:00Z is midnight)
      await t.prisma.order.update({ where: { id: a.id }, data: { createdAt: new Date('2026-03-01T21:59:59.000Z') } }); // 23:59:59 on Mar 1 in Israel
      await t.prisma.order.update({ where: { id: b.id }, data: { createdAt: new Date('2026-03-01T22:00:00.000Z') } }); // 00:00 on Mar 2 in Israel
      const admin = await signUp(t, { admin: true });

      const day1 = await admin.agent.get('/v1/admin/orders').query({ from: '2026-03-01', to: '2026-03-01' }).expect(200);
      expect(day1.body.orders.map((o: { id: string }) => o.id)).toEqual([a.id]);
      const day2 = await admin.agent.get('/v1/admin/orders').query({ from: '2026-03-02', to: '2026-03-02' }).expect(200);
      expect(day2.body.orders.map((o: { id: string }) => o.id)).toEqual([b.id]);
      const both = await admin.agent.get('/v1/admin/orders').query({ from: '2026-03-01', to: '2026-03-02' }).expect(200);
      expect(both.body.total).toBe(2);
      const fromOnly = await admin.agent.get('/v1/admin/orders').query({ from: '2026-03-02' }).expect(200);
      expect(fromOnly.body.orders.map((o: { id: string }) => o.id)).toEqual([b.id]);
      const pendingOnly = await admin.agent.get('/v1/admin/orders').query({ from: '2026-03-01', to: '2026-03-02', status: 'PENDING_PAYMENT' }).expect(200);
      expect(pendingOnly.body.orders.map((o: { id: string }) => o.id)).toEqual([b.id]);
      const searched = await admin.agent.get('/v1/admin/orders').query({ search: a.orderNumber }).expect(200);
      expect(searched.body.orders.map((o: { id: string }) => o.id)).toEqual([a.id]);

      // Cards need the timeline, refunds and payment facts in the list itself.
      const first = both.body.orders.find((o: { id: string }) => o.id === a.id);
      expect(first.statusEvents).toHaveLength(2);
      expect(first.refunds).toEqual([]);
      expect(first.paymentMethod).toBe('bit');

      await admin.agent.get('/v1/admin/orders').query({ from: '2026-02-30' }).expect(400);
      await admin.agent.get('/v1/admin/orders').query({ from: 'yesterday' }).expect(400);

      const csv = await admin.agent.get('/v1/admin/orders/export').query({ from: '2026-03-02', to: '2026-03-02', status: 'PENDING_PAYMENT' }).expect(200);
      expect(csv.text).toContain(b.orderNumber);
      expect(csv.text).not.toContain(a.orderNumber);
      const csvSearch = await admin.agent.get('/v1/admin/orders/export').query({ search: 'a@example.test' }).expect(200);
      expect(csvSearch.text).toContain(a.orderNumber);
      expect(csvSearch.text).not.toContain(b.orderNumber);
    });
  });
});
