import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AuthModule } from '../../src/auth/auth.module';
import { EmailModule } from '../../src/email/email.module';
import { EmailService } from '../../src/email/email.service';
import { MemoryEmailTransport } from '../../src/email/transports/console.transport';
import { CategoriesModule } from '../../src/categories/categories.module';
import { ProductsModule } from '../../src/products/products.module';
import { CartModule } from '../../src/cart/cart.module';
import { WishlistModule } from '../../src/wishlist/wishlist.module';
import { SiteConfigModule } from '../../src/site-config/site-config.module';
import { InventoryModule } from '../../src/inventory/inventory.module';
import { STORAGE_SERVICE } from '../../src/storage/storage.interface';
import { authRouter } from '../../src/auth/auth.router';
import { configureGlobalPipeline } from '../../src/common/app-setup';
import { ORIGIN, resetDb, seedCatalog, signUp, SpyPaymentProvider, type TestApp } from './app';
import { settledEmails } from './mail';

const storage = {
  upload: jest.fn(async (_buf: Buffer, key: string) => `http://storage.test/${key}`),
  delete: jest.fn(async () => undefined),
  getUrl: jest.fn((key: string) => `http://storage.test/${key}`),
};

@Global()
@Module({ providers: [{ provide: STORAGE_SERVICE, useValue: storage }], exports: [STORAGE_SERVICE] })
class FakeStorageModule {}

@Module({
  imports: [
    FakeStorageModule,
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
    PrismaModule,
    EmailModule,
    AuthModule,
    SiteConfigModule,
    CategoriesModule,
    ProductsModule,
    CartModule,
    WishlistModule,
    InventoryModule,
  ],
})
class InventoryUxModule {}

