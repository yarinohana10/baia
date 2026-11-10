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

  const bulk = (agent: request.Agent, body: object) => agent.patch('/v1/admin/products/bulk').send(body);

  it('is admin only', async () => {
    const p = await product('a');
    await t.http().patch('/v1/admin/products/bulk').send({ productIds: [p.id], changes: { isFeatured: true } }).expect(401);
    const customer = await signUp(t);
    await bulk(customer.agent, { productIds: [p.id], changes: { isFeatured: true } }).expect(403);
  });

  it('changes only the chosen fields; every product keeps its own name, address, images, sizes and other content', async () => {
    const admin = await signUp(t, { admin: true });
    const a = await product('onix');
    const b = await product('yellow', { priceOverride: 299.9 });

    const res = await bulk(admin.agent, {
      productIds: [a.id, b.id, a.id],
      changes: { descriptionHe: '  תיאור משותף ', careEn: 'Hand wash cold', isActive: true, basePrice: 249.9 },
    }).expect(200);
    expect(res.body).toEqual({ updated: 2 });

    const [ra, rb] = await Promise.all(
      [a, b].map((p) => t.prisma.product.findUniqueOrThrow({ where: { id: p.id }, include: { variants: true, images: true } })),
    );
    for (const [before, after] of [[a, ra], [b, rb]] as const) {
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
    expect(Number(rb.variants[0].priceOverride)).toBe(299.9);
  });

  it('clears a text field sent empty, and leaves products outside the selection alone', async () => {
    const admin = await signUp(t, { admin: true });
    const a = await product('a');
    const outside = await product('outside');
    await bulk(admin.agent, { productIds: [a.id], changes: { fabricEn: '' } }).expect(200);
    expect((await t.prisma.product.findUniqueOrThrow({ where: { id: a.id } })).fabricEn).toBeNull();
    expect((await t.prisma.product.findUniqueOrThrow({ where: { id: outside.id } })).fabricEn).toBe('outside fabric');
  });

  it('moves products to another subcategory, but never to a parent category', async () => {
    const admin = await signUp(t, { admin: true });
    const a = await product('a');
    await bulk(admin.agent, { productIds: [a.id], changes: { categoryId: boards.id } }).expect(200);
    expect((await t.prisma.product.findUniqueOrThrow({ where: { id: a.id } })).categoryId).toBe(boards.id);
    const res = await bulk(admin.agent, { productIds: [a.id], changes: { categoryId: men.id } }).expect(400);
    expect(res.body.errors).toEqual([expect.objectContaining({ field: 'changes.categoryId', code: 'hasSubcategories' })]);
  });

  it('is all-or-nothing: names the products that would break a rule and changes none', async () => {
    const admin = await signUp(t, { admin: true });
    const ok = await product('ok');
    const noSizes = await product('no-sizes', { activeSizes: false });
    const onSale = await product('on-sale', { salePrice: 200 });

    const hidden = await bulk(admin.agent, { productIds: [ok.id, noSizes.id], changes: { isActive: true, careEn: 'x' } }).expect(400);
    expect(hidden.body.errors).toEqual([
      expect.objectContaining({ field: 'changes.isActive', code: 'noActiveSizes', productIds: [noSizes.id] }),
    ]);

    const price = await bulk(admin.agent, { productIds: [ok.id, onSale.id], changes: { basePrice: 150 } }).expect(400);
    expect(price.body.errors).toEqual([
      expect.objectContaining({ field: 'changes.basePrice', code: 'saleBelowPrice', productIds: [onSale.id] }),
    ]);

    const untouched = await t.prisma.product.findUniqueOrThrow({ where: { id: ok.id } });
    expect(untouched).toMatchObject({ isActive: false, careEn: null });
    expect(Number(untouched.basePrice)).toBe(279.9);
  });

  it('rejects bad requests with field errors', async () => {
    const admin = await signUp(t, { admin: true });
    const a = await product('a');
    for (const [body, field, code] of [
      [{ productIds: [], changes: { isFeatured: true } }, 'productIds', 'arrayMinSize'],
      [{ productIds: [a.id], changes: {} }, 'changes', 'noChanges'],
      [{ productIds: [a.id, 'missing'], changes: { isFeatured: true } }, 'productIds', 'notFound'],
      [{ productIds: [a.id], changes: { basePrice: -1 } }, 'changes.basePrice', 'isPositive'],
      [{ productIds: [a.id], changes: { careHe: 'x'.repeat(2001) } }, 'changes.careHe', 'maxLength'],
    ] as const) {
      const res = await bulk(admin.agent, body).expect(400);
      expect(res.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field, code })]));
    }
    // Fields that are unique per product can't be bulk-edited.
    await bulk(admin.agent, { productIds: [a.id], changes: { nameEn: 'Same', slug: 'same' } }).expect(400);
    expect((await t.prisma.product.findUniqueOrThrow({ where: { id: a.id } })).nameEn).toBe('a');
  });

  it('keeps products independent after a bulk edit (deleting one leaves the others)', async () => {
    const admin = await signUp(t, { admin: true });
    const a = await product('a');
    const b = await product('b');
    await bulk(admin.agent, { productIds: [a.id, b.id], changes: { fitEn: 'True to size' } }).expect(200);
    await admin.agent.delete(`/v1/admin/products/${a.id}`).expect(200);
    const left = await t.prisma.product.findUniqueOrThrow({ where: { id: b.id }, include: { variants: true, images: true } });
    expect(left).toMatchObject({ fitEn: 'True to size' });
    expect(left.variants).toHaveLength(1);
    expect(left.images).toHaveLength(1);
  });
});
