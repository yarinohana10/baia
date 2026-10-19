import { createTestApp, resetDb, seedCatalog, signUp, SHIPPING, type TestApp } from './app';

describe('Delivery methods & pickup points (e2e)', () => {
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
    await t.prisma.siteConfig.create({
      data: { id: 'default', shippingCost: 30, pickupPointCost: 15, freeShippingThreshold: 300, courierEtaDays: '3-5', pickupEtaDays: '2-4' },
    });
  });

  const point = (data: Partial<{ name: string; city: string; address: string; isActive: boolean; sortOrder: number }> = {}) =>
    t.prisma.pickupPoint.create({
      data: { name: 'נקודה', city: 'באר שבע', address: 'הרצל 1', hours: 'א-ה 9-18', ...data },
    });

  async function guestWithCart(quantity = 1) {
    const guest = t.agent();
    await guest.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity }).expect(201);
    return guest;
  }

  describe('public pickup points', () => {
    it('lists only active points, sorted, with an optional city filter', async () => {
      await point({ name: 'B', city: 'תל אביב', sortOrder: 2 });
      await point({ name: 'A', city: 'באר שבע', sortOrder: 1 });
      await point({ name: 'Hidden', city: 'באר שבע', isActive: false });

      const all = await t.http().get('/v1/pickup-points').expect(200);
      expect(all.body.map((p: { name: string }) => p.name)).toEqual(['A', 'B']);
      expect(all.body[0]).toEqual({ id: expect.any(String), name: 'A', city: 'באר שבע', address: 'הרצל 1', hours: 'א-ה 9-18' });

      const filtered = await t.http().get('/v1/pickup-points').query({ city: 'תל' }).expect(200);
      expect(filtered.body.map((p: { name: string }) => p.name)).toEqual(['B']);
    });
  });

  describe('admin pickup points', () => {
    it('requires an admin', async () => {
      await t.http().get('/v1/admin/pickup-points').expect(401);
      const customer = await signUp(t);
      await customer.agent.post('/v1/admin/pickup-points').send({ name: 'x', city: 'y', address: 'z' }).expect(403);
    });

    it('creates, lists (incl. inactive), updates and deletes', async () => {
      const admin = await signUp(t, { admin: true });
      const created = await admin.agent
        .post('/v1/admin/pickup-points')
        .send({ name: '  נקודה חדשה ', city: 'חיפה', address: 'הנמל 3', hours: '', sortOrder: 5 })
        .expect(201);
      expect(created.body).toMatchObject({ name: 'נקודה חדשה', city: 'חיפה', hours: null, isActive: true, sortOrder: 5 });

      await admin.agent.post('/v1/admin/pickup-points').send({ name: '', city: 'x', address: 'y' }).expect(400);

      const updated = await admin.agent
        .put(`/v1/admin/pickup-points/${created.body.id}`)
        .send({ isActive: false })
        .expect(200);
      expect(updated.body.isActive).toBe(false);

      const list = await admin.agent.get('/v1/admin/pickup-points').expect(200);
      expect(list.body).toHaveLength(1);
      expect((await t.http().get('/v1/pickup-points').expect(200)).body).toHaveLength(0);

      await admin.agent.delete(`/v1/admin/pickup-points/${created.body.id}`).expect(200);
      await admin.agent.delete(`/v1/admin/pickup-points/${created.body.id}`).expect(404);
    });
  });

  describe('orders', () => {
    it('defaults to courier delivery priced at shippingCost', async () => {
      const guest = await guestWithCart(1);
      const res = await guest.post('/v1/orders').send({ ...SHIPPING, customerEmail: 'a@example.test' }).expect(201);
      expect(res.body).toMatchObject({ deliveryMethod: 'COURIER', shippingCost: '30', total: '130', pickupPointId: null });
    });

    it('prices pickup at pickupPointCost and snapshots the point into the address fields', async () => {
      const p = await point({ name: 'נקודת איסוף - מרכז', city: 'אופקים', address: 'הרצל 10' });
      const guest = await guestWithCart(1);
      const res = await guest
        .post('/v1/orders')
        .send({
          customerEmail: 'a@example.test',
          recipientName: 'Dana',
          phone: '050-1234567',
          deliveryMethod: 'PICKUP_POINT',
          pickupPointId: p.id,
        })
        .expect(201);
      expect(res.body).toMatchObject({
        deliveryMethod: 'PICKUP_POINT',
        pickupPointId: p.id,
        pickupPointName: 'נקודת איסוף - מרכז',
        shippingCity: 'אופקים',
        shippingStreet: 'הרצל 10',
        shippingCost: '15',
        total: '115',
      });
    });

    it('both methods are free at the threshold', async () => {
      const p = await point();
      await t.prisma.productVariant.update({ where: { id: catalog.inStock.id }, data: { stockQuantity: 10 } });
      const courier = await guestWithCart(3);
      const c = await courier.post('/v1/orders').send({ ...SHIPPING, customerEmail: 'a@example.test' }).expect(201);
      expect(c.body.shippingCost).toBe('0');
      const pickup = await guestWithCart(3);
      const r = await pickup
        .post('/v1/orders')
        .send({ customerEmail: 'b@example.test', recipientName: 'B', phone: '050-1234567', deliveryMethod: 'PICKUP_POINT', pickupPointId: p.id })
        .expect(201);
      expect(r.body.shippingCost).toBe('0');
    });

    it('rejects pickup without a point, with an inactive point, and courier without an address', async () => {
      const inactive = await point({ isActive: false });
      const guest = await guestWithCart(1);
      const base = { customerEmail: 'a@example.test', recipientName: 'Dana', phone: '050-1234567' };
      await guest.post('/v1/orders').send({ ...base, deliveryMethod: 'PICKUP_POINT' }).expect(400);
      const bad = await guest
        .post('/v1/orders')
        .send({ ...base, deliveryMethod: 'PICKUP_POINT', pickupPointId: inactive.id })
        .expect(400);
      expect(bad.body.code).toBe('PICKUP_POINT_UNAVAILABLE');
      await guest.post('/v1/orders').send({ ...base, deliveryMethod: 'COURIER' }).expect(400);
      await guest.post('/v1/orders').send({ ...base, deliveryMethod: 'DRONE', ...SHIPPING }).expect(400);
      // Nothing was ordered: the stock is untouched.
      const variant = await t.prisma.productVariant.findUniqueOrThrow({ where: { id: catalog.inStock.id } });
      expect(variant.stockQuantity).toBe(5);
    });

    it('records marketing consent only when ticked, and re-subscribes', async () => {
      const first = await guestWithCart(1);
      await first.post('/v1/orders').send({ ...SHIPPING, customerEmail: 'no@example.test' }).expect(201);
      expect(await t.prisma.newsletterSubscriber.count()).toBe(0);

      await t.prisma.newsletterSubscriber.create({
        data: { email: 'yes@example.test', source: 'footer', unsubscribedAt: new Date() },
      });
      const second = await guestWithCart(1);
      const res = await second
        .post('/v1/orders')
        .send({ ...SHIPPING, customerEmail: 'Yes@Example.test', marketingConsent: true, locale: 'en' })
        .expect(201);
      expect(res.body.marketingConsent).toBe(true);
      const sub = await t.prisma.newsletterSubscriber.findUniqueOrThrow({ where: { email: 'yes@example.test' } });
      expect(sub.unsubscribedAt).toBeNull();
      expect(sub.locale).toBe('en');
    });
  });

  describe('coupons at checkout', () => {
    it('a single-use coupon cannot be used twice by concurrent checkouts', async () => {
      await t.prisma.coupon.create({ data: { code: 'ONCE', discountType: 'PERCENTAGE', value: 10, maxUses: 1 } });
      const a = await guestWithCart(1);
      const b = await guestWithCart(1);
      const body = { ...SHIPPING, customerEmail: 'c@example.test', couponCode: 'ONCE' };
      const results = await Promise.all([a.post('/v1/orders').send(body), b.post('/v1/orders').send(body)]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
      const coupon = await t.prisma.coupon.findUniqueOrThrow({ where: { code: 'ONCE' } });
      expect(coupon.currentUses).toBe(1);
      const ok = results.find((r) => r.status === 201)!;
      // 100 - 10% + 30 shipping
      expect(ok.body).toMatchObject({ discountAmount: '10', total: '120' });
    });
  });

  describe('checkout quote', () => {
    it('quotes both methods for the caller’s cart', async () => {
      const guest = await guestWithCart(2);
      const res = await guest.get('/v1/checkout/quote').expect(200);
      expect(res.body).toEqual({
        subtotal: 200,
        freeShippingThreshold: 300,
        amountToFreeShipping: 100,
        options: [
          { method: 'COURIER', cost: 30, baseCost: 30, etaDays: '3-5' },
          { method: 'PICKUP_POINT', cost: 15, baseCost: 15, etaDays: '2-4' },
        ],
      });
      const empty = await t.http().get('/v1/checkout/quote').expect(200);
      expect(empty.body.subtotal).toBe(0);
    });
  });
});
