import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AuthModule } from '../../src/auth/auth.module';
import { SiteConfigModule } from '../../src/site-config/site-config.module';
import { CategoriesModule } from '../../src/categories/categories.module';
import { ProductsModule } from '../../src/products/products.module';
import { CouponsModule } from '../../src/coupons/coupons.module';
import { STORAGE_SERVICE } from '../../src/storage/storage.interface';
import { authRouter } from '../../src/auth/auth.router';
import { configureGlobalPipeline } from '../../src/common/app-setup';
import { ORIGIN, resetDb, seedCatalog, signUp, SpyPaymentProvider, type TestApp } from './app';

const storage = {
  upload: jest.fn(async (_buf: Buffer, key: string) => `http://storage.test/${key}`),
  delete: jest.fn(async () => undefined),
  getUrl: jest.fn((key: string) => `http://storage.test/${key}`),
};

@Global()
@Module({
  providers: [{ provide: STORAGE_SERVICE, useValue: storage }],
  exports: [STORAGE_SERVICE],
})
class FakeStorageModule {}

@Module({
  imports: [
    FakeStorageModule,
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
    PrismaModule,
    AuthModule,
    SiteConfigModule,
    CategoriesModule,
    ProductsModule,
    CouponsModule,
  ],
})
class AdminCatalogModule {}

async function createApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AdminCatalogModule] }).compile();
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

