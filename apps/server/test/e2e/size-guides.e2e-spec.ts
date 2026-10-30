import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AuthModule } from '../../src/auth/auth.module';
import { CategoriesModule } from '../../src/categories/categories.module';
import { SizeGuidesModule } from '../../src/size-guides/size-guides.module';
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
    SizeGuidesModule,
  ],
})
class SizeGuidesTestModule {}

async function createApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [SizeGuidesTestModule] }).compile();
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

const TABLE = {
  titleHe: 'מידות גוף',
  titleEn: 'Body measurements',
  noteHe: 'כל המידות בס״מ',
  noteEn: 'All measurements in cm',
  columns: ['XS', 'S'],
  rows: [{ labelHe: 'חזה', labelEn: 'Bust', values: ['76–81', '81–88'] }],
};

const GUIDE = {
  slug: 'women',
  nameHe: 'נשים',
  nameEn: 'Women',
  introHe: 'כל המידות בסנטימטרים.',
  introEn: 'All measurements are in centimetres.',
  tables: [TABLE],
  steps: [{ titleHe: 'חזה', titleEn: 'Bust', bodyHe: 'מדדו סביב החזה.', bodyEn: 'Measure around your bust.' }],
  tips: [{ he: 'מדדו בסנטימטרים.', en: 'Measure in centimetres.' }],
};

describe('Size guides (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createApp();
  });
  afterAll(async () => t.close());
  beforeEach(async () => {
    await resetDb(t.prisma);
    await t.prisma.upload.deleteMany({ where: { s3Key: { startsWith: 'size-guides/' } } });
  });

  it('requires an admin for every admin route', async () => {
    await t.http().get('/v1/admin/size-guides').expect(401);
    const customer = await signUp(t);
    await customer.agent.post('/v1/admin/size-guides').send(GUIDE).expect(403);
  });

  it('creates, edits, lists and deletes a guide', async () => {
    const admin = await signUp(t, { admin: true });
    const created = await admin.agent
      .post('/v1/admin/size-guides')
      .send({ ...GUIDE, nameEn: '  Women ' })
      .expect(201);
    expect(created.body).toMatchObject({ slug: 'women', nameEn: 'Women', isActive: true, imageUrl: null, tables: [TABLE] });

    await admin.agent.post('/v1/admin/size-guides').send(GUIDE).expect(409);

    const updated = await admin.agent
      .put(`/v1/admin/size-guides/${created.body.id}`)
      .send({ introEn: '', tips: [] })
      .expect(200);
    expect(updated.body).toMatchObject({ introEn: null, tips: [], tables: [TABLE] });

    await admin.agent.delete(`/v1/admin/size-guides/${created.body.id}`).expect(200);
    expect((await admin.agent.get('/v1/admin/size-guides').expect(200)).body).toEqual([]);
  });

  it('rejects malformed content', async () => {
    const admin = await signUp(t, { admin: true });
    for (const bad of [
      { ...GUIDE, slug: 'Women Size' },
      { ...GUIDE, nameHe: '' },
      { ...GUIDE, tables: [{ ...TABLE, columns: [] }] },
      { ...GUIDE, tables: [{ ...TABLE, rows: [{ labelHe: 'חזה', labelEn: 'Bust', values: ['76–81'] }] }] },
      { ...GUIDE, steps: [{ titleHe: 'x', titleEn: 'x', bodyHe: '', bodyEn: 'x' }] },
    ]) {
      await admin.agent.post('/v1/admin/size-guides').send(bad).expect(400);
    }
    const mismatch = await admin.agent
      .post('/v1/admin/size-guides')
      .send({ ...GUIDE, tables: [{ ...TABLE, rows: [{ labelHe: 'חזה', labelEn: 'Bust', values: ['1'] }] }] })
      .expect(400);
    expect(mismatch.body.errors).toEqual([expect.objectContaining({ field: 'tables.0.rows.0.values', code: 'columnMismatch' })]);
  });

  it('serves only active guides publicly, with linked categories and the uploaded illustration', async () => {
    const admin = await signUp(t, { admin: true });
    const women = (await admin.agent.post('/v1/admin/size-guides').send(GUIDE).expect(201)).body;
    await admin.agent.post('/v1/admin/size-guides').send({ ...GUIDE, slug: 'men', nameEn: 'Men', isActive: false }).expect(201);

    const category = await admin.agent
      .post('/v1/admin/categories')
      .send({ nameHe: 'נשים', nameEn: 'Women', slug: 'women', sizeGuideId: women.id })
      .expect(201);
    expect(category.body.sizeGuideId).toBe(women.id);
    await admin.agent.post('/v1/admin/categories').send({ nameHe: 'x', nameEn: 'x', slug: 'x', sizeGuideId: 'missing' }).expect(400);

    const image = await admin.agent
      .post(`/v1/admin/size-guides/${women.id}/image`)
      .attach('file', Buffer.from([0xff, 0xd8, 0xff, 0xe0]), { filename: 'measure.jpg', contentType: 'image/jpeg' })
      .expect(201);
    expect(image.body.imageUrl).toMatch(/^http:\/\/storage\.test\/size-guides\//);

    const list = await t.http().get('/v1/size-guides').expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({
      slug: 'women',
      imageUrl: image.body.imageUrl,
      categories: [expect.objectContaining({ slug: 'women' })],
    });

    await admin.agent.delete(`/v1/admin/size-guides/${women.id}/image`).expect(200);
    expect((await t.http().get('/v1/size-guides').expect(200)).body[0].imageUrl).toBeNull();

    // Deleting the guide leaves the category without one.
    await admin.agent.delete(`/v1/admin/size-guides/${women.id}`).expect(200);
    expect((await t.prisma.category.findUnique({ where: { id: category.body.id } }))?.sizeGuideId).toBeNull();
  });
});
