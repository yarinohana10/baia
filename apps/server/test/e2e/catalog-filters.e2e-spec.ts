import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AuthModule } from '../../src/auth/auth.module';
import { CategoriesModule } from '../../src/categories/categories.module';
import { ProductsModule } from '../../src/products/products.module';
import { STORAGE_SERVICE } from '../../src/storage/storage.interface';
import { authRouter } from '../../src/auth/auth.router';
import { configureGlobalPipeline } from '../../src/common/app-setup';
import { ADULT_LETTER_SIZE_SET } from '../../src/products/size-sets';
import { ORIGIN, resetDb, signUp, SpyPaymentProvider, type TestApp } from './app';

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
    CategoriesModule,
    ProductsModule,
  ],
})
class CatalogFiltersModule {}

async function createApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [CatalogFiltersModule] }).compile();
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

type VariantSeed = {
  color?: string;
  size: string;
  stock?: number;
  unlimited?: boolean;
  isActive?: boolean;
  salePrice?: number;
  saleEnd?: Date;
  priceOverride?: number;
};

let sku = 0;

describe('Catalog filters, facets and related products (e2e)', () => {
  let t: TestApp;
  let women: { id: string };
  let bikinis: { id: string };
  let onePiece: { id: string };
  let men: { id: string };

  beforeAll(async () => {
    t = await createApp();
  });
  afterAll(async () => t.close());

  async function product(
    slug: string,
    categoryId: string,
    basePrice: number,
    variants: VariantSeed[],
    opts: { isActive?: boolean; createdAt?: Date } = {},
  ) {
    return t.prisma.product.create({
      data: {
        slug,
        nameHe: slug,
        nameEn: slug,
        basePrice,
        categoryId,
        isActive: opts.isActive ?? true,
        createdAt: opts.createdAt,
        variants: {
          create: variants.map((v) => ({
            color: v.color ?? 'Black',
            size: v.size,
            sku: `F-${++sku}-${Date.now()}`,
            stockQuantity: v.stock ?? 0,
            trackInventory: !v.unlimited,
            isActive: v.isActive ?? true,
            salePrice: v.salePrice,
            saleEnd: v.saleEnd,
            priceOverride: v.priceOverride,
          })),
        },
      },
    });
  }

  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
  const slugs = (res: request.Response) => res.body.products.map((p: { slug: string }) => p.slug);

  beforeEach(async () => {
    await resetDb(t.prisma);
    await t.prisma.sizeSet.upsert({
      where: { key: ADULT_LETTER_SIZE_SET.key },
      update: {},
      create: {
        key: ADULT_LETTER_SIZE_SET.key,
        nameHe: ADULT_LETTER_SIZE_SET.nameHe,
        nameEn: ADULT_LETTER_SIZE_SET.nameEn,
        sizes: ADULT_LETTER_SIZE_SET.sizes,
        sortOrder: ADULT_LETTER_SIZE_SET.sortOrder,
      },
    });
    women = await t.prisma.category.create({ data: { nameHe: 'נשים', nameEn: 'Women', slug: 'women' } });
    bikinis = await t.prisma.category.create({
      data: { nameHe: 'ביקיני', nameEn: 'Bikinis', slug: 'bikinis', parentId: women.id },
    });
    onePiece = await t.prisma.category.create({
      data: { nameHe: 'שלם', nameEn: 'One piece', slug: 'one-piece', parentId: women.id },
    });
    men = await t.prisma.category.create({ data: { nameHe: 'גברים', nameEn: 'Men', slug: 'men' } });

    // M sold out (tracked, 0 units); S in stock
    await product('sold-out-m', bikinis.id, 150, [{ size: 'M', stock: 0 }, { size: 'S', stock: 2 }], { createdAt: daysAgo(5) });
    // M unlimited (stockQuantity 0 but not tracked)
    await product('unlimited-m', bikinis.id, 180, [{ size: 'M', unlimited: true, color: 'Red' }], { createdAt: daysAgo(4) });
    // M in stock, live sale 80 (base 200)
    await product('sale-m', onePiece.id, 200, [{ size: 'M', stock: 3, salePrice: 80, color: 'Red' }], { createdAt: daysAgo(3) });
    // expired sale: effective price is the base 120
    await product('expired-sale', onePiece.id, 120, [{ size: 'XL', stock: 1, salePrice: 60, saleEnd: daysAgo(1) }], { createdAt: daysAgo(2) });
    // fully sold out
    await product('all-gone', bikinis.id, 90, [{ size: 'L', stock: 0 }], { createdAt: daysAgo(1) });
    // inactive variant in stock must not count
    await product('inactive-variant', bikinis.id, 100, [{ size: 'XS', stock: 4, isActive: false }, { size: 'L', stock: 0 }], { createdAt: daysAgo(6) });
    // hidden product
    await product('hidden', bikinis.id, 70, [{ size: 'M', stock: 9 }], { isActive: false });
    // other gender
    await product('men-shorts', men.id, 160, [{ size: 'M', stock: 5 }]);
  });

  describe('GET /v1/products filters', () => {
    it('size filter matches only sizes in stock (unlimited counts as in stock)', async () => {
      const res = await t.http().get(`/v1/products?categoryId=${women.id}&sizes=M`).expect(200);
      expect(slugs(res).sort()).toEqual(['sale-m', 'unlimited-m']);
      expect(res.body.total).toBe(2);
    });

    it('several sizes are OR-ed; inactive variants never match', async () => {
      const res = await t.http().get(`/v1/products?categoryId=${women.id}&sizes=XS,S`).expect(200);
      expect(slugs(res)).toEqual(['sold-out-m']);
    });

    it('size + color must match the same variant', async () => {
      const red = await t.http().get(`/v1/products?categoryId=${women.id}&sizes=M&colors=Red`).expect(200);
      expect(slugs(red).sort()).toEqual(['sale-m', 'unlimited-m']);
      const black = await t.http().get(`/v1/products?categoryId=${women.id}&sizes=M&colors=Black`).expect(200);
      expect(slugs(black)).toEqual([]);
    });

    it('inStock=true hides fully sold-out products', async () => {
      const res = await t.http().get(`/v1/products?categoryId=${women.id}&inStock=true`).expect(200);
      expect(slugs(res)).not.toContain('all-gone');
      expect(slugs(res)).not.toContain('inactive-variant');
      expect(res.body.total).toBe(4);
    });

    it('price range uses the effective price (live sale counts, expired sale does not)', async () => {
      const cheap = await t.http().get(`/v1/products?categoryId=${women.id}&maxPrice=100`).expect(200);
      expect(slugs(cheap).sort()).toEqual(['all-gone', 'inactive-variant', 'sale-m']);
      expect(cheap.body.total).toBe(3);
      const mid = await t.http().get(`/v1/products?categoryId=${women.id}&minPrice=110&maxPrice=160`).expect(200);
      expect(slugs(mid).sort()).toEqual(['expired-sale', 'sold-out-m']);
    });

    it('combines filters with price sorting and pagination', async () => {
      const page1 = await t.http()
        .get(`/v1/products?categoryId=${women.id}&inStock=true&minPrice=50&sort=price-desc&limit=2&page=1`)
        .expect(200);
      expect(slugs(page1)).toEqual(['unlimited-m', 'sold-out-m']);
      expect(page1.body.total).toBe(4);
      expect(page1.body.totalPages).toBe(2);
      const page2 = await t.http()
        .get(`/v1/products?categoryId=${women.id}&inStock=true&minPrice=50&sort=price-desc&limit=2&page=2`)
        .expect(200);
      expect(slugs(page2)).toEqual(['expired-sale', 'sale-m']);
    });

    it('keeps newest order with a price filter', async () => {
      const res = await t.http().get(`/v1/products?categoryId=${women.id}&minPrice=1`).expect(200);
      expect(slugs(res)).toEqual(['all-gone', 'expired-sale', 'sale-m', 'unlimited-m', 'sold-out-m', 'inactive-variant']);
    });

    it('ignores invalid filter values instead of failing', async () => {
      const res = await t.http()
        .get(`/v1/products?categoryId=${women.id}&minPrice=abc&maxPrice=-4&sizes=,,&inStock=maybe&sort=hack`)
        .expect(200);
      expect(res.body.total).toBe(6);
    });
  });

  describe('GET /v1/products/facets', () => {
    it('lists in-stock sizes in size-set order, colors and the effective price range', async () => {
      const res = await t.http().get(`/v1/products/facets?categoryId=${women.id}`).expect(200);
      expect(res.body.sizes).toEqual([
        { value: 'S', count: 1 },
        { value: 'M', count: 2 },
        { value: 'XL', count: 1 },
      ]);
      expect(res.body.colors).toEqual([
        { value: 'Black', count: 4 },
        { value: 'Red', count: 2 },
      ]);
      expect(res.body.price).toEqual({ min: 80, max: 180 });
    });

    it('is scoped by subcategory and search', async () => {
      const sub = await t.http().get(`/v1/products/facets?categoryId=${onePiece.id}`).expect(200);
      expect(sub.body.sizes.map((s: { value: string }) => s.value)).toEqual(['M', 'XL']);
      const search = await t.http().get('/v1/products/facets?search=men-sh').expect(200);
      expect(search.body.sizes).toEqual([{ value: 'M', count: 1 }]);
      expect(search.body.price).toEqual({ min: 160, max: 160 });
    });

    it('returns empty facets for an empty scope', async () => {
      const res = await t.http().get('/v1/products/facets?search=nothing-matches').expect(200);
      expect(res.body).toEqual({ sizes: [], colors: [], price: { min: null, max: null } });
    });
  });

  describe('GET /v1/products/:slug/related', () => {
    it('same category first, in stock before sold out, never itself or hidden products', async () => {
      const res = await t.http().get('/v1/products/sold-out-m/related').expect(200);
      const related = res.body.map((p: { slug: string }) => p.slug);
      // same category (bikinis): unlimited-m in stock, then sold out ones
      expect(related.slice(0, 3)).toEqual(['unlimited-m', 'all-gone', 'inactive-variant']);
      // then sibling category (one piece)
      expect(related.slice(3).sort()).toEqual(['expired-sale', 'sale-m']);
      expect(related).not.toContain('sold-out-m');
      expect(related).not.toContain('hidden');
      expect(related).not.toContain('men-shorts');
    });

    it('honours the limit and 404s for unknown products', async () => {
      const res = await t.http().get('/v1/products/sold-out-m/related?limit=2').expect(200);
      expect(res.body).toHaveLength(2);
      await t.http().get('/v1/products/nope/related').expect(404);
      await t.http().get('/v1/products/hidden/related').expect(404);
    });
  });

  describe('product content fields', () => {
    const base = () => ({
      nameHe: 'בגד ים',
      nameEn: 'Swimsuit',
      slug: `content-${Date.now()}`,
      basePrice: 199,
      categoryId: bikinis.id,
      isActive: false,
    });

    it('admin saves fabric/care/fit (trimmed, empty -> null) and the product page returns them', async () => {
      const admin = await signUp(t, { admin: true });
      const created = await admin.agent
        .post('/v1/admin/products')
        .send({
          ...base(),
          isActive: true,
          variants: [{ color: 'Black', size: 'M', sku: `C-${Date.now()}`, stockQuantity: 2 }],
          fabricHe: '  82% ניילון ממוחזר, 18% ליקרה ',
          fabricEn: '82% recycled nylon, 18% elastane',
          careHe: 'כביסה ידנית במים קרים',
          careEn: '',
          fitHe: 'הדוגמנית לובשת M, גובה 1.75',
          fitEn: '   ',
        })
        .expect(201);
      expect(created.body.fabricHe).toBe('82% ניילון ממוחזר, 18% ליקרה');
      expect(created.body.careEn).toBeNull();
      expect(created.body.fitEn).toBeNull();

      const pub = await t.http().get(`/v1/products/${created.body.slug}`).expect(200);
      expect(pub.body).toMatchObject({
        fabricHe: '82% ניילון ממוחזר, 18% ליקרה',
        fabricEn: '82% recycled nylon, 18% elastane',
        careHe: 'כביסה ידנית במים קרים',
        fitHe: 'הדוגמנית לובשת M, גובה 1.75',
      });

      const updated = await admin.agent
        .put(`/v1/admin/products/${created.body.id}`)
        .send({ fabricHe: '', careEn: 'Hand wash cold' })
        .expect(200);
      expect(updated.body.fabricHe).toBeNull();
      expect(updated.body.careEn).toBe('Hand wash cold');
      expect(updated.body.fitHe).toBe('הדוגמנית לובשת M, גובה 1.75');
    });

    it('refuses to show a product without active sizes (list toggle), but allows hiding it', async () => {
      const admin = await signUp(t, { admin: true });
      const hidden = await t.prisma.product.findUniqueOrThrow({ where: { slug: 'hidden' } });
      await t.prisma.productVariant.updateMany({ where: { productId: hidden.id }, data: { isActive: false } });
      const res = await admin.agent.put(`/v1/admin/products/${hidden.id}`).send({ isActive: true }).expect(400);
      expect(res.body.errors.map((e: { field: string }) => e.field)).toContain('variants');
      const visible = await t.prisma.product.findUniqueOrThrow({ where: { slug: 'all-gone' } });
      await admin.agent.put(`/v1/admin/products/${visible.id}`).send({ isActive: false }).expect(200);
      await admin.agent.put(`/v1/admin/products/${visible.id}`).send({ isActive: true }).expect(200);
    });

    it('rejects over-long content and non-strings with field errors', async () => {
      const admin = await signUp(t, { admin: true });
      const res = await admin.agent
        .post('/v1/admin/products')
        .send({ ...base(), careHe: 'x'.repeat(2001), fitEn: 42 })
        .expect(400);
      const fields = res.body.errors.map((e: { field: string }) => e.field);
      expect(fields).toEqual(expect.arrayContaining(['careHe', 'fitEn']));
    });
  });
});
