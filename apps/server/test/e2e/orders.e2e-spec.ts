import { createTestApp, resetDb, seedCatalog, signUp, SHIPPING, type TestApp } from './app';

describe('Orders: ownership & guest access tokens (e2e)', () => {
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

  async function guestOrder() {
    const guest = t.agent();
    await guest.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 1 }).expect(201);
    const res = await guest
      .post('/v1/orders')
      .send({ ...SHIPPING, customerEmail: 'guest@example.test' })
      .expect(201);
    return { guest, order: res.body, token: res.body.accessToken as string };
  }

  async function userOrder(agent: Awaited<ReturnType<typeof signUp>>['agent']) {
    await agent.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 1 }).expect(201);
    const res = await agent.post('/v1/orders').send(SHIPPING).expect(201);
    return res.body;
  }

  describe('guest orders', () => {
    it('returns a high-entropy token once and stores only its SHA-256 hash', async () => {
      const { order, token } = await guestOrder();
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/); // 256 bits base64url
      expect(order.accessTokenHash).toBeUndefined();
      expect(order.accessTokenExpiresAt).toBeUndefined();
      expect(order.userId).toBeNull();

      const row = await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(row.accessTokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(row.accessTokenHash).not.toContain(token);
      expect(row.accessTokenExpiresAt!.getTime()).toBeGreaterThan(Date.now());
    });

    it('is 404 without a token', async () => {
      const { order } = await guestOrder();
      await t.http().get(`/v1/orders/${order.id}`).expect(404);
    });

    it('is 404 with a wrong token', async () => {
      const { order, token } = await guestOrder();
      const wrong = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
      await t.http().get(`/v1/orders/${order.id}`).set('X-Order-Token', wrong).expect(404);
    });

    it("is 404 with another order's token", async () => {
      const a = await guestOrder();
      await t.prisma.productVariant.update({ where: { id: catalog.inStock.id }, data: { stockQuantity: 5 } });
      const b = await guestOrder();
      await t.http().get(`/v1/orders/${a.order.id}`).set('X-Order-Token', b.token).expect(404);
    });

    it('is 404 with an expired token', async () => {
      const { order, token } = await guestOrder();
      await t.prisma.order.update({
        where: { id: order.id },
        data: { accessTokenExpiresAt: new Date(Date.now() - 1000) },
      });
      await t.http().get(`/v1/orders/${order.id}`).set('X-Order-Token', token).expect(404);
    });

    it('returns the order with a valid token, without private fields', async () => {
      const { order, token } = await guestOrder();
      const res = await t.http().get(`/v1/orders/${order.id}`).set('X-Order-Token', token).expect(200);
      expect(res.body.id).toBe(order.id);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.accessTokenHash).toBeUndefined();
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('a missing order and a forbidden order are indistinguishable', async () => {
      const { order } = await guestOrder();
      const forbidden = await t.http().get(`/v1/orders/${order.id}`).expect(404);
      const missing = await t.http().get('/v1/orders/does-not-exist').expect(404);
      expect(forbidden.body).toEqual(missing.body);
    });

    it('exchanges the token for an httpOnly cookie scoped to that order', async () => {
      const { order, token } = await guestOrder();
      const browser = t.agent();
      const res = await browser.post(`/v1/orders/${order.id}/access`).send({ token }).expect(200);
      const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('baia_ot_'));
      expect(cookie).toBeDefined();
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).toContain(`Path=/v1/orders/${order.id}`);

      // Refresh: the cookie alone is enough.
      await browser.get(`/v1/orders/${order.id}`).expect(200);
    });

    it('rejects the exchange with a wrong token and sets no cookie', async () => {
      const { order } = await guestOrder();
      const res = await t.http().post(`/v1/orders/${order.id}/access`).send({ token: 'x'.repeat(43) }).expect(404);
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('ignores client-supplied cartId / userId / totals', async () => {
      const victim = await signUp(t);
      const guest = t.agent();
      await guest.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 1 }).expect(201);
      const res = await guest
        .post('/v1/orders')
        .send({ ...SHIPPING, customerEmail: 'g@example.test', userId: victim.user.id, total: 1, subtotal: 1, cartId: 'x' })
        .expect(201);
      expect(res.body.userId).toBeNull();
      expect(Number(res.body.subtotal)).toBe(100);
    });

    it('cannot order from a cart identified by a spoofed x-guest-session header', async () => {
      const guest = t.agent();
      await guest.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 1 }).expect(201);
      const cart = await t.prisma.cart.findFirstOrThrow();
      await t
        .http()
        .post('/v1/orders')
        .set('x-guest-session', cart.sessionId!)
        .send({ ...SHIPPING, customerEmail: 'g@example.test' })
        .expect(400);
    });

    it('rejects invalid input via the DTO', async () => {
      await t.http().post('/v1/orders').send({ customerEmail: 'not-an-email' }).expect(400);
    });
  });

  describe('logged-in users', () => {
    it('binds the order to the user and issues no guest token', async () => {
      const a = await signUp(t);
      const order = await userOrder(a.agent);
      expect(order.userId).toBe(a.user.id);
      expect(order.accessToken).toBeUndefined();
      expect(order.customerEmail).toBe(a.email);
      const row = await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(row.accessTokenHash).toBeNull();
    });

    it("user A cannot read user B's order (404); B can", async () => {
      const a = await signUp(t);
      const b = await signUp(t);
      const order = await userOrder(b.agent);
      await a.agent.get(`/v1/orders/${order.id}`).expect(404);
      await b.agent.get(`/v1/orders/${order.id}`).expect(200);
    });

    it('a logged-in user cannot read a guest order without its token', async () => {
      const a = await signUp(t);
      const guest = t.agent();
      await guest.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 1 }).expect(201);
      const { body } = await guest.post('/v1/orders').send({ ...SHIPPING, customerEmail: a.email }).expect(201);
      await a.agent.get(`/v1/orders/${body.id}`).expect(404);
    });

    it('/orders/my returns only the caller’s orders', async () => {
      const a = await signUp(t);
      const b = await signUp(t);
      const orderA = await userOrder(a.agent);
      const orderB = await userOrder(b.agent);
      const res = await a.agent.get('/v1/orders/my').expect(200);
      const ids = res.body.map((o: { id: string }) => o.id);
      expect(ids).toEqual([orderA.id]);
      expect(ids).not.toContain(orderB.id);
      expect(res.body[0].accessTokenHash).toBeUndefined();
    });

    it('/orders/my requires a session', async () => {
      await t.http().get('/v1/orders/my').expect(401);
    });
  });

  describe('admins', () => {
    it('can read any order, including guest orders', async () => {
      const admin = await signUp(t, { admin: true });
      const b = await signUp(t);
      const order = await userOrder(b.agent);
      await admin.agent.get(`/v1/orders/${order.id}`).expect(200);

      const { order: gOrder } = await guestOrder();
      await admin.agent.get(`/v1/orders/${gOrder.id}`).expect(200);
    });

    it('non-admins cannot use admin order routes', async () => {
      const a = await signUp(t);
      await a.agent.get('/v1/admin/orders').expect(403);
    });

    it('filters the list by search (order number, email, recipient) and status', async () => {
      const admin = await signUp(t, { admin: true });
      const { order } = await guestOrder();

      const byNumber = await admin.agent
        .get('/v1/admin/orders')
        .query({ search: order.orderNumber.toLowerCase() })
        .expect(200);
      expect(byNumber.body.orders.map((o: { id: string }) => o.id)).toEqual([order.id]);

      const byEmail = await admin.agent.get('/v1/admin/orders').query({ search: 'GUEST@EXAMPLE' }).expect(200);
      expect(byEmail.body.total).toBe(1);

      const byName = await admin.agent.get('/v1/admin/orders').query({ search: 'dana lev' }).expect(200);
      expect(byName.body.total).toBe(1);

      const none = await admin.agent.get('/v1/admin/orders').query({ search: 'nobody-here' }).expect(200);
      expect(none.body.total).toBe(0);

      const pending = await admin.agent.get('/v1/admin/orders').query({ status: 'PENDING_PAYMENT' }).expect(200);
      expect(pending.body.total).toBe(1);
      const shipped = await admin.agent.get('/v1/admin/orders').query({ status: 'SHIPPED' }).expect(200);
      expect(shipped.body.total).toBe(0);

      await admin.agent.get('/v1/admin/orders').query({ status: 'FOO' }).expect(400);
    });

    it('exposes allowedTransitions on admin routes only', async () => {
      const admin = await signUp(t, { admin: true });
      const { order } = await guestOrder();

      const list = await admin.agent.get('/v1/admin/orders').expect(200);
      expect(list.body.orders[0].allowedTransitions.sort()).toEqual(['CANCELLED', 'CONFIRMED']);

      const one = await admin.agent.get(`/v1/admin/orders/${order.id}`).expect(200);
      expect(one.body.allowedTransitions.sort()).toEqual(['CANCELLED', 'CONFIRMED']);

      const updated = await admin.agent
        .put(`/v1/admin/orders/${order.id}/status`)
        .send({ status: 'CANCELLED' })
        .expect(200);
      expect(updated.body.allowedTransitions).toEqual([]);

      const customer = await admin.agent.get(`/v1/orders/${order.id}`).expect(200);
      expect(customer.body.allowedTransitions).toBeUndefined();
    });
  });

  describe('rate limiting', () => {
    it('limits order lookups per IP', async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 32; i++) {
        statuses.push((await t.http().get('/v1/orders/nope')).status);
      }
      expect(statuses.slice(0, 30).every((s) => s === 404)).toBe(true);
      expect(statuses.slice(30)).toEqual([429, 429]);
    });
  });
});
