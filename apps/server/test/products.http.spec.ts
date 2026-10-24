/**
 * HTTP-level tests: real controller, Multer, global ValidationPipe and Prisma
 * exception filter (same `configureGlobalPipeline` as main.ts), with Prisma
 * and storage mocked. Requests go over a real socket via Node's fetch.
 */
jest.mock('../src/auth/auth', () => ({ auth: { api: { getSession: jest.fn() } } }));
jest.mock('better-auth/node', () => ({ fromNodeHeaders: jest.fn() }));

import { INestApplication } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ProductsController } from '../src/products/products.controller';
import { ProductsService } from '../src/products/products.service';
import { ProductImagesService } from '../src/products/product-images.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { STORAGE_SERVICE } from '../src/storage/storage.interface';
import { AuthGuard } from '../src/auth/auth.guard';
import { imageUploadOptions } from '../src/storage/image-upload.guard';
import { configureGlobalPipeline } from '../src/common/app-setup';
import { Prisma } from '../src/generated/prisma';
import { createMockStorageService } from './helpers';
import { createProductsPrismaMock, ProductsPrismaMock } from './products.mocks';

// Real magic bytes: the upload guard sniffs file content, not the declared type.
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP_HEADER = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]);

const validProduct = {
  nameHe: 'בגד ים',
  nameEn: 'Swimsuit',
  slug: 'swimsuit',
  basePrice: 199.9,
  categoryId: 'cat-1',
  variants: [{ color: 'Black', size: 'M', sku: 'SW-M', stockQuantity: 3 }],
};

const uniqueError = (target: string[] | string) =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target },
  });

