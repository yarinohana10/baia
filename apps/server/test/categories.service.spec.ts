import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from '../src/categories/categories.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { STORAGE_SERVICE } from '../src/storage/storage.interface';
import { NotFoundException } from '@nestjs/common';
import { createMockPrismaService, createMockStorageService, MOCK_UPLOAD } from './helpers';

const mockCategory = (overrides?: Partial<any>) => ({
  id: 'cat-1',
  nameHe: 'גברים',
  nameEn: 'Men',
  slug: 'men',
  image: null,
  imageUploadId: null,
  imageUpload: null,
  sortOrder: 1,
  parentId: null,
  parent: null,
  children: [],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let storage: ReturnType<typeof createMockStorageService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();
    storage = createMockStorageService();

    process.env.S3_BUCKET = 'baia-assets';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: prisma },
        { provide: STORAGE_SERVICE, useValue: storage },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  describe('findAll', () => {
    it('should return top-level categories with resolved image URLs', async () => {
      const catWithUpload = mockCategory({
        imageUpload: MOCK_UPLOAD,
        children: [
          mockCategory({ id: 'child-1', slug: 'men-shorts', imageUpload: null }),
        ],
      });

      prisma.category.findMany.mockResolvedValue([catWithUpload]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].image).toContain('products/prod-1/abc.jpg');
      expect(result[0].children).toHaveLength(1);
    });

    it('should return empty array when no categories exist', async () => {
      prisma.category.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findBySlug', () => {
    it('should return category by slug with resolved image', async () => {
      prisma.category.findUnique.mockResolvedValue(
        mockCategory({ children: [] }),
      );

      const result = await service.findBySlug('men');

      expect(result.slug).toBe('men');
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.findBySlug('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findById', () => {
    it('should return category by ID', async () => {
      prisma.category.findUnique.mockResolvedValue(
        mockCategory({ children: [] }),
      );

      const result = await service.findById('cat-1');

      expect(result.id).toBe('cat-1');
    });

    it('should throw NotFoundException if not found', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.findById('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new category', async () => {
      prisma.category.create.mockResolvedValue(mockCategory());

      const result = await service.create({
        nameHe: 'גברים',
        nameEn: 'Men',
        slug: 'men',
      });

      expect(prisma.category.create).toHaveBeenCalledWith({
        data: { nameHe: 'גברים', nameEn: 'Men', slug: 'men' },
        include: { imageUpload: true },
      });
      expect(result.slug).toBe('men');
    });

    it('should create child category with parentId', async () => {
      prisma.category.create.mockResolvedValue(
        mockCategory({ id: 'child-1', parentId: 'cat-1' }),
      );

      const result = await service.create({
        nameHe: 'תינוקות',
        nameEn: 'Babies',
        slug: 'babies',
        parentId: 'cat-1',
      });

      expect(prisma.category.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ parentId: 'cat-1' }),
        include: { imageUpload: true },
      });
      expect(result.parentId).toBe('cat-1');
    });
  });

  describe('delete', () => {
    it('should delete category and clean up S3 image', async () => {
      const catWithImage = mockCategory({ imageUpload: MOCK_UPLOAD });

      prisma.category.findUnique.mockResolvedValue(catWithImage);
      prisma.upload.delete.mockResolvedValue(MOCK_UPLOAD);
      prisma.category.delete.mockResolvedValue(catWithImage);

      const result = await service.delete('cat-1');

      expect(storage.delete).toHaveBeenCalledWith('products/prod-1/abc.jpg');
      expect(prisma.upload.delete).toHaveBeenCalledWith({ where: { id: 'upload-1' } });
      expect(prisma.category.delete).toHaveBeenCalledWith({ where: { id: 'cat-1' } });
      expect(result).toEqual({ deleted: true });
    });

    it('should delete category without S3 cleanup when no image', async () => {
      prisma.category.findUnique.mockResolvedValue(
        mockCategory({ imageUpload: null }),
      );
      prisma.category.delete.mockResolvedValue(mockCategory());

      await service.delete('cat-1');

      expect(storage.delete).not.toHaveBeenCalled();
      expect(prisma.category.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException for nonexistent category', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('uploadImage', () => {
    it('should upload image to S3 and link to category', async () => {
      const file = Buffer.from('category image');

      prisma.category.findUnique.mockResolvedValue(
        mockCategory({ imageUpload: null }),
      );
      prisma.upload.create.mockResolvedValue(MOCK_UPLOAD);
      prisma.category.update.mockResolvedValue(
        mockCategory({
          imageUploadId: 'upload-1',
          imageUpload: MOCK_UPLOAD,
        }),
      );

      const result = await service.uploadImage(
        'cat-1', file, 'men-cover.jpg', 'image/jpeg', 'user-1',
      );

      expect(storage.upload).toHaveBeenCalledWith(
        file,
        expect.stringContaining('categories/cat-1/'),
        'image/jpeg',
      );
      expect(prisma.upload.create).toHaveBeenCalled();
      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
        data: { imageUploadId: 'upload-1' },
        include: { imageUpload: true },
      });
      expect(result).toBeDefined();
    });

    it('should replace old image when uploading new one', async () => {
      const file = Buffer.from('new image');
      const oldUpload = { ...MOCK_UPLOAD, id: 'old-upload', s3Key: 'categories/cat-1/old.jpg' };

      prisma.category.findUnique.mockResolvedValue(
        mockCategory({ imageUpload: oldUpload }),
      );
      prisma.upload.delete.mockResolvedValue(oldUpload);
      prisma.upload.create.mockResolvedValue({ ...MOCK_UPLOAD, id: 'new-upload' });
      prisma.category.update.mockResolvedValue(
        mockCategory({
          imageUploadId: 'new-upload',
          imageUpload: { ...MOCK_UPLOAD, id: 'new-upload' },
        }),
      );

      await service.uploadImage('cat-1', file, 'new.jpg', 'image/jpeg');

      expect(storage.delete).toHaveBeenCalledWith('categories/cat-1/old.jpg');
      expect(prisma.upload.delete).toHaveBeenCalledWith({ where: { id: 'old-upload' } });
    });

    it('should throw NotFoundException for nonexistent category', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(
        service.uploadImage('nonexistent', Buffer.from('x'), 'f.jpg', 'image/jpeg'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteImage', () => {
    it('should delete S3 image and unlink from category', async () => {
      prisma.category.findUnique.mockResolvedValue(
        mockCategory({ imageUpload: MOCK_UPLOAD }),
      );
      prisma.category.update.mockResolvedValue(mockCategory());
      prisma.upload.delete.mockResolvedValue(MOCK_UPLOAD);

      const result = await service.deleteImage('cat-1');

      expect(storage.delete).toHaveBeenCalledWith('products/prod-1/abc.jpg');
      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
        data: { imageUploadId: null },
      });
      expect(prisma.upload.delete).toHaveBeenCalledWith({ where: { id: 'upload-1' } });
      expect(result).toEqual({ deleted: true });
    });

    it('should throw NotFoundException if category not found', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.deleteImage('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if category has no image', async () => {
      prisma.category.findUnique.mockResolvedValue(
        mockCategory({ imageUpload: null }),
      );

      await expect(service.deleteImage('cat-1')).rejects.toThrow(NotFoundException);
    });
  });
});
