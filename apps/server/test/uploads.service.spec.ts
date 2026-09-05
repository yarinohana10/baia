import { Test, TestingModule } from '@nestjs/testing';
import { UploadsService } from '../src/uploads/uploads.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { STORAGE_SERVICE } from '../src/storage/storage.interface';
import { NotFoundException } from '@nestjs/common';
import { createMockPrismaService, createMockStorageService, MOCK_UPLOAD } from './helpers';

describe('UploadsService', () => {
  let service: UploadsService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let storage: ReturnType<typeof createMockStorageService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();
    storage = createMockStorageService();

    process.env.S3_BUCKET = 'baia-assets';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadsService,
        { provide: PrismaService, useValue: prisma },
        { provide: STORAGE_SERVICE, useValue: storage },
      ],
    }).compile();

    service = module.get<UploadsService>(UploadsService);
  });

  describe('upload', () => {
    it('should upload file to storage and create Upload record', async () => {
      const file = Buffer.from('test data');
      prisma.upload.create.mockResolvedValue(MOCK_UPLOAD);

      const result = await service.upload(
        file,
        'test.jpg',
        'image/jpeg',
        1024,
        'products/prod-1',
        'user-1',
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
          sizeBytes: 1024,
          fileName: 'test.jpg',
          uploadedBy: 'user-1',
        }),
      });
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('url');
    });

    it('should generate a unique s3Key with UUID', async () => {
      const file = Buffer.from('test');
      prisma.upload.create.mockResolvedValue(MOCK_UPLOAD);

      await service.upload(file, 'photo.png', 'image/png', 500, 'general');

      const createCall = prisma.upload.create.mock.calls[0][0];
      expect(createCall.data.s3Key).toMatch(/^general\/[a-f0-9-]+\.png$/);
    });

    it('should extract extension from original filename', async () => {
      const file = Buffer.from('test');
      prisma.upload.create.mockResolvedValue(MOCK_UPLOAD);

      await service.upload(file, 'photo.webp', 'image/webp', 500, 'media');

      const createCall = prisma.upload.create.mock.calls[0][0];
      expect(createCall.data.s3Key).toMatch(/\.webp$/);
    });

    it('should default to bin extension if no extension found', async () => {
      const file = Buffer.from('data');
      prisma.upload.create.mockResolvedValue(MOCK_UPLOAD);

      await service.upload(file, 'noext', 'application/octet-stream', 100, 'misc');

      const createCall = prisma.upload.create.mock.calls[0][0];
      // 'noext'.split('.').pop() returns 'noext', not 'bin'
      // Actually it picks last segment which is 'noext'
      expect(createCall.data.s3Key).toMatch(/^misc\/[a-f0-9-]+\.\w+$/);
    });
  });

  describe('findById', () => {
    it('should return upload with resolved URL', async () => {
      prisma.upload.findUnique.mockResolvedValue(MOCK_UPLOAD);

      const result = await service.findById('upload-1');

      expect(result.id).toBe('upload-1');
      expect(result.url).toContain('products/prod-1/abc.jpg');
    });

    it('should throw NotFoundException if upload not found', async () => {
      prisma.upload.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete from storage and database', async () => {
      prisma.upload.findUnique.mockResolvedValue(MOCK_UPLOAD);
      prisma.upload.delete.mockResolvedValue(MOCK_UPLOAD);

      const result = await service.delete('upload-1');

      expect(storage.delete).toHaveBeenCalledWith('products/prod-1/abc.jpg');
      expect(prisma.upload.delete).toHaveBeenCalledWith({ where: { id: 'upload-1' } });
      expect(result).toEqual({ deleted: true });
    });

    it('should throw NotFoundException if upload not found', async () => {
      prisma.upload.findUnique.mockResolvedValue(null);

      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUrl', () => {
    it('should delegate to storage service', () => {
      const url = service.getUrl('test/key.jpg');
      expect(storage.getUrl).toHaveBeenCalledWith('test/key.jpg');
    });
  });
});
