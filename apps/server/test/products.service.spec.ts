import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from '../src/products/products.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { STORAGE_SERVICE } from '../src/storage/storage.interface';
import { NotFoundException } from '@nestjs/common';
import { createMockPrismaService, createMockStorageService, MOCK_UPLOAD } from './helpers';

const mockProduct = (overrides?: Partial<any>) => ({
  id: 'prod-1',
  nameHe: 'מכנסי ים',
  nameEn: 'Swim Shorts',
  descriptionHe: null,
  descriptionEn: null,
  slug: 'swim-shorts',
  basePrice: { toNumber: () => 149.90 },
  categoryId: 'cat-1',
  isFeatured: false,
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  category: { id: 'cat-1', nameHe: 'גברים', nameEn: 'Men', slug: 'men' },
  variants: [],
  images: [],
  ...overrides,
});

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let storage: ReturnType<typeof createMockStorageService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();
    storage = createMockStorageService();

    process.env.S3_BUCKET = 'baia-assets';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: prisma },
        { provide: STORAGE_SERVICE, useValue: storage },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  describe('findAll', () => {
    it('should return paginated products with resolved S3 image URLs', async () => {
      const prod = mockProduct({
        images: [
          { id: 'img-1', url: 'old-url', upload: MOCK_UPLOAD, color: 'Black', sortOrder: 0 },
        ],
      });

      prisma.product.findMany.mockResolvedValue([prod]);
      prisma.product.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.products).toHaveLength(1);
      expect(result.products[0].images[0].url).toContain('products/prod-1/abc.jpg');
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should include child categories when filtering by categoryId', async () => {
      prisma.category.findMany.mockResolvedValue([{ id: 'child-1' }, { id: 'child-2' }]);
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll({ categoryId: 'parent-cat' });

      const findManyCall = prisma.product.findMany.mock.calls[0][0];
      expect(findManyCall.where.categoryId).toEqual({
        in: ['parent-cat', 'child-1', 'child-2'],
      });
    });

    it('should set categoryId directly when no children', async () => {
      prisma.category.findMany.mockResolvedValue([]);
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll({ categoryId: 'leaf-cat' });

      const findManyCall = prisma.product.findMany.mock.calls[0][0];
      expect(findManyCall.where.categoryId).toBe('leaf-cat');
    });

    it('should support search by name', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll({ search: 'classic' });

      const findManyCall = prisma.product.findMany.mock.calls[0][0];
      expect(findManyCall.where.OR).toEqual([
        { nameEn: { contains: 'classic', mode: 'insensitive' } },
        { nameHe: { contains: 'classic', mode: 'insensitive' } },
      ]);
    });

    it('should handle legacy images without upload record', async () => {
      const prod = mockProduct({
        images: [
          { id: 'img-2', url: '/products/men/old.jpg', upload: null, color: 'Red', sortOrder: 0 },
        ],
      });

      prisma.product.findMany.mockResolvedValue([prod]);
      prisma.product.count.mockResolvedValue(1);

      const result = await service.findAll();

      expect(result.products[0].images[0].url).toBe('/products/men/old.jpg');
    });

    it('should sort by price ascending', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.findAll({ sort: 'price-asc' });

      const findManyCall = prisma.product.findMany.mock.calls[0][0];
      expect(findManyCall.orderBy).toEqual({ basePrice: 'asc' });
    });
  });

  describe('findBySlug', () => {
    it('should return product by slug with resolved images', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct());

      const result = await service.findBySlug('swim-shorts');

      expect(prisma.product.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: 'swim-shorts' } }),
      );
      expect(result.slug).toBe('swim-shorts');
    });

    it('should throw NotFoundException if product not found', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.findBySlug('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findById', () => {
    it('should return product by ID', async () => {
      prisma.product.findUnique.mockResolvedValue(mockProduct());

      const result = await service.findById('prod-1');

      expect(result.id).toBe('prod-1');
    });

    it('should throw NotFoundException if product not found', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.findById('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a product with Decimal basePrice', async () => {
      prisma.product.create.mockResolvedValue(mockProduct());

      const result = await service.create({
        nameHe: 'מכנסי ים',
        nameEn: 'Swim Shorts',
        slug: 'swim-shorts',
        basePrice: 149.90,
        categoryId: 'cat-1',
      });

      expect(prisma.product.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          nameEn: 'Swim Shorts',
          categoryId: 'cat-1',
        }),
        include: { category: true, variants: true, images: true },
      });
      expect(result.nameEn).toBe('Swim Shorts');
    });
  });

  describe('delete', () => {
    it('should delete product and clean up S3 images', async () => {
      const prod = mockProduct({
        images: [{ id: 'img-1', upload: MOCK_UPLOAD }],
      });

      prisma.product.findUnique.mockResolvedValue(prod);
      prisma.upload.delete.mockResolvedValue(MOCK_UPLOAD);
      prisma.product.delete.mockResolvedValue(prod);

      const result = await service.delete('prod-1');

      expect(storage.delete).toHaveBeenCalledWith('products/prod-1/abc.jpg');
      expect(prisma.upload.delete).toHaveBeenCalledWith({ where: { id: 'upload-1' } });
      expect(prisma.product.delete).toHaveBeenCalledWith({ where: { id: 'prod-1' } });
      expect(result).toEqual({ deleted: true });
    });

    it('should delete product without S3 cleanup for legacy images', async () => {
      const prod = mockProduct({
        images: [{ id: 'img-1', upload: null }],
      });

      prisma.product.findUnique.mockResolvedValue(prod);
      prisma.product.delete.mockResolvedValue(prod);

      await service.delete('prod-1');

      expect(storage.delete).not.toHaveBeenCalled();
      expect(prisma.product.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException for nonexistent product', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.delete('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('uploadImage', () => {
    it('should upload image to S3 and create Upload + ProductImage records', async () => {
      const file = Buffer.from('image data');
      prisma.upload.create.mockResolvedValue(MOCK_UPLOAD);
      prisma.productImage.aggregate.mockResolvedValue({ _max: { sortOrder: 2 } });
      prisma.productImage.create.mockResolvedValue({
        id: 'img-new',
        productId: 'prod-1',
        url: 'http://localhost:4566/baia-assets/products/prod-1/new.jpg',
        uploadId: 'upload-1',
        color: 'Blue',
        sortOrder: 3,
        upload: MOCK_UPLOAD,
      });

      const result = await service.uploadImage(
        'prod-1', file, 'photo.jpg', 'image/jpeg', 'Blue', 'user-1',
      );

      expect(storage.upload).toHaveBeenCalledWith(
        file,
        expect.stringContaining('products/prod-1/'),
        'image/jpeg',
      );
      expect(prisma.upload.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          s3Bucket: 'baia-assets',
          mimeType: 'image/jpeg',
          sizeBytes: file.length,
          fileName: 'photo.jpg',
          uploadedBy: 'user-1',
        }),
      });
      expect(prisma.productImage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productId: 'prod-1',
          uploadId: 'upload-1',
          color: 'Blue',
          sortOrder: 3,
        }),
        include: { upload: true },
      });
      expect(result.sortOrder).toBe(3);
    });

    it('should start sortOrder at 1 when no existing images', async () => {
      const file = Buffer.from('img');
      prisma.upload.create.mockResolvedValue(MOCK_UPLOAD);
      prisma.productImage.aggregate.mockResolvedValue({ _max: { sortOrder: null } });
      prisma.productImage.create.mockResolvedValue({
        id: 'img-new', sortOrder: 1, upload: MOCK_UPLOAD,
      });

      await service.uploadImage('prod-1', file, 'f.jpg', 'image/jpeg');

      const createCall = prisma.productImage.create.mock.calls[0][0];
      expect(createCall.data.sortOrder).toBe(1);
    });
  });

  describe('deleteImage', () => {
    it('should delete S3 file, Upload record, and ProductImage', async () => {
      prisma.productImage.findUnique.mockResolvedValue({
        id: 'img-1',
        upload: MOCK_UPLOAD,
      });
      prisma.productImage.delete.mockResolvedValue({});
      prisma.upload.delete.mockResolvedValue(MOCK_UPLOAD);

      const result = await service.deleteImage('img-1');

      expect(storage.delete).toHaveBeenCalledWith('products/prod-1/abc.jpg');
      expect(prisma.productImage.delete).toHaveBeenCalledWith({ where: { id: 'img-1' } });
      expect(prisma.upload.delete).toHaveBeenCalledWith({ where: { id: 'upload-1' } });
      expect(result).toEqual({ deleted: true });
    });

    it('should delete legacy image without S3 cleanup', async () => {
      prisma.productImage.findUnique.mockResolvedValue({
        id: 'img-legacy',
        upload: null,
      });
      prisma.productImage.delete.mockResolvedValue({});

      await service.deleteImage('img-legacy');

      expect(storage.delete).not.toHaveBeenCalled();
      expect(prisma.productImage.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException for nonexistent image', async () => {
      prisma.productImage.findUnique.mockResolvedValue(null);

      await expect(service.deleteImage('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createVariant', () => {
    it('should create a product variant', async () => {
      const variant = {
        id: 'var-1',
        productId: 'prod-1',
        color: 'Blue',
        size: 'L',
        sku: 'classic-blue-l',
        stockQuantity: 10,
      };
      prisma.productVariant.create.mockResolvedValue(variant);

      const result = await service.createVariant('prod-1', {
        color: 'Blue',
        size: 'L',
        sku: 'classic-blue-l',
        stockQuantity: 10,
      });

      expect(prisma.productVariant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productId: 'prod-1',
          color: 'Blue',
          size: 'L',
          sku: 'classic-blue-l',
          stockQuantity: 10,
        }),
      });
      expect(result.sku).toBe('classic-blue-l');
    });
  });

  describe('deleteVariant', () => {
    it('should delete a variant', async () => {
      prisma.productVariant.delete.mockResolvedValue({ id: 'var-1' });

      const result = await service.deleteVariant('var-1');

      expect(prisma.productVariant.delete).toHaveBeenCalledWith({ where: { id: 'var-1' } });
      expect(result).toEqual({ deleted: true });
    });
  });

  describe('findAllAdmin', () => {
    it('should return all products for admin (including inactive)', async () => {
      prisma.product.findMany.mockResolvedValue([mockProduct()]);

      const result = await service.findAllAdmin({});

      const findManyCall = prisma.product.findMany.mock.calls[0][0];
      expect(findManyCall.where).not.toHaveProperty('isActive');
      expect(result).toHaveLength(1);
    });

    it('should support search by name or SKU', async () => {
      prisma.product.findMany.mockResolvedValue([]);

      await service.findAllAdmin({ search: 'classic' });

      const findManyCall = prisma.product.findMany.mock.calls[0][0];
      expect(findManyCall.where.OR).toEqual([
        { nameEn: { contains: 'classic', mode: 'insensitive' } },
        { nameHe: { contains: 'classic', mode: 'insensitive' } },
        { variants: { some: { sku: { contains: 'classic', mode: 'insensitive' } } } },
      ]);
    });
  });
});
