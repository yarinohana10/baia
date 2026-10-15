import { createTestApp, resetDb, seedCatalog, signUp, type TestApp } from './app';

describe('Cart & wishlist isolation, guest cart cookie, merge on login (e2e)', () => {
  let t: TestApp;
  let catalog: Awaited<ReturnType<typeof seedCatalog>>;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(async () => t.close());
  beforeEach(async () => {
    await resetDb(t.prisma);
    catalog = await seedCatalog(t.prisma);
  });

  describe('guest cart cookie', () => {
    it('mints an httpOnly cookie on first add and stores only its hash', async () => {
      const guest = t.agent();
      const res = await guest.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 1 }).expect(201);
      const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('baia_cart='));
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      const raw = decodeURIComponent(cookie!.split(';')[0].split('=')[1]);
      expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/);

      const cart = await t.prisma.cart.findFirstOrThrow();
      expect(cart.sessionId).toMatch(/^[0-9a-f]{64}$/);
      expect(cart.sessionId).not.toBe(raw);
      expect(res.body.userId).toBeUndefined();
      expect(res.body.sessionId).toBeUndefined();

      const again = await guest.get('/v1/cart').expect(200);
      expect(again.body.items).toHaveLength(1);
    });

    it('anonymous GET /cart does not create rows', async () => {
      const res = await t.http().get('/v1/cart').expect(200);
      expect(res.body.items).toEqual([]);
      expect(await t.prisma.cart.count()).toBe(0);
    });

    it('ignores the legacy x-guest-session header (cannot be used to read another cart)', async () => {
      const guest = t.agent();
      await guest.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 1 }).expect(201);
      const cart = await t.prisma.cart.findFirstOrThrow();
      const res = await t.http().get('/v1/cart').set('x-guest-session', cart.sessionId!).expect(200);
      expect(res.body.items).toEqual([]);
    });

    it("guest A cannot modify guest B's items", async () => {
      const a = t.agent();
      const b = t.agent();
      await a.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 1 }).expect(201);
      const { body } = await b.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 1 }).expect(201);
      const itemB = body.items[0].id;
      await a.put(`/v1/cart/items/${itemB}`).send({ quantity: 3 }).expect(404);
      await a.delete(`/v1/cart/items/${itemB}`).expect(404);
      expect((await t.prisma.cartItem.findUniqueOrThrow({ where: { id: itemB } })).quantity).toBe(1);
    });
  });

  describe('user carts', () => {
    it("user A cannot read or modify user B's cart (404)", async () => {
      const a = await signUp(t);
      const b = await signUp(t);
      const { body } = await b.agent.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 1 }).expect(201);
      const itemB = body.items[0].id;

      const aCart = await a.agent.get('/v1/cart').expect(200);
      expect(aCart.body.items).toEqual([]);
      await a.agent.put(`/v1/cart/items/${itemB}`).send({ quantity: 2 }).expect(404);
      await a.agent.delete(`/v1/cart/items/${itemB}`).expect(404);
      expect(await t.prisma.cartItem.count({ where: { id: itemB } })).toBe(1);
    });

    it('validates quantities and stock', async () => {
      const a = await signUp(t);
      await a.agent.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 0 }).expect(400);
      await a.agent.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 'lots' }).expect(400);
      await a.agent.post('/v1/cart/items').send({ variantId: catalog.lowStock.id, quantity: 3 }).expect(400);
    });
  });

  describe('merge on login', () => {
    it('requires a session', async () => {
      await t.http().post('/v1/cart/merge').expect(401);
    });

    it('merges respecting stock and variant validity, then drops the guest cart', async () => {
      // Same browser: shop as a guest, then sign up.
      const browser = t.agent();
      await browser.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 4 }).expect(201);
      await browser.post('/v1/cart/items').send({ variantId: catalog.lowStock.id, quantity: 2 }).expect(201);
      const extra = await t.prisma.productVariant.create({
        data: { productId: catalog.product.id, color: 'Red', size: 'S', sku: `X-${Date.now()}`, stockQuantity: 9 },
      });
      await browser.post('/v1/cart/items').send({ variantId: extra.id, quantity: 1 }).expect(201);
      const guestCart = await t.prisma.cart.findFirstOrThrow({ where: { userId: null } });

      const user = await signUp(t, { agent: browser });
      // The account already had a cart line for lowStock (e.g. from another device).
      const userCart = await t.prisma.cart.create({ data: { userId: user.user.id } });
      await t.prisma.cartItem.create({ data: { cartId: userCart.id, variantId: catalog.lowStock.id, quantity: 1 } });

      // Meanwhile stock changes and one variant is deactivated.
      await t.prisma.productVariant.update({ where: { id: extra.id }, data: { isActive: false } });
      await t.prisma.productVariant.update({ where: { id: catalog.inStock.id }, data: { stockQuantity: 3 } });

      const res = await browser.post('/v1/cart/merge').expect(200);

      expect(res.body.dropped).toEqual([{ variantId: extra.id, reason: 'unavailable' }]);
      expect(res.body.adjusted).toEqual(
        expect.arrayContaining([
          { variantId: catalog.inStock.id, requested: 4, quantity: 3 },
          { variantId: catalog.lowStock.id, requested: 3, quantity: 2 },
        ]),
      );
      const qty = Object.fromEntries(
        res.body.cart.items.map((i: { variantId: string; quantity: number }) => [i.variantId, i.quantity]),
      );
      expect(qty).toEqual({ [catalog.inStock.id]: 3, [catalog.lowStock.id]: 2 });

      // Guest cart and its items are gone; cookie cleared.
      expect(await t.prisma.cart.count({ where: { id: guestCart.id } })).toBe(0);
      expect(await t.prisma.cartItem.count({ where: { cartId: guestCart.id } })).toBe(0);
      const cleared = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('baia_cart='));
      expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
    });

    it('drops out-of-stock lines', async () => {
      const browser = t.agent();
      await browser.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 1 }).expect(201);
      await t.prisma.productVariant.update({ where: { id: catalog.inStock.id }, data: { stockQuantity: 0 } });
      await signUp(t, { agent: browser });
      const res = await browser.post('/v1/cart/merge').expect(200);
      expect(res.body.dropped).toEqual([{ variantId: catalog.inStock.id, reason: 'out_of_stock' }]);
      expect(res.body.cart.items).toEqual([]);
    });

    it('merging twice is harmless', async () => {
      const browser = t.agent();
      await browser.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 1 }).expect(201);
      await signUp(t, { agent: browser });
      await browser.post('/v1/cart/merge').expect(200);
      const second = await browser.post('/v1/cart/merge').expect(200);
      expect(second.body.merged).toBe(0);
      expect(second.body.cart.items[0].quantity).toBe(1);
    });

    it("cannot merge someone else's guest cart (guest cart is taken only from the caller's cookie)", async () => {
      const victim = t.agent();
      await victim.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 1 }).expect(201);
      const attacker = await signUp(t);
      const victimCart = await t.prisma.cart.findFirstOrThrow({ where: { userId: null } });
      const res = await attacker.agent.post('/v1/cart/merge').send({ sessionId: victimCart.sessionId }).expect(200);
      expect(res.body.cart.items).toEqual([]);
      expect(await t.prisma.cart.count({ where: { id: victimCart.id } })).toBe(1);
    });
  });

  describe('wishlist', () => {
    it('requires a session (guests keep it locally)', async () => {
      await t.http().get('/v1/wishlist').expect(401);
      await t.http().post(`/v1/wishlist/${catalog.product.id}`).expect(401);
    });

    it("is isolated per user: B cannot see or remove A's entries", async () => {
      const a = await signUp(t);
      const b = await signUp(t);
      await a.agent.post(`/v1/wishlist/${catalog.product.id}`).expect(201);

      expect((await b.agent.get('/v1/wishlist').expect(200)).body).toEqual([]);
      expect((await b.agent.get(`/v1/wishlist/${catalog.product.id}/check`).expect(200)).body.inWishlist).toBe(false);
      await b.agent.delete(`/v1/wishlist/${catalog.product.id}`).expect(200);

      const listA = (await a.agent.get('/v1/wishlist').expect(200)).body;
      expect(listA.map((w: { productId: string }) => w.productId)).toEqual([catalog.product.id]);
    });

    it('merges local ids: dedupes, skips unknown and inactive products', async () => {
      const a = await signUp(t);
      await a.agent.post(`/v1/wishlist/${catalog.product.id}`).expect(201);
      const res = await a.agent
        .post('/v1/wishlist/merge')
        .send({ productIds: [catalog.product.id, catalog.product.id, 'unknown-id', catalog.inactiveProduct.id] })
        .expect(200);
      expect(res.body.map((w: { productId: string }) => w.productId)).toEqual([catalog.product.id]);
      expect(await t.prisma.wishlist.count({ where: { userId: a.user.id } })).toBe(1);
    });

    it('rejects malformed merge payloads', async () => {
      const a = await signUp(t);
      await a.agent.post('/v1/wishlist/merge').send({ productIds: 'nope' }).expect(400);
      await a.agent.post('/v1/wishlist/merge').send({ productIds: ['bad id!'] }).expect(400);
    });
  });
});