describe('Products HTTP API', () => {
  let app: INestApplication;
  let baseUrl: string;
  let prisma: ProductsPrismaMock;
  let storage: ReturnType<typeof createMockStorageService>;

  beforeAll(async () => {
    prisma = createProductsPrismaMock();
    storage = createMockStorageService();

    const moduleRef = await Test.createTestingModule({
      imports: [MulterModule.register(imageUploadOptions)],
      controllers: [ProductsController],
      providers: [
        ProductsService,
        ProductImagesService,
        { provide: PrismaService, useValue: prisma },
        { provide: STORAGE_SERVICE, useValue: storage },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('v1');
    configureGlobalPipeline(app);
    await app.listen(0);
    baseUrl = `${await app.getUrl()}/v1`.replace('[::1]', 'localhost');
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
    prisma.product.findUnique.mockResolvedValue(null);
    prisma.productVariant.findMany.mockResolvedValue([]);
    prisma.product.create.mockImplementation(async ({ data }: any) => ({
      id: data.id,
      slug: data.slug,
      images: data.images.create.map((img: any, i: number) => ({ id: `img-${i}`, ...img, upload: null })),
      variants: data.variants.create,
    }));
  });

  const postJson = (path: string, body: unknown, method = 'POST') =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  const errorsOf = async (res: Response) => {
    const body = (await res.json()) as { errors: { field: string; code: string }[] };
    return body.errors.map((e) => `${e.field}:${e.code}`);
  };

  describe('POST /admin/products', () => {
    it('creates a product from a JSON body', async () => {
      const res = await postJson('/admin/products', validProduct);
      expect(res.status).toBe(201);
      expect(prisma.product.create.mock.calls[0][0].data.variants.create).toHaveLength(1);
    });

    it('creates a product with images from multipart (payload + files)', async () => {
      const form = new FormData();
      form.append(
        'payload',
        JSON.stringify({ ...validProduct, images: [{ altTextEn: 'Front' }, { color: 'Black' }, {}] }),
      );
      for (const name of ['a.jpg', 'b.jpg', 'c.jpg']) {
        form.append('images', new Blob([JPEG_HEADER, Buffer.from(name)], { type: 'image/jpeg' }), name);
      }
      const res = await fetch(`${baseUrl}/admin/products`, { method: 'POST', body: form });
      expect(res.status).toBe(201);
      const body = (await res.json()) as { images: { sortOrder: number; altTextEn: string | null }[] };
      expect(body.images.map((i) => i.sortOrder)).toEqual([0, 1, 2]);
      expect(body.images[0].altTextEn).toBe('Front');
      expect(storage.upload).toHaveBeenCalledTimes(3);
    });

    it('rejects non-image files with 400', async () => {
      const form = new FormData();
      form.append('payload', JSON.stringify(validProduct));
      form.append('images', new Blob(['hi'], { type: 'text/plain' }), 'a.txt');
      const res = await fetch(`${baseUrl}/admin/products`, { method: 'POST', body: form });
      expect(res.status).toBe(400);
      expect(prisma.product.create).not.toHaveBeenCalled();
    });

    it('rejects an invalid JSON payload field with 400', async () => {
      const form = new FormData();
      form.append('payload', '{not json');
      const res = await fetch(`${baseUrl}/admin/products`, { method: 'POST', body: form });
      expect(res.status).toBe(400);
      expect(await errorsOf(res)).toEqual(['payload:isJson']);
    });

    it.each([
      ['negative base price', { basePrice: -1 }, 'basePrice:isPositive'],
      ['missing name', { nameEn: '  ' }, 'nameEn:isNotEmpty'],
      ['bad slug', { slug: 'Not A Slug' }, 'slug:matches'],
      ['negative stock', { variants: [{ ...validProduct.variants[0], stockQuantity: -2 }] }, 'variants.0.stockQuantity:min'],
      ['empty SKU', { variants: [{ ...validProduct.variants[0], sku: ' ' }] }, 'variants.0.sku:isNotEmpty'],
      [
        'sale end before start',
        { variants: [{ ...validProduct.variants[0], saleStart: '2026-06-10', saleEnd: '2026-06-01' }] },
        'variants.0.saleEnd:saleDateRange',
      ],
    ])('rejects %s with a field error', async (_label, patch, expected) => {
      const res = await postJson('/admin/products', { ...validProduct, ...patch });
      expect(res.status).toBe(400);
      expect(await errorsOf(res)).toContain(expected);
      expect(prisma.product.create).not.toHaveBeenCalled();
    });

    it('rejects sale price >= price (business rule) with 400', async () => {
      const res = await postJson('/admin/products', {
        ...validProduct,
        variants: [{ ...validProduct.variants[0], salePrice: 250 }],
      });
      expect(res.status).toBe(400);
      expect(await errorsOf(res)).toEqual(['variants.0.salePrice:saleBelowPrice']);
    });

    it('strips unknown properties (whitelist)', async () => {
      const res = await postJson('/admin/products', { ...validProduct, hacker: true, id: 'forced' });
      expect(res.status).toBe(201);
      const data = prisma.product.create.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('hacker');
      expect(data.id).not.toBe('forced');
    });

    it('returns 409 with field info for a duplicate slug', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'other' });
      const res = await postJson('/admin/products', validProduct);
      expect(res.status).toBe(409);
      expect(await errorsOf(res)).toEqual(['slug:unique']);
    });

    it('maps a racing Prisma P2002 on SKU to 409 and cleans up uploads', async () => {
      prisma.$transaction.mockRejectedValueOnce(uniqueError(['sku']));
      const form = new FormData();
      form.append('payload', JSON.stringify(validProduct));
      form.append('images', new Blob([PNG_HEADER], { type: 'image/png' }), 'x.png');
      const res = await fetch(`${baseUrl}/admin/products`, { method: 'POST', body: form });
      expect(res.status).toBe(409);
      expect(await errorsOf(res)).toEqual(['sku:unique']);
      expect(storage.delete).toHaveBeenCalledWith(storage.upload.mock.calls[0][1]);
    });
  });

  describe('PUT /admin/products/:id', () => {
    it('maps a Postgres constraint-name P2002 target to the field', async () => {
      prisma.product.findUnique.mockImplementation(async ({ where }: any) =>
        where.id ? { id: 'p1', basePrice: { toNumber: () => 100 }, variants: [] } : null,
      );
      prisma.$transaction.mockRejectedValueOnce(uniqueError('products_slug_key'));
      const res = await postJson('/admin/products/p1', { slug: 'taken' }, 'PUT');
      expect(res.status).toBe(409);
      expect(await errorsOf(res)).toEqual(['slug:unique']);
    });

    it('validates partial updates', async () => {
      const res = await postJson('/admin/products/p1', { basePrice: 0 }, 'PUT');
      expect(res.status).toBe(400);
      expect(await errorsOf(res)).toContain('basePrice:isPositive');
    });
  });

  describe('variants', () => {
    it('rejects negative price override on create', async () => {
      const res = await postJson('/admin/products/p1/variants', { ...validProduct.variants[0], priceOverride: -5 });
      expect(res.status).toBe(400);
      expect(await errorsOf(res)).toContain('priceOverride:isPositive');
    });

    it('returns 409 for a taken SKU on create', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'p1', basePrice: { toNumber: () => 100 } });
      prisma.productVariant.findMany.mockResolvedValue([{ id: 'v9', sku: 'SW-M' }]);
      const res = await postJson('/admin/products/p1/variants', validProduct.variants[0]);
      expect(res.status).toBe(409);
      expect(await errorsOf(res)).toEqual(['sku:unique']);
    });
  });

  describe('images', () => {
    it('returns 400 (not 500) when no file is sent', async () => {
      const res = await fetch(`${baseUrl}/admin/products/p1/images`, { method: 'POST', body: new FormData() });
      expect(res.status).toBe(400);
      expect(await errorsOf(res)).toEqual(['file:required']);
    });

    it('uploads one image with color and alt text', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'p1' });
      prisma.productImage.aggregate.mockResolvedValue({ _max: { sortOrder: 0 } });
      prisma.productImage.create.mockImplementation(async ({ data }: any) => ({ id: 'i1', ...data, upload: null }));
      const form = new FormData();
      form.append('file', new Blob([WEBP_HEADER], { type: 'image/webp' }), 'x.webp');
      form.append('color', 'Red');
      form.append('altTextHe', 'אדום');
      const res = await fetch(`${baseUrl}/admin/products/p1/images`, { method: 'POST', body: form });
      expect(res.status).toBe(201);
      expect(await res.json()).toMatchObject({ sortOrder: 1, color: 'Red', altTextHe: 'אדום' });
    });

    it('reorders images', async () => {
      prisma.productImage.findMany
        .mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }])
        .mockResolvedValueOnce([{ id: 'b', url: 'u', upload: null }, { id: 'a', url: 'u', upload: null }]);
      const res = await postJson('/admin/products/p1/images/order', { imageIds: ['b', 'a'] }, 'PUT');
      expect(res.status).toBe(200);
      expect(((await res.json()) as { id: string }[]).map((i) => i.id)).toEqual(['b', 'a']);
    });

    it('rejects an empty or duplicated reorder list', async () => {
      const empty = await postJson('/admin/products/p1/images/order', { imageIds: [] }, 'PUT');
      expect(empty.status).toBe(400);
      const dup = await postJson('/admin/products/p1/images/order', { imageIds: ['a', 'a'] }, 'PUT');
      expect(dup.status).toBe(400);
      expect(await errorsOf(dup)).toContain('imageIds:arrayUnique');
    });

    it('updates image metadata, turning empty strings into null', async () => {
      prisma.productImage.findUnique.mockResolvedValue({ id: 'i1' });
      prisma.productImage.update.mockImplementation(async ({ data }: any) => ({ id: 'i1', url: 'u', upload: null, ...data }));
      const res = await postJson('/admin/images/i1', { color: '', altTextEn: 'Back' }, 'PATCH');
      expect(res.status).toBe(200);
      expect(prisma.productImage.update.mock.calls[0][0].data).toEqual({ color: null, altTextEn: 'Back' });
    });

    it('deletes an image', async () => {
      prisma.productImage.findUnique.mockResolvedValue({ id: 'i1', upload: { id: 'u1', s3Key: 'k' } });
      const res = await fetch(`${baseUrl}/admin/images/i1`, { method: 'DELETE' });
      expect(res.status).toBe(200);
      expect(storage.delete).toHaveBeenCalledWith('k');
    });

    it('returns 404 for a missing image', async () => {
      prisma.productImage.findUnique.mockResolvedValue(null);
      const res = await fetch(`${baseUrl}/admin/images/nope`, { method: 'DELETE' });
      expect(res.status).toBe(404);
    });
  });
});
