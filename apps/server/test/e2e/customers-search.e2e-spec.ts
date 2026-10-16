import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AuthModule } from '../../src/auth/auth.module';
import { CustomersModule } from '../../src/customers/customers.module';
import { ProductsModule } from '../../src/products/products.module';
import { STORAGE_SERVICE } from '../../src/storage/storage.interface';
import { authRouter } from '../../src/auth/auth.router';
import { configureGlobalPipeline } from '../../src/common/app-setup';
import type { OrderStatus } from '../../src/generated/prisma';
import { ORIGIN, resetDb, seedCatalog, signUp, SpyPaymentProvider, type TestApp } from './app';

@Global()
@Module({
  providers: [
    {
      provide: STORAGE_SERVICE,
      useValue: { upload: jest.fn(), delete: jest.fn(), getUrl: (key: string) => `http://storage.test/${key}` },
    },
  ],
  exports: [STORAGE_SERVICE],
})
class FakeStorageModule {}

@Module({
  imports: [
    FakeStorageModule,
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
    PrismaModule,
    AuthModule,
    CustomersModule,
    ProductsModule,
  ],
})
class CustomersTestModule {}

async function createApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [CustomersTestModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  app.enableCors({ origin: ORIGIN, credentials: true });
  app.use(authRouter);
  app.setGlobalPrefix('v1');
  configureGlobalPipeline(app);
  await app.init();
  const server = app.getHttpServer();
  return {
    app,
    prisma: app.get(PrismaService),
    payments: new SpyPaymentProvider(),
    http: () => request(server),
    agent: () => request.agent(server),
    close: () => app.close(),
  };
}

let orderSeq = 0;
function createOrder(prisma: PrismaService, userId: string | null, status: OrderStatus, total: number) {
  orderSeq += 1;
  return prisma.order.create({
    data: {
      orderNumber: `BA-TEST-${orderSeq}-${Date.now()}`,
      userId,
      customerEmail: 'buyer@example.test',
      status,
      subtotal: total,
      shippingCost: 0,
      total,
      shippingCity: 'Tel Aviv',
      shippingStreet: 'Dizengoff',
      shippingNumber: '1',
    },
  });
}