describe('Inventory UX: Hidden, Back Soon, stock edits (e2e)', () => {
  let t: TestApp;
  let mail: MemoryEmailTransport;
  let catalog: Awaited<ReturnType<typeof seedCatalog>>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [InventoryUxModule] }).compile();
    const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    app.enableCors({ origin: ORIGIN, credentials: true });
    app.use(authRouter);
    app.setGlobalPrefix('v1');
    configureGlobalPipeline(app);
    await app.init();
    const server = app.getHttpServer();
    t = {
      app,
      prisma: app.get(PrismaService),
      payments: new SpyPaymentProvider(),
      http: () => request(server),
      agent: () => request.agent(server),
      close: () => app.close(),
    };
    mail = new MemoryEmailTransport();
    app.get(EmailService).setTransport(mail);
  });
  afterAll(async () => {
    await t.prisma.siteConfig.deleteMany();
    await t.close();
  });
  beforeEach(async () => {
    // Let fire-and-forget alerts from the previous test land before clearing the inbox.
    await settledEmails(mail);
    await resetDb(t.prisma);
    await t.prisma.siteConfig.deleteMany();
    await t.prisma.siteConfig.create({ data: { id: 'default', contactEmail: 'store@example.test' } });
    mail.sent.length = 0;
    catalog = await seedCatalog(t.prisma);
  });

  const hide = () => t.prisma.product.update({ where: { id: catalog.product.id }, data: { isActive: false } });
  const backSoon = () => t.prisma.product.update({ where: { id: catalog.product.id }, data: { backSoon: true } });
  const stockOf = async (id: string) => (await t.prisma.productVariant.findUniqueOrThrow({ where: { id } })).stockQuantity;

  describe('Hidden products', () => {
    it('are absent from every public route', async () => {
      await hide();
      const list = await t.http().get('/v1/products').expect(200);
      expect(list.body.products.map((p: { id: string }) => p.id)).not.toContain(catalog.product.id);
      const search = await t.http().get('/v1/products?search=Swimsuit').expect(200);
      expect(search.body.products).toHaveLength(0);
      const priceSorted = await t.http().get('/v1/products?sort=price-asc&minPrice=1').expect(200);
      expect(priceSorted.body.products.map((p: { id: string }) => p.id)).not.toContain(catalog.product.id);
      await t.http().get(`/v1/products/${catalog.product.slug}`).expect(404);
      await t.http().get(`/v1/products/${catalog.product.slug}/related`).expect(404);
      const facets = await t.http().get('/v1/products/facets').expect(200);
      expect(facets.body.sizes).toEqual([]);
    });

    it('do not show up as related products of a visible one', async () => {
      const other = await t.prisma.product.create({
        data: { nameHe: 'אחר', nameEn: 'Other', slug: `other-${Date.now()}`, basePrice: 10, categoryId: catalog.category.id },
      });
      await t.prisma.productVariant.create({ data: { productId: other.id, color: 'Red', size: 'S', sku: `O-${Date.now()}`, stockQuantity: 3 } });
      await hide();
      const res = await t.http().get(`/v1/products/${other.slug}/related`).expect(200);
      expect(res.body.map((p: { id: string }) => p.id)).not.toContain(catalog.product.id);
    });

    it('cannot be added to the cart or the wishlist, and leave the wishlist when hidden later', async () => {
      const user = await signUp(t);
      await user.agent.post(`/v1/wishlist/${catalog.product.id}`).expect(201);
      await user.agent.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 1 }).expect(201);
      await hide();
      const wishlist = await user.agent.get('/v1/wishlist').expect(200);
      expect(wishlist.body).toHaveLength(0);
      await user.agent.post(`/v1/wishlist/${catalog.product.id}`).expect(404);
      const guest = t.agent();
      const res = await guest.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 1 }).expect(400);
      expect(res.body.code).toBe('VARIANT_UNAVAILABLE');
      // The earlier line is still readable but flagged by product.isActive for the client's cart validation.
      const cart = await user.agent.get('/v1/cart').expect(200);
      expect(cart.body.items[0].variant.product.isActive).toBe(false);
    });
  });

  describe('Back Soon', () => {
    it('stays visible with computed availability', async () => {
      await backSoon();
      const bySlug = await t.http().get(`/v1/products/${catalog.product.slug}`).expect(200);
      expect(bySlug.body.backSoon).toBe(true);
      expect(bySlug.body.availability).toBe('back_soon');
      expect(bySlug.body.variants.every((v: { availability: string }) => v.availability === 'back_soon')).toBe(true);
      const list = await t.http().get('/v1/products').expect(200);
      expect(list.body.products.map((p: { id: string }) => p.id)).toContain(catalog.product.id);
    });

    it('rejects add and update for a Back Soon product even with stock', async () => {
      const guest = t.agent();
      const added = await guest.post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 1 }).expect(201);
      const itemId = added.body.items[0].id;
      await backSoon();
      const again = await t.agent().post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 1 }).expect(400);
      expect(again.body.code).toBe('VARIANT_UNAVAILABLE');
      const update = await guest.put(`/v1/cart/items/${itemId}`).send({ quantity: 2 }).expect(400);
      expect(update.body.code).toBe('VARIANT_UNAVAILABLE');
    });

    it('marks a sold-out size and a fully sold-out product automatically', async () => {
      await t.prisma.productVariant.update({ where: { id: catalog.inStock.id }, data: { stockQuantity: 20 } });
      await t.prisma.productVariant.update({ where: { id: catalog.lowStock.id }, data: { stockQuantity: 0 } });
      let res = await t.http().get(`/v1/products/${catalog.product.slug}`).expect(200);
      const byId = Object.fromEntries(res.body.variants.map((v: { id: string; availability: string }) => [v.id, v.availability]));
      expect(byId[catalog.lowStock.id]).toBe('sold_out');
      expect(byId[catalog.inStock.id]).toBe('in_stock');
      expect(res.body.availability).toBe('in_stock');

      await t.prisma.productVariant.update({ where: { id: catalog.inStock.id }, data: { stockQuantity: 0 } });
      res = await t.http().get(`/v1/products/${catalog.product.slug}`).expect(200);
      expect(res.body.availability).toBe('sold_out');
      await t.agent().post('/v1/cart/items').send({ variantId: catalog.inStock.id, quantity: 1 }).expect(400);
    });

    it('uses the configured low-stock threshold for low_stock', async () => {
      await t.prisma.siteConfig.update({ where: { id: 'default' }, data: { lowStockThreshold: 2 } });
      const res = await t.http().get(`/v1/products/${catalog.product.slug}`).expect(200);
      const byId = Object.fromEntries(res.body.variants.map((v: { id: string; availability: string }) => [v.id, v.availability]));
      expect(byId[catalog.inStock.id]).toBe('in_stock'); // 5 > 2
      expect(byId[catalog.lowStock.id]).toBe('low_stock'); // 2 <= 2
    });
  });

  describe('admin stock edits', () => {
    // The product endpoint takes full variant rows, like the admin form sends.
    const variantsPayload = (rows: { id: string; stockQuantity: number; expectedStockQuantity?: number; trackInventory?: boolean }[]) => ({
      variants: rows.map((r) => {
        const v = [catalog.inStock, catalog.lowStock].find((x) => x.id === r.id)!;
        return { color: v.color, size: v.size, sku: v.sku, ...r };
      }),
    });

    it('applies the difference so units sold meanwhile are not lost', async () => {
      const admin = await signUp(t, { admin: true });
      // The form loaded 5; an order took 2; the admin adds 10 on top of what they saw.
      await t.prisma.productVariant.update({ where: { id: catalog.inStock.id }, data: { stockQuantity: 3 } });
      await admin.agent
        .put(`/v1/admin/products/${catalog.product.id}`)
        .send(variantsPayload([{ id: catalog.inStock.id, stockQuantity: 15, expectedStockQuantity: 5 }]))
        .expect(200);
      expect(await stockOf(catalog.inStock.id)).toBe(13);
    });

    it('refuses to remove more than is left instead of going negative', async () => {
      const admin = await signUp(t, { admin: true });
      await t.prisma.productVariant.update({ where: { id: catalog.inStock.id }, data: { stockQuantity: 1 } });
      const res = await admin.agent
        .put(`/v1/admin/products/${catalog.product.id}`)
        .send(variantsPayload([{ id: catalog.inStock.id, stockQuantity: 0, expectedStockQuantity: 5 }]))
        .expect(409);
      expect(JSON.stringify(res.body)).toContain('stockChanged');
      expect(await stockOf(catalog.inStock.id)).toBe(1);
    });

    it('rejects a negative quantity', async () => {
      const admin = await signUp(t, { admin: true });
      await admin.agent
        .put(`/v1/admin/products/${catalog.product.id}`)
        .send(variantsPayload([{ id: catalog.inStock.id, stockQuantity: -1, expectedStockQuantity: 5 }]))
        .expect(400);
    });

    it('survives concurrent order decrements', async () => {
      const admin = await signUp(t, { admin: true });
      const decrements = Array.from({ length: 3 }, () =>
        t.prisma.productVariant.update({ where: { id: catalog.inStock.id }, data: { stockQuantity: { decrement: 1 } } }),
      );
      const edit = admin.agent
        .put(`/v1/admin/products/${catalog.product.id}`)
        .send(variantsPayload([{ id: catalog.inStock.id, stockQuantity: 25, expectedStockQuantity: 5 }]));
      const [, res] = await Promise.all([Promise.all(decrements), edit]);
      expect(res.status).toBe(200);
      expect(await stockOf(catalog.inStock.id)).toBe(22);
    });

    it('works through the single-variant endpoint too, and ignores quantity for unlimited variants', async () => {
      const admin = await signUp(t, { admin: true });
      await t.prisma.productVariant.update({ where: { id: catalog.inStock.id }, data: { stockQuantity: 4 } });
      await admin.agent.put(`/v1/admin/variants/${catalog.inStock.id}`).send({ stockQuantity: 9, expectedStockQuantity: 5 }).expect(200);
      expect(await stockOf(catalog.inStock.id)).toBe(8);

      await admin.agent
        .put(`/v1/admin/products/${catalog.product.id}`)
        .send(variantsPayload([{ id: catalog.inStock.id, stockQuantity: 100, expectedStockQuantity: 8, trackInventory: false }]))
        .expect(200);
      expect(await stockOf(catalog.inStock.id)).toBe(8);
    });

    it('still accepts an absolute quantity without the expected value', async () => {
      const admin = await signUp(t, { admin: true });
      await admin.agent
        .put(`/v1/admin/products/${catalog.product.id}`)
        .send(variantsPayload([{ id: catalog.inStock.id, stockQuantity: 7 }]))
        .expect(200);
      expect(await stockOf(catalog.inStock.id)).toBe(7);
    });

    it('alerts the store when an edit drops stock to the threshold', async () => {
      const admin = await signUp(t, { admin: true });
      await admin.agent
        .put(`/v1/admin/products/${catalog.product.id}`)
        .send(variantsPayload([{ id: catalog.inStock.id, stockQuantity: 1, expectedStockQuantity: 5 }]))
        .expect(200);
      // Sign-up also mails the new admin; look only at store-inbox alerts.
      const sent = (await settledEmails(mail)).filter((m) => m.to === 'store@example.test');
      expect(sent).toHaveLength(1);
      expect(sent[0].subject).toContain('מלאי נמוך');
    });

    it('sets Hidden and Back Soon from the admin API and lists availability', async () => {
      const admin = await signUp(t, { admin: true });
      await admin.agent.put(`/v1/admin/products/${catalog.product.id}`).send({ backSoon: true }).expect(200);
      let list = await admin.agent.get('/v1/admin/products').expect(200);
      expect(list.body.find((p: { id: string }) => p.id === catalog.product.id).availability).toBe('back_soon');
      await admin.agent.put(`/v1/admin/products/${catalog.product.id}`).send({ backSoon: false, isActive: false }).expect(200);
      list = await admin.agent.get('/v1/admin/products').expect(200);
      expect(list.body.find((p: { id: string }) => p.id === catalog.product.id).availability).toBe('hidden');
    });

    it('stores and validates the low-stock threshold in site config', async () => {
      const admin = await signUp(t, { admin: true });
      await admin.agent.put('/v1/admin/site-config').send({ lowStockThreshold: 8 }).expect(200);
      const pub = await t.http().get('/v1/site-config').expect(200);
      expect(pub.body.lowStockThreshold).toBe(8);
      await admin.agent.put('/v1/admin/site-config').send({ lowStockThreshold: -1 }).expect(400);
    });

    it('lists low-stock alerts for the panel', async () => {
      const admin = await signUp(t, { admin: true });
      const res = await admin.agent.get('/v1/admin/inventory/alerts').expect(200);
      expect(res.body.threshold).toBe(5);
      const remaining = res.body.items.map((i: { variantId: string; remaining: number }) => [i.variantId, i.remaining]);
      expect(remaining).toEqual([[catalog.lowStock.id, 2], [catalog.inStock.id, 5]]);
      await t.http().get('/v1/admin/inventory/alerts').expect(401);
    });
  });
});