describe('Admin catalog: site config, coupons, categories, products (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createApp();
  });
  // resetDb() does not touch site_config/uploads; other suites rely on the
  // default shipping config, so leave no trace.
  const cleanSiteConfig = async () => {
    await t.prisma.siteConfig.deleteMany();
    await t.prisma.upload.deleteMany({ where: { s3Key: { startsWith: 'site/' } } });
  };
  afterAll(async () => {
    await cleanSiteConfig();
    await t.close();
  });
  beforeEach(async () => {
    await resetDb(t.prisma);
    await cleanSiteConfig();
    storage.delete.mockClear();
  });

  describe('site config', () => {
    const body = { shippingCost: 19.9, freeShippingThreshold: 300, heroTitleHe: 'קיץ', heroCtaUrl: '/category/men' };

    it('refuses anonymous writes with 401 (including the old PUT /v1)', async () => {
      await t.http().put('/v1/admin/site-config').send(body).expect(401);
      await t.http().post('/v1/admin/site-config/hero-image').expect(401);
      const legacy = await t.http().put('/v1').send(body);
      expect(legacy.status).toBe(404);
    });

    it('refuses customers with 403', async () => {
      const customer = await signUp(t);
      await customer.agent.put('/v1/admin/site-config').send(body).expect(403);
    });

    it('lets an admin save and reads it back publicly', async () => {
      const admin = await signUp(t, { admin: true });
      const res = await admin.agent.put('/v1/admin/site-config').send(body).expect(200);
      expect(Number(res.body.shippingCost)).toBe(19.9);
      const pub = await t.http().get('/v1/site-config').expect(200);
      expect(pub.body.heroTitleHe).toBe('קיץ');
      expect(Number(pub.body.freeShippingThreshold)).toBe(300);
    });

    it('validates the body', async () => {
      const admin = await signUp(t, { admin: true });
      for (const bad of [
        { shippingCost: -1 },
        { freeShippingThreshold: 'free' },
        { heroCtaUrl: 'javascript:alert(1)' },
        { heroCtaUrl: '//evil.example' },
        { heroTitleEn: 'x'.repeat(500) },
      ]) {
        await admin.agent.put('/v1/admin/site-config').send(bad).expect(400);
      }
      await admin.agent.put('/v1/admin/site-config').send({ heroCtaUrl: 'https://baia.example/sale' }).expect(200);
      await admin.agent.put('/v1/admin/site-config').send({ heroCtaUrl: '' }).expect(200);
    });

    it('uploads a hero image for admins', async () => {
      const admin = await signUp(t, { admin: true });
      const res = await admin.agent
        .post('/v1/admin/site-config/hero-image')
        .attach('file', Buffer.from([0xff, 0xd8, 0xff, 0xe0]), { filename: 'hero.jpg', contentType: 'image/jpeg' })
        .expect(201);
      expect(res.body.heroImageUrl).toMatch(/^http:\/\/storage\.test\/site\//);
      await admin.agent.post('/v1/admin/site-config/hero-image').expect(400);
    });
  });

  describe('coupons', () => {
    it('returns 400 (not 500) when validate has no code', async () => {
      await t.http().post('/v1/coupons/validate').send({ cartTotal: 100 }).expect(400);
    });

    it('rate limits coupon validation', async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 22; i++) {
        statuses.push((await t.http().post('/v1/coupons/validate').send({ code: 'NOPE', cartTotal: 10 })).status);
      }
      expect(statuses.slice(0, 20).every((s) => s === 404)).toBe(true);
      expect(statuses[21]).toBe(429);
    });

    it('creates, clears limits, rejects duplicates, and deactivates used coupons on delete', async () => {
      const admin = await signUp(t, { admin: true });
      const created = await admin.agent
        .post('/v1/admin/coupons')
        .send({ code: 'summer', discountType: 'PERCENTAGE', value: 10, minCartValue: 100, maxUses: 5, expiresAt: '2030-08-31' })
        .expect(201);
      expect(created.body.code).toBe('SUMMER');
      expect(new Date(created.body.expiresAt).toISOString()).toBe('2030-08-31T20:59:59.999Z');

      const cleared = await admin.agent
        .put(`/v1/admin/coupons/${created.body.id}`)
        .send({ minCartValue: null, maxUses: null, expiresAt: null })
        .expect(200);
      expect(cleared.body).toMatchObject({ minCartValue: null, maxUses: null, expiresAt: null });

      await admin.agent.post('/v1/admin/coupons').send({ code: 'SUMMER', discountType: 'FIXED', value: 5 }).expect(409);
      await admin.agent.post('/v1/admin/coupons').send({ code: 'BIG', discountType: 'PERCENTAGE', value: 150 }).expect(400);

      const catalog = await seedCatalog(t.prisma);
      const user = await t.prisma.user.findFirstOrThrow();
      await t.prisma.order.create({
        data: {
          orderNumber: 'BAIA-TEST-1',
          userId: user.id,
          customerEmail: 'x@example.test',
          recipientName: 'X',
          phone: '0501234567',
          subtotal: 100,
          shippingCost: 0,
          discountAmount: 10,
          total: 90,
          couponId: created.body.id,
          shippingCity: 'TLV',
          shippingStreet: 'Main',
          shippingNumber: '1',
          items: {
            create: [{ variantId: catalog.inStock.id, productName: 'Swimsuit', color: 'Black', size: 'M', quantity: 1, unitPrice: 100 }],
          },
        },
      });
      const del = await admin.agent.delete(`/v1/admin/coupons/${created.body.id}`).expect(200);
      expect(del.body).toEqual({ deleted: false, deactivated: true });
      const row = await t.prisma.coupon.findUniqueOrThrow({ where: { id: created.body.id } });
      expect(row.isActive).toBe(false);
    });
  });

  describe('categories', () => {
    it('enforces the hierarchy and refuses to delete non-empty categories', async () => {
      const admin = await signUp(t, { admin: true });
      const top = (await admin.agent.post('/v1/admin/categories').send({ nameHe: 'גברים', nameEn: 'Men', slug: 'men' }).expect(201)).body;
      const sub = (
        await admin.agent
          .post('/v1/admin/categories')
          .send({ nameHe: 'מכנסי ים', nameEn: 'Swim Shorts', slug: 'men-swim', parentId: top.id })
          .expect(201)
      ).body;

      await admin.agent.put(`/v1/admin/categories/${top.id}`).send({ parentId: top.id }).expect(400);
      await admin.agent.put(`/v1/admin/categories/${top.id}`).send({ parentId: sub.id }).expect(400);
      await admin.agent.post('/v1/admin/categories').send({ nameHe: 'x', nameEn: 'X', slug: 'x', parentId: sub.id }).expect(400);
      await admin.agent.post('/v1/admin/categories').send({ nameHe: 'x', nameEn: 'X', slug: 'Bad Slug' }).expect(400);

      const delTop = await admin.agent.delete(`/v1/admin/categories/${top.id}`).expect(409);
      expect(delTop.body.errors[0].code).toBe('hasSubcategories');

      await t.prisma.product.create({
        data: { nameHe: 'מוצר', nameEn: 'Product', slug: 'p-1', basePrice: 100, categoryId: sub.id },
      });
      const delSub = await admin.agent.delete(`/v1/admin/categories/${sub.id}`).expect(409);
      expect(delSub.body.errors[0].code).toBe('hasProducts');

      const withChild = await admin.agent
        .post('/v1/admin/categories')
        .send({ nameHe: 'x', nameEn: 'X', slug: 'x-under-sub', parentId: sub.id });
      expect(withChild.status).toBe(400); // sub is not top-level

      const moved = await admin.agent.put(`/v1/admin/categories/${sub.id}`).send({ parentId: null }).expect(200);
      expect(moved.body.parentId).toBeNull();

      const blocked = await admin.agent
        .post('/v1/admin/categories')
        .send({ nameHe: 'x', nameEn: 'X', slug: 'x-under-products', parentId: sub.id })
        .expect(409);
      expect(blocked.body.errors[0].code).toBe('parentHasProducts');
    });
  });

  describe('products', () => {
    it('archives an ordered product and deletes an unordered one', async () => {
      const admin = await signUp(t, { admin: true });
      const catalog = await seedCatalog(t.prisma);
      const user = await t.prisma.user.findFirstOrThrow();
      await t.prisma.order.create({
        data: {
          orderNumber: 'BAIA-TEST-2',
          userId: user.id,
          customerEmail: 'x@example.test',
          recipientName: 'X',
          phone: '0501234567',
          subtotal: 100,
          shippingCost: 0,
          discountAmount: 0,
          total: 100,
          shippingCity: 'TLV',
          shippingStreet: 'Main',
          shippingNumber: '1',
          items: {
            create: [{ variantId: catalog.inStock.id, productName: 'Swimsuit', color: 'Black', size: 'M', quantity: 1, unitPrice: 100 }],
          },
        },
      });

      const archived = await admin.agent.delete(`/v1/admin/products/${catalog.product.id}`).expect(200);
      expect(archived.body).toEqual({ archived: true });
      const product = await t.prisma.product.findUniqueOrThrow({
        where: { id: catalog.product.id },
        include: { variants: true },
      });
      expect(product.isActive).toBe(false);
      expect(product.variants.every((v) => !v.isActive)).toBe(true);

      const deleted = await admin.agent.delete(`/v1/admin/products/${catalog.inactiveProduct.id}`).expect(200);
      expect(deleted.body).toEqual({ deleted: true });
      expect(await t.prisma.product.findUnique({ where: { id: catalog.inactiveProduct.id } })).toBeNull();
    });

    it('clamps public paging and keeps the admin list backward compatible', async () => {
      const admin = await signUp(t, { admin: true });
      await seedCatalog(t.prisma);

      for (const qs of ['page=0', 'page=abc', 'limit=0', 'limit=100000', 'page=-3&limit=abc']) {
        const res = await t.http().get(`/v1/products?${qs}`).expect(200);
        expect(res.body.page).toBeGreaterThanOrEqual(1);
        expect(res.body.limit).toBeGreaterThanOrEqual(1);
        expect(res.body.limit).toBeLessThanOrEqual(100);
      }

      const legacy = await admin.agent.get('/v1/admin/products').expect(200);
      expect(Array.isArray(legacy.body)).toBe(true);
      expect(legacy.body).toHaveLength(2);

      const paged = await admin.agent.get('/v1/admin/products?page=1&limit=1').expect(200);
      expect(paged.body).toMatchObject({ total: 2, page: 1, limit: 1, totalPages: 2 });
      expect(paged.body.products).toHaveLength(1);
    });

    it('sorts by the price shoppers pay (live sale price)', async () => {
      const catalog = await seedCatalog(t.prisma);
      const cheapBase = await t.prisma.product.create({
        data: { nameHe: 'זול', nameEn: 'Cheap', slug: `cheap-${Date.now()}`, basePrice: 80, categoryId: catalog.category.id },
      });
      await t.prisma.productVariant.create({
        data: { productId: cheapBase.id, color: 'Red', size: 'M', sku: `CHEAP-${Date.now()}`, stockQuantity: 1 },
      });
      // The 100-shekel product is on sale for 50, so it is now the cheapest.
      await t.prisma.productVariant.update({ where: { id: catalog.inStock.id }, data: { salePrice: 50 } });
      // An expired sale must not count.
      await t.prisma.productVariant.update({
        where: { id: catalog.lowStock.id },
        data: { salePrice: 10, saleEnd: new Date(Date.now() - 86_400_000) },
      });

      const asc = await t.http().get('/v1/products?sort=price-asc').expect(200);
      expect(asc.body.products.map((p: { id: string }) => p.id)).toEqual([catalog.product.id, cheapBase.id]);
      const desc = await t.http().get('/v1/products?sort=price-desc').expect(200);
      expect(desc.body.products.map((p: { id: string }) => p.id)).toEqual([cheapBase.id, catalog.product.id]);
    });
  });
});
