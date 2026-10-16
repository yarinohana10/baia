import { createTestApp, resetDb, seedCatalog, signUp, SHIPPING, type TestApp } from './app';
import { OrdersService } from '../../src/orders/orders.service';

describe('Inventory: stock reservation, unlimited stock, restock (e2e)', () => {
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

  const stockOf = async (id: string) =>
    (await t.prisma.productVariant.findUniqueOrThrow({ where: { id } })).stockQuantity;

  async function order(variantId: string, quantity: number) {
    const guest = t.agent();
    await guest.post('/v1/cart/items').send({ variantId, quantity }).expect(201);
    const res = await guest.post('/v1/orders').send({ ...SHIPPING, customerEmail: 'guest@example.test' });
    return res;
  }

  async function unlimitedVariant() {
    return t.prisma.productVariant.create({
      data: {
        productId: catalog.product.id,
        color: 'White',
        size: 'S',
        sku: `UNL-${Date.now()}`,
        stockQuantity: 0,
        trackInventory: false,
      },
    });
  }

  it('decrements stock when an order is placed', async () => {
    const res = await order(catalog.inStock.id, 2);
    expect(res.status).toBe(201);
    expect(await stockOf(catalog.inStock.id)).toBe(3);
  });

  it('refuses to add more than the stock to the cart', async () => {
    const guest = t.agent();
    await guest.post('/v1/cart/items').send({ variantId: catalog.lowStock.id, quantity: 3 }).expect(400);
  });

  it('never oversells under concurrent checkouts', async () => {
    // lowStock has 2 units and three shoppers each try to buy one
    const shoppers = [t.agent(), t.agent(), t.agent()];
    for (const s of shoppers) await s.post('/v1/cart/items').send({ variantId: catalog.lowStock.id, quantity: 1 }).expect(201);
    const results = await Promise.all(
      shoppers.map((s) => s.post('/v1/orders').send({ ...SHIPPING, customerEmail: 'g@example.test' })),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(2);
    expect(await stockOf(catalog.lowStock.id)).toBe(0);
  });

  it('sells unlimited-stock sizes in any quantity without touching the count', async () => {
    const v = await unlimitedVariant();
    const res = await order(v.id, 50);
    expect(res.status).toBe(201);
    expect(await stockOf(v.id)).toBe(0);
    const item = await t.prisma.orderItem.findFirstOrThrow({ where: { orderId: res.body.id } });
    expect(item.stockDeducted).toBe(false);
  });

  it('returns stock (and only what was taken) when an admin cancels', async () => {
    const admin = await signUp(t, { admin: true });
    const v = await unlimitedVariant();
    const guest = t.agent();
    await guest.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 2 }).expect(201);
    await guest.post('/v1/cart/items').send({ variantId: v.id, quantity: 4 }).expect(201);
    const res = await guest.post('/v1/orders').send({ ...SHIPPING, customerEmail: 'g@example.test' }).expect(201);
    expect(await stockOf(catalog.inStock.id)).toBe(3);

    await admin.agent.put(`/v1/admin/orders/${res.body.id}/status`).send({ status: 'CANCELLED' }).expect(200);
    expect(await stockOf(catalog.inStock.id)).toBe(5);
    expect(await stockOf(v.id)).toBe(0);
  });

  it('does not let a cancelled order be reopened (stock was already returned)', async () => {
    const admin = await signUp(t, { admin: true });
    const res = await order(catalog.inStock.id, 1);
    await admin.agent.put(`/v1/admin/orders/${res.body.id}/status`).send({ status: 'CANCELLED' }).expect(200);
    await admin.agent.put(`/v1/admin/orders/${res.body.id}/status`).send({ status: 'CONFIRMED' }).expect(409);
    await admin.agent.put(`/v1/admin/orders/${res.body.id}/status`).send({ status: 'REFUNDED' }).expect(409);
    expect(await stockOf(catalog.inStock.id)).toBe(5);
  });

  it('rejects unknown statuses', async () => {
    const admin = await signUp(t, { admin: true });
    const res = await order(catalog.inStock.id, 1);
    await admin.agent.put(`/v1/admin/orders/${res.body.id}/status`).send({ status: 'LOST' }).expect(400);
  });

  it('releases stock held by unpaid orders after the timeout', async () => {
    const res = await order(catalog.inStock.id, 2);
    expect(await stockOf(catalog.inStock.id)).toBe(3);
    const orders = t.app.get(OrdersService);

    expect(await orders.releaseExpiredPendingOrders(60 * 60 * 1000)).toBe(0);

    await t.prisma.order.update({ where: { id: res.body.id }, data: { createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) } });
    expect(await orders.releaseExpiredPendingOrders(60 * 60 * 1000)).toBe(1);
    expect(await stockOf(catalog.inStock.id)).toBe(5);
    const row = await t.prisma.order.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(row.status).toBe('CANCELLED');
  });

  it('leaves an unpaid order alone while its payment is in flight', async () => {
    const res = await order(catalog.inStock.id, 1);
    await t.prisma.order.update({
      where: { id: res.body.id },
      data: { createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), paymentClaimedAt: new Date() },
    });
    expect(await t.app.get(OrdersService).releaseExpiredPendingOrders(60 * 60 * 1000)).toBe(0);
  });
});
