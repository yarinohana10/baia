import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ProductsService } from '../src/products/products.service';
import { ProductImagesService } from '../src/products/product-images.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { STORAGE_SERVICE } from '../src/storage/storage.interface';
import { CreateProductDto } from '../src/products/dto/product.dto';
import { createMockStorageService, MOCK_UPLOAD } from './helpers';
import { createProductsPrismaMock, fakeFile, ProductsPrismaMock } from './products.mocks';

const baseDto = (overrides: Partial<CreateProductDto> = {}): CreateProductDto => ({
  nameHe: 'בגד ים',
  nameEn: 'Swimsuit',
  slug: 'swimsuit',
  basePrice: 200,
  categoryId: 'cat-1',
  variants: [
    { color: 'Black', size: 'M', sku: 'SW-BLK-M', stockQuantity: 5 },
    { color: 'Black', size: 'L', sku: 'SW-BLK-L', stockQuantity: 3, salePrice: 150 },
  ],
  ...overrides,
});

/** Extracts the `errors` array from a field-error HttpException. */
async function fieldErrors(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (err) {
    const response = (err as BadRequestException).getResponse() as { errors: { field: string; code: string }[] };
    return { err, errors: response.errors };
  }
  throw new Error('expected promise to reject');
}

describe('ProductsService (writes)', () => {
  let service: ProductsService;
  let images: ProductImagesService;
  let prisma: ProductsPrismaMock;
  let storage: ReturnType<typeof createMockStorageService>;

  beforeEach(async () => {
    prisma = createProductsPrismaMock();
    storage = createMockStorageService();
    process.env.S3_BUCKET = 'baia-assets';

    prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
    prisma.product.findUnique.mockResolvedValue(null);
    prisma.product.create.mockImplementation(async ({ data }: any) => ({
      id: data.id,
      images: data.images.create.map((img: any, i: number) => ({
        id: `img-${i}`,
        ...img,
        upload: { s3Key: img.upload.create.s3Key },
      })),
      variants: data.variants.create,
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        ProductImagesService,
        { provide: PrismaService, useValue: prisma },
        { provide: STORAGE_SERVICE, useValue: storage },
      ],
    }).compile();
    service = module.get(ProductsService);
    images = module.get(ProductImagesService);
  });

  describe('create', () => {
    it('creates product, variants and images in a single transaction', async () => {
      const files = [fakeFile('a.jpg'), fakeFile('b.png', 'image/png'), fakeFile('c.webp', 'image/webp')];
      const result: any = await service.create(
        baseDto({ images: [{ color: 'Black', altTextEn: 'Front', altTextHe: 'חזית' }, {}, {}] }),
        files,
        'admin-1',
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.product.create).toHaveBeenCalledTimes(1);
      // No follow-up writes outside the transaction
      expect(prisma.productVariant.create).not.toHaveBeenCalled();
      expect(prisma.productImage.create).not.toHaveBeenCalled();

      const { data } = prisma.product.create.mock.calls[0][0];
      expect(data.variants.create).toHaveLength(2);
      expect(data.variants.create[1].salePrice.toNumber()).toBe(150);
      expect(data.images.create.map((i: any) => i.sortOrder)).toEqual([0, 1, 2]);
      expect(data.images.create[0]).toMatchObject({ color: 'Black', altTextEn: 'Front', altTextHe: 'חזית' });
      expect(data.images.create[0].upload.create).toMatchObject({ mimeType: 'image/jpeg', uploadedBy: 'admin-1' });

      expect(storage.upload).toHaveBeenCalledTimes(3);
      const keys = storage.upload.mock.calls.map((c: any[]) => c[1]);
      expect(keys.every((k: string) => k.startsWith(`products/${data.id}/`))).toBe(true);
      expect(result.images[0].url).toContain(keys[0]);
    });

    it('creates a hidden draft without images or sizes', async () => {
      await service.create(baseDto({ variants: [], isActive: false }), []);
      expect(storage.upload).not.toHaveBeenCalled();
      expect(prisma.product.create.mock.calls[0][0].data.images.create).toEqual([]);
    });

    it('rejects a visible product with no sizes, before uploading anything', async () => {
      const { errors } = await fieldErrors(service.create(baseDto({ variants: [] }), [fakeFile()]));
      expect(errors).toContainEqual(expect.objectContaining({ field: 'variants', code: 'required' }));
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('stores unlimited stock per size and defaults to tracked stock', async () => {
      await service.create(
        baseDto({
          variants: [
            { color: 'Red', size: 'S', sku: 'R-S', stockQuantity: 3 },
            { color: 'Red', size: 'M', sku: 'R-M', stockQuantity: 0, trackInventory: false },
          ],
        }),
        [],
      );
      const created = prisma.product.create.mock.calls[0][0].data.variants.create;
      expect(created.map((v: any) => v.trackInventory)).toEqual([true, false]);
    });

    it('defaults isActive to true and respects an explicit hidden flag', async () => {
      await service.create(baseDto(), []);
      await service.create(baseDto({ slug: 'hidden', isActive: false }), []);
      expect(prisma.product.create.mock.calls[0][0].data.isActive).toBe(true);
      expect(prisma.product.create.mock.calls[1][0].data.isActive).toBe(false);
    });

    it('removes uploaded files when the database transaction fails', async () => {
      prisma.$transaction.mockRejectedValueOnce(new Error('db down'));
      await expect(service.create(baseDto(), [fakeFile('a.jpg'), fakeFile('b.jpg')])).rejects.toThrow('db down');

      const uploaded = storage.upload.mock.calls.map((c: any[]) => c[1]).sort();
      const deleted = storage.delete.mock.calls.map((c: any[]) => c[0]).sort();
      expect(deleted).toEqual(uploaded);
    });

    it('removes already-uploaded files when one storage upload fails', async () => {
      storage.upload
        .mockResolvedValueOnce('http://s3/ok.jpg')
        .mockRejectedValueOnce(new Error('s3 error'));
      await expect(service.create(baseDto(), [fakeFile('a.jpg'), fakeFile('b.jpg')])).rejects.toThrow('s3 error');

      expect(storage.delete).toHaveBeenCalledTimes(1);
      expect(storage.delete.mock.calls[0][0]).toBe(storage.upload.mock.calls[0][1]);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a sale price that is not below the price', async () => {
      const { err, errors } = await fieldErrors(
        service.create(baseDto({ variants: [{ color: 'Red', size: 'S', sku: 'R-S', stockQuantity: 1, salePrice: 200 }] }), []),
      );
      expect(err).toBeInstanceOf(BadRequestException);
      expect(errors).toEqual([expect.objectContaining({ field: 'variants.0.salePrice', code: 'saleBelowPrice' })]);
    });

    it('compares sale price against the variant price override', async () => {
      const { errors } = await fieldErrors(
        service.create(
          baseDto({ variants: [{ color: 'Red', size: 'S', sku: 'R-S', stockQuantity: 1, priceOverride: 100, salePrice: 120 }] }),
          [],
        ),
      );
      expect(errors[0]).toMatchObject({ field: 'variants.0.salePrice', code: 'saleBelowPrice' });
    });

    it('rejects duplicate SKUs and color/size combinations within the payload', async () => {
      const { errors } = await fieldErrors(
        service.create(
          baseDto({
            variants: [
              { color: 'Red', size: 'S', sku: 'DUP', stockQuantity: 1 },
              { color: 'red', size: 's', sku: 'dup', stockQuantity: 1 },
            ],
          }),
          [],
        ),
      );
      expect(errors.map((e) => `${e.field}:${e.code}`)).toEqual([
        'variants.1.sku:duplicate',
        'variants.1.size:duplicateCombination',
      ]);
    });

    it('rejects an unknown category', async () => {
      prisma.category.findUnique.mockResolvedValue(null);
      const { errors } = await fieldErrors(service.create(baseDto(), []));
      expect(errors[0]).toMatchObject({ field: 'categoryId', code: 'notFound' });
    });

    it('rejects a category that has subcategories, before uploading anything', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-men', _count: { children: 2 } });
      const { err, errors } = await fieldErrors(service.create(baseDto(), [fakeFile()]));
      expect(err).toBeInstanceOf(BadRequestException);
      expect(errors[0]).toMatchObject({ field: 'categoryId', code: 'hasSubcategories' });
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('accepts a leaf subcategory', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-1', _count: { children: 0 } });
      await expect(service.create(baseDto(), [])).resolves.toBeDefined();
    });

    it('returns 409 with the field for a taken slug, before uploading anything', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'other' });
      const { err, errors } = await fieldErrors(service.create(baseDto(), [fakeFile()]));
      expect(err).toBeInstanceOf(ConflictException);
      expect(errors).toEqual([expect.objectContaining({ field: 'slug', code: 'unique' })]);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('returns 409 with the variant path for a taken SKU', async () => {
      prisma.productVariant.findMany.mockResolvedValue([{ id: 'v-other', sku: 'SW-BLK-L' }]);
      const { err, errors } = await fieldErrors(service.create(baseDto(), []));
      expect(err).toBeInstanceOf(ConflictException);
      expect(errors).toEqual([expect.objectContaining({ field: 'variants.1.sku', code: 'unique' })]);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.product.findUnique.mockImplementation(async ({ where }: any) =>
        where.id
          ? { id: 'prod-1', basePrice: { toNumber: () => 200 }, variants: [{ id: 'v1' }], images: [], sizeSet: null }
          : null,
      );
    });

    it('refuses to move a product into a category that has subcategories', async () => {
      prisma.category.findUnique.mockResolvedValue({ id: 'cat-men', _count: { children: 3 } });
      const { errors } = await fieldErrors(service.update('prod-1', { categoryId: 'cat-men' }));
      expect(errors[0]).toMatchObject({ field: 'categoryId', code: 'hasSubcategories' });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('updates the product and upserts variants inside one transaction', async () => {
      await service.update('prod-1', {
        isActive: false,
        variants: [
          { id: 'v1', color: 'Black', size: 'M', sku: 'SW-1', stockQuantity: 2 },
          { color: 'Black', size: 'L', sku: 'SW-2', stockQuantity: 4 },
        ],
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.product.update.mock.calls[0][0].data).toEqual({ isActive: false });
      expect(prisma.productVariant.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'v1' } }));
      expect(prisma.productVariant.create.mock.calls[0][0].data).toMatchObject({ productId: 'prod-1', sku: 'SW-2' });
    });

    it('rejects variants that belong to another product', async () => {
      const { errors } = await fieldErrors(
        service.update('prod-1', { variants: [{ id: 'foreign', color: 'A', size: 'M', sku: 'X', stockQuantity: 0 }] }),
      );
      expect(errors[0]).toMatchObject({ field: 'variants.0.id', code: 'notFound' });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('updateVariant', () => {
    it('validates the merged sale price against the stored price', async () => {
      prisma.productVariant.findUnique.mockResolvedValue({
        id: 'v1',
        priceOverride: null,
        salePrice: null,
        saleStart: null,
        saleEnd: null,
        product: { basePrice: { toNumber: () => 100 } },
      });
      const { errors } = await fieldErrors(service.updateVariant('v1', { salePrice: 100 }));
      expect(errors[0]).toMatchObject({ field: 'salePrice', code: 'saleBelowPrice' });
      expect(prisma.productVariant.update).not.toHaveBeenCalled();
    });
  });

  describe('images', () => {
    it('rejects an upload without a file with 400', async () => {
      const { err, errors } = await fieldErrors(images.upload('prod-1', undefined));
      expect(err).toBeInstanceOf(BadRequestException);
      expect(errors[0]).toMatchObject({ field: 'file', code: 'required' });
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('appends an uploaded image after the current last one, with metadata', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
      prisma.productImage.aggregate.mockResolvedValue({ _max: { sortOrder: 2 } });
      prisma.productImage.create.mockImplementation(async ({ data }: any) => ({
        id: 'img-new',
        ...data,
        upload: { s3Key: data.upload.create.s3Key },
      }));

      const image: any = await images.upload('prod-1', fakeFile(), { color: 'Blue', altTextHe: 'כחול' });
      expect(image.sortOrder).toBe(3);
      expect(image).toMatchObject({ color: 'Blue', altTextHe: 'כחול', altTextEn: null });
    });

    it('starts at sortOrder 0 for the first image', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
      prisma.productImage.aggregate.mockResolvedValue({ _max: { sortOrder: null } });
      prisma.productImage.create.mockImplementation(async ({ data }: any) => ({ ...data, upload: null }));
      const image: any = await images.upload('prod-1', fakeFile());
      expect(image.sortOrder).toBe(0);
    });

    it('deletes the storage object if saving the image row fails', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
      prisma.$transaction.mockRejectedValueOnce(new Error('db'));
      await expect(images.upload('prod-1', fakeFile())).rejects.toThrow('db');
      expect(storage.delete).toHaveBeenCalledWith(storage.upload.mock.calls[0][1]);
    });

    it('404s when uploading to a missing product', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(images.upload('nope', fakeFile())).rejects.toBeInstanceOf(NotFoundException);
    });

    it('reorders images by writing sortOrder = position', async () => {
      prisma.productImage.findMany
        .mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
        .mockResolvedValueOnce([]);
      await images.reorder('prod-1', ['c', 'a', 'b']);
      expect(prisma.productImage.update.mock.calls.map((c: any[]) => [c[0].where.id, c[0].data.sortOrder])).toEqual([
        ['c', 0],
        ['a', 1],
        ['b', 2],
      ]);
    });

    it('rejects a reorder that does not list every image exactly once', async () => {
      prisma.productImage.findMany.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }]);
      const { errors } = await fieldErrors(images.reorder('prod-1', ['a', 'x']));
      expect(errors[0]).toMatchObject({ field: 'imageIds', code: 'mismatch' });
      expect(prisma.productImage.update).not.toHaveBeenCalled();
    });

    it('updates image color and alt text', async () => {
      prisma.productImage.findUnique.mockResolvedValue({ id: 'img-1' });
      prisma.productImage.update.mockResolvedValue({ id: 'img-1', url: 'u', upload: MOCK_UPLOAD });
      await images.update('img-1', { color: null, altTextEn: 'Back view' });
      expect(prisma.productImage.update.mock.calls[0][0].data).toEqual({ color: null, altTextEn: 'Back view' });
    });

    it('deletes the image row, its upload and the storage object', async () => {
      prisma.productImage.findUnique.mockResolvedValue({ id: 'img-1', upload: MOCK_UPLOAD });
      await images.delete('img-1');
      expect(prisma.productImage.delete).toHaveBeenCalledWith({ where: { id: 'img-1' } });
      expect(prisma.upload.delete).toHaveBeenCalledWith({ where: { id: MOCK_UPLOAD.id } });
      expect(storage.delete).toHaveBeenCalledWith(MOCK_UPLOAD.s3Key);
    });
  });
});
