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
class BulkModule {}

async function createApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [BulkModule] }).compile();
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


describe('Admin bulk product edit (e2e)', () => {
  let t: TestApp;
  let men: { id: string };
  let shorts: { id: string };
  let boards: { id: string };
  let seq = 0;

  beforeAll(async () => {
    t = await createApp();
  });
  afterAll(async () => t.close());

  beforeEach(async () => {
    await resetDb(t.prisma);
    men = await t.prisma.category.create({ data: { nameHe: 'גברים', nameEn: 'Men', slug: 'men' } });
    shorts = await t.prisma.category.create({ data: { nameHe: 'בגד ים', nameEn: 'Swim Shorts', slug: 'men-swim-shorts', parentId: men.id } });
    boards = await t.prisma.category.create({ data: { nameHe: 'בורד', nameEn: 'Board Shorts', slug: 'men-board-shorts', parentId: men.id } });
  });

  async function product(name: string, opts: { categoryId?: string; activeSizes?: boolean; salePrice?: number; priceOverride?: number } = {}) {
    seq += 1;
    return t.prisma.product.create({
      data: {
        slug: `${name}-${seq}`,
        nameHe: `${name} עברית`,
        nameEn: name,
        descriptionEn: `${name} own description`,
        fabricEn: `${name} fabric`,
        basePrice: 279.9,
        categoryId: opts.categoryId ?? shorts.id,
        isActive: false,
        variants: {
          create: [
            {
              color: 'Black',
              size: 'M',
              sku: `${name}-${seq}-M`,
              stockQuantity: 3,
              isActive: opts.activeSizes ?? true,
              salePrice: opts.salePrice,
              priceOverride: opts.priceOverride,
            },
          ],
        },
        images: { create: [{ url: `https://img.test/${name}.jpg`, sortOrder: 0 }] },
      },
      include: { variants: true, images: true },
    });
  }

  const all = (except: string[] = []) => ({ categoryId: shorts.id, selection: { all: true, ids: except } });
  const only = (ids: string[]) => ({ categoryId: shorts.id, selection: { all: false, ids } });
  const bulk = (agent: request.Agent, body: object) => agent.patch('/v1/admin/products/bulk').send(body);
  const get = (id: string) => t.prisma.product.findUniqueOrThrow({ where: { id }, include: { variants: true, images: true } });

  it('is admin only', async () => {
    await product('a');
    await t.http().patch('/v1/admin/products/bulk').send({ ...all(), changes: { isFeatured: true } }).expect(401);
    const customer = await signUp(t);
    await bulk(customer.agent, { ...all(), changes: { isFeatured: true } }).expect(403);
  });

  it('changes only the chosen fields; every product keeps its own name, address, images, sizes and other content', async () => {
    const admin = await signUp(t, { admin: true });
    const a = await product('onix');
    const b = await product('yellow', { priceOverride: 299.9 });

    const res = await bulk(admin.agent, {
      ...all(),
      changes: { descriptionHe: '  תיאור משותף ', careEn: 'Hand wash cold', isActive: true, basePrice: 249.9 },
    }).expect(200);
    expect(res.body).toEqual({ updated: 2 });

    for (const before of [a, b]) {
      const after = await get(before.id);
      expect(after).toMatchObject({
        descriptionHe: 'תיאור משותף',
        careEn: 'Hand wash cold',
        isActive: true,
        nameEn: before.nameEn,
        nameHe: before.nameHe,
        slug: before.slug,
        descriptionEn: before.descriptionEn,
        fabricEn: before.fabricEn,
        categoryId: shorts.id,
        isFeatured: false,
        backSoon: false,
      });
      expect(Number(after.basePrice)).toBe(249.9);
      expect(after.images.map((i) => i.url)).toEqual(before.images.map((i) => i.url));
      expect(after.variants.map((v) => [v.id, v.sku, v.stockQuantity])).toEqual(before.variants.map((v) => [v.id, v.sku, v.stockQuantity]));
    }
    // A size-specific price is left alone.
    expect(Number((await get(b.id)).variants[0].priceOverride)).toBe(299.9);
  });

  it('respects the selection: all but some, or only some; never another subcategory', async () => {
    const admin = await signUp(t, { admin: true });
    const a = await product('a');
    const b = await product('b');
    const c = await product('c');
    const elsewhere = await product('elsewhere', { categoryId: boards.id });

    expect((await bulk(admin.agent, { ...all([b.id]), changes: { fitEn: 'all-but-b' } }).expect(200)).body).toEqual({ updated: 2 });
    expect((await bulk(admin.agent, { ...only([c.id, elsewhere.id]), changes: { careHe: 'only-c' } }).expect(200)).body).toEqual({ updated: 1 });

    expect(await get(a.id)).toMatchObject({ fitEn: 'all-but-b', careHe: null });
    expect(await get(b.id)).toMatchObject({ fitEn: null, careHe: null });
    expect(await get(c.id)).toMatchObject({ fitEn: 'all-but-b', careHe: 'only-c' });
    expect(await get(elsewhere.id)).toMatchObject({ fitEn: null, careHe: null });
  });

  it('clears a text field sent empty', async () => {
    const admin = await signUp(t, { admin: true });
    const a = await product('a');
    await bulk(admin.agent, { ...only([a.id]), changes: { fabricEn: '' } }).expect(200);
    expect((await get(a.id)).fabricEn).toBeNull();
  });

  it('works only inside a subcategory and never moves products', async () => {
    const admin = await signUp(t, { admin: true });
    const a = await product('a');
    const parent = await bulk(admin.agent, { categoryId: men.id, selection: { all: true, ids: [] }, changes: { isFeatured: true } }).expect(400);
    expect(parent.body.errors).toEqual([expect.objectContaining({ field: 'categoryId', code: 'hasSubcategories' })]);
    await bulk(admin.agent, { categoryId: 'missing', selection: { all: true, ids: [] }, changes: { isFeatured: true } }).expect(404);
    await bulk(admin.agent, { ...all(), changes: { categoryId: boards.id } }).expect(400);
    expect((await get(a.id)).categoryId).toBe(shorts.id);
  });

  it('is all-or-nothing: names every product that would break a rule and changes none', async () => {
    const admin = await signUp(t, { admin: true });
    const ok = await product('ok');
    const noSizes = await product('no-sizes', { activeSizes: false });
    const onSale = await product('on-sale', { salePrice: 200 });
    const onSaleWithOwnPrice = await product('own-price', { salePrice: 200, priceOverride: 260 });

    const hidden = await bulk(admin.agent, { ...all(), changes: { isActive: true, careEn: 'x' } }).expect(400);
    expect(hidden.body.errors).toEqual([
      expect.objectContaining({ field: 'changes.isActive', code: 'noActiveSizes', productIds: [noSizes.id] }),
    ]);

    // Only the product whose sale would not be below the new base price (no size price of its own).
    const price = await bulk(admin.agent, { ...all(), changes: { basePrice: 150 } }).expect(400);
    expect(price.body.errors).toEqual([
      expect.objectContaining({ field: 'changes.basePrice', code: 'saleBelowPrice', productIds: [onSale.id] }),
    ]);
    expect(price.body.errors[0].productIds).not.toContain(onSaleWithOwnPrice.id);

    for (const id of [ok.id, noSizes.id, onSale.id]) {
      const p = await get(id);
      expect(p).toMatchObject({ isActive: false, careEn: null });
      expect(Number(p.basePrice)).toBe(279.9);
    }
    // Leaving the refused products out lets the rest through.
    await bulk(admin.agent, { ...all([noSizes.id]), changes: { isActive: true } }).expect(200);
  });

  it('rejects bad requests with field errors', async () => {
    const admin = await signUp(t, { admin: true });
    const a = await product('a');
    for (const [body, field, code] of [
      [{ ...all(), changes: {} }, 'changes', 'noChanges'],
      [{ ...only([]), changes: { isFeatured: true } }, 'selection', 'noProducts'],
      [{ ...only(['missing']), changes: { isFeatured: true } }, 'selection', 'noProducts'],
      [{ ...all(), changes: { basePrice: -1 } }, 'changes.basePrice', 'isPositive'],
      [{ ...all(), changes: { careHe: 'x'.repeat(2001) } }, 'changes.careHe', 'maxLength'],
      [{ categoryId: shorts.id, changes: { isFeatured: true } }, 'selection', 'isObject'],
    ] as const) {
      const res = await bulk(admin.agent, body).expect(400);
      expect(res.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field, code })]));
    }
    // Fields that are unique per product can't be bulk-edited.
    await bulk(admin.agent, { ...all(), changes: { nameEn: 'Same', slug: 'same' } }).expect(400);
    expect((await get(a.id)).nameEn).toBe('a');
  });

  it('keeps products independent after a bulk edit (deleting one leaves the others)', async () => {
    const admin = await signUp(t, { admin: true });
    const a = await product('a');
    const b = await product('b');
    await bulk(admin.agent, { ...all(), changes: { fitEn: 'True to size' } }).expect(200);
    await admin.agent.delete(`/v1/admin/products/${a.id}`).expect(200);
    const left = await get(b.id);
    expect(left).toMatchObject({ fitEn: 'True to size' });
    expect(left.variants).toHaveLength(1);
    expect(left.images).toHaveLength(1);
  });

  it('updates 10,000 products in one all-or-nothing request', async () => {
    const admin = await signUp(t, { admin: true });
    const N = 10_000;
    const stamp = Date.now();
    await t.prisma.product.createMany({
      data: Array.from({ length: N }, (_, i) => ({
        id: `bulk-${stamp}-${i}`,
        slug: `bulk-${stamp}-${i}`,
        nameHe: `מוצר ${i}`,
        nameEn: `Product ${i}`,
        basePrice: 100,
        categoryId: shorts.id,
        isActive: false,
      })),
    });
    await t.prisma.productVariant.createMany({
      data: Array.from({ length: N }, (_, i) => ({
        productId: `bulk-${stamp}-${i}`,
        color: 'Black',
        size: 'M',
        sku: `BULK-${stamp}-${i}`,
        stockQuantity: 1,
        isActive: i !== N - 1, // the last one has no active size
      })),
    });

    // One bad product among 10,000 blocks all of them.
    const refused = await bulk(admin.agent, { ...all(), changes: { isActive: true, careEn: 'big' } }).expect(400);
    expect(refused.body.errors[0].productIds).toEqual([`bulk-${stamp}-${N - 1}`]);
    expect(await t.prisma.product.count({ where: { categoryId: shorts.id, careEn: 'big' } })).toBe(0);

    const res = await bulk(admin.agent, { ...all([`bulk-${stamp}-${N - 1}`]), changes: { isActive: true, careEn: 'big' } }).expect(200);
    expect(res.body).toEqual({ updated: N - 1 });
    expect(await t.prisma.product.count({ where: { categoryId: shorts.id, careEn: 'big', isActive: true } })).toBe(N - 1);
    // Each product is still its own record.
    expect(await t.prisma.product.findUniqueOrThrow({ where: { id: `bulk-${stamp}-7` } })).toMatchObject({ nameEn: 'Product 7' });
  }, 120_000);
});