describe('Admin customers (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createApp();
  });
  afterAll(async () => t.close());
  beforeEach(async () => {
    await resetDb(t.prisma);
  });

  describe('access control', () => {
    it('is 401 for anonymous requests', async () => {
      await t.http().get('/v1/admin/customers').expect(401);
      await t.http().get('/v1/admin/customers/some-id').expect(401);
    });

    it('is 403 for customers', async () => {
      const customer = await signUp(t);
      await customer.agent.get('/v1/admin/customers').expect(403);
      await customer.agent.get(`/v1/admin/customers/${customer.user.id}`).expect(403);
    });
  });

  describe('list', () => {
    it('lists only customers, newest first, with paid order count and total spent', async () => {
      const admin = await signUp(t, { admin: true });
      const alice = await signUp(t);
      const bob = await signUp(t);
      await t.prisma.user.update({ where: { id: alice.user.id }, data: { createdAt: new Date('2026-01-01') } });

      await createOrder(t.prisma, alice.user.id, 'CONFIRMED', 100);
      await createOrder(t.prisma, alice.user.id, 'DELIVERED', 50.5);
      await createOrder(t.prisma, alice.user.id, 'PENDING_PAYMENT', 999);
      await createOrder(t.prisma, alice.user.id, 'CANCELLED', 999);
      await createOrder(t.prisma, alice.user.id, 'REFUNDED', 999);
      await createOrder(t.prisma, null, 'CONFIRMED', 999); // guest order

      const res = await admin.agent.get('/v1/admin/customers').expect(200);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body.total).toBe(2);
      expect(res.body.customers.map((c: { id: string }) => c.id)).toEqual([bob.user.id, alice.user.id]);

      const [b, a] = res.body.customers;
      expect(a).toMatchObject({ email: alice.email, name: alice.user.name, orderCount: 2, totalSpent: 150.5 });
      expect(b).toMatchObject({ email: bob.email, orderCount: 0, totalSpent: 0 });
      expect(typeof a.createdAt).toBe('string');
      // No auth internals leak into the admin payload.
      expect(a.role).toBeUndefined();
      expect(a.accounts).toBeUndefined();
    });

    it('searches by name or email, case-insensitively', async () => {
      const admin = await signUp(t, { admin: true });
      const dana = await signUp(t);
      await signUp(t);
      await t.prisma.user.update({ where: { id: dana.user.id }, data: { name: 'Dana Levi' } });

      const byName = await admin.agent.get('/v1/admin/customers').query({ search: 'dana lev' }).expect(200);
      expect(byName.body.customers.map((c: { id: string }) => c.id)).toEqual([dana.user.id]);

      const byEmail = await admin.agent
        .get('/v1/admin/customers')
        .query({ search: dana.email.toUpperCase() })
        .expect(200);
      expect(byEmail.body.total).toBe(1);

      const none = await admin.agent.get('/v1/admin/customers').query({ search: 'nobody-here' }).expect(200);
      expect(none.body).toMatchObject({ customers: [], total: 0, totalPages: 0 });
    });

    it('paginates and clamps bad page/limit input', async () => {
      const admin = await signUp(t, { admin: true });
      for (let i = 0; i < 3; i++) await signUp(t);

      const p1 = await admin.agent.get('/v1/admin/customers').query({ page: 1, limit: 2 }).expect(200);
      const p2 = await admin.agent.get('/v1/admin/customers').query({ page: 2, limit: 2 }).expect(200);
      expect(p1.body).toMatchObject({ total: 3, totalPages: 2, page: 1, limit: 2 });
      expect(p1.body.customers).toHaveLength(2);
      expect(p2.body.customers).toHaveLength(1);
      const ids = [...p1.body.customers, ...p2.body.customers].map((c: { id: string }) => c.id);
      expect(new Set(ids).size).toBe(3);

      const bad = await admin.agent.get('/v1/admin/customers').query({ page: 'abc', limit: '9999' }).expect(200);
      expect(bad.body).toMatchObject({ page: 1, limit: 100 });
    });
  });

  describe('detail', () => {
    it("returns the customer with all their orders, newest first, and paid totals", async () => {
      const admin = await signUp(t, { admin: true });
      const alice = await signUp(t);
      const other = await signUp(t);
      const first = await createOrder(t.prisma, alice.user.id, 'SHIPPED', 80);
      const second = await createOrder(t.prisma, alice.user.id, 'PENDING_PAYMENT', 40);
      await t.prisma.order.update({ where: { id: second.id }, data: { createdAt: new Date(Date.now() + 1000) } });
      await createOrder(t.prisma, other.user.id, 'CONFIRMED', 500);

      const res = await admin.agent.get(`/v1/admin/customers/${alice.user.id}`).expect(200);
      expect(res.body).toMatchObject({ id: alice.user.id, email: alice.email, orderCount: 1, totalSpent: 80 });
      expect(res.body.orders.map((o: { id: string }) => o.id)).toEqual([second.id, first.id]);
      expect(res.body.orders[1]).toMatchObject({
        orderNumber: first.orderNumber,
        status: 'SHIPPED',
        total: 80,
        itemCount: 0,
      });
      expect(res.body.orders[0].accessTokenHash).toBeUndefined();
    });

    it('is 404 for unknown ids and for admin accounts', async () => {
      const admin = await signUp(t, { admin: true });
      await admin.agent.get('/v1/admin/customers/does-not-exist').expect(404);
      await admin.agent.get(`/v1/admin/customers/${admin.user.id}`).expect(404);
    });
  });
});

describe('Storefront product search (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createApp();
  });
  afterAll(async () => t.close());
  beforeEach(async () => {
    await resetDb(t.prisma);
  });

  const names = (body: { products: { nameEn: string }[] }) => body.products.map((p) => p.nameEn).sort();

  it('matches English and Hebrew names, ignores case and surrounding spaces, and hides inactive products', async () => {
    const { category } = await seedCatalog(t.prisma); // "Swimsuit" / "בגד ים" (+ an inactive product)
    await t.prisma.product.create({
      data: { nameHe: 'ביקיני משולש', nameEn: 'Triangle Bikini', slug: `bikini-${Date.now()}`, basePrice: 80, categoryId: category.id },
    });

    expect(names((await t.http().get('/v1/products').query({ search: 'bikini' }).expect(200)).body)).toEqual([
      'Triangle Bikini',
    ]);
    expect(names((await t.http().get('/v1/products').query({ search: '  SWIM ' }).expect(200)).body)).toEqual([
      'Swimsuit',
    ]);
    expect(names((await t.http().get('/v1/products').query({ search: 'ביקיני' }).expect(200)).body)).toEqual([
      'Triangle Bikini',
    ]);
    expect(names((await t.http().get('/v1/products').query({ search: 'בגד' }).expect(200)).body)).toEqual([
      'Swimsuit',
    ]);
    // The seeded inactive product must never show up.
    expect((await t.http().get('/v1/products').query({ search: 'inactive' }).expect(200)).body.total).toBe(0);
  });

  it('applies search to price sorting too, and treats LIKE wildcards literally', async () => {
    await seedCatalog(t.prisma);
    const sorted = await t.http().get('/v1/products').query({ search: 'בגד', sort: 'price-asc' }).expect(200);
    expect(names(sorted.body)).toEqual(['Swimsuit']);
    const wildcard = await t.http().get('/v1/products').query({ search: '%', sort: 'price-asc' }).expect(200);
    expect(wildcard.body.products).toHaveLength(0);
  });
});
