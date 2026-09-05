import { Test, TestingModule } from '@nestjs/testing';
import { SiteConfigService } from '../src/site-config/site-config.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { STORAGE_SERVICE } from '../src/storage/storage.interface';
import { createMockPrismaService, createMockStorageService, MOCK_UPLOAD } from './helpers';

const MOCK_CONFIG = {
  id: 'default',
  shippingCost: 29.90,
  freeShippingThreshold: 249,
  heroImageUrl: null,
  heroImageUploadId: null,
  heroTitleHe: 'קולקציית קיץ',
  heroTitleEn: 'Summer Collection',
  heroSubtitleHe: 'בגדי ים',
  heroSubtitleEn: 'Swimwear',
  heroCtaUrl: '/category/men',
};

describe('SiteConfigService', () => {
  let service: SiteConfigService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let storage: ReturnType<typeof createMockStorageService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();
    storage = createMockStorageService();

    process.env.S3_BUCKET = 'baia-assets';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SiteConfigService,
        { provide: PrismaService, useValue: prisma },
        { provide: STORAGE_SERVICE, useValue: storage },
      ],
    }).compile();

    service = module.get<SiteConfigService>(SiteConfigService);
  });

  describe('get', () => {
    it('should return existing config', async () => {
      prisma.siteConfig.findUnique.mockResolvedValue(MOCK_CONFIG);

      const result = await service.get();

      expect(result.id).toBe('default');
      expect(result.shippingCost).toBe(29.90);
      expect(result.heroTitleEn).toBe('Summer Collection');
    });

    it('should create default config if none exists', async () => {
      prisma.siteConfig.findUnique.mockResolvedValue(null);
      prisma.siteConfig.create.mockResolvedValue(MOCK_CONFIG);

      const result = await service.get();

      expect(prisma.siteConfig.create).toHaveBeenCalledWith({
        data: { id: 'default' },
      });
      expect(result.id).toBe('default');
    });

    it('should resolve hero image URL from upload', async () => {
      const configWithUpload = {
        ...MOCK_CONFIG,
        heroImageUploadId: 'upload-1',
      };

      prisma.siteConfig.findUnique.mockResolvedValue(configWithUpload);
      prisma.upload.findUnique.mockResolvedValue(MOCK_UPLOAD);

      const result = await service.get();

      expect(result.heroImageUrl).toContain('products/prod-1/abc.jpg');
    });

    it('should not resolve URL if upload record is missing', async () => {
      const configWithOrphanedUploadId = {
        ...MOCK_CONFIG,
        heroImageUploadId: 'deleted-upload',
      };

      prisma.siteConfig.findUnique.mockResolvedValue(configWithOrphanedUploadId);
      prisma.upload.findUnique.mockResolvedValue(null);

      const result = await service.get();

      expect(result.heroImageUrl).toBeNull();
    });
  });

  describe('update', () => {
    it('should update shipping config fields', async () => {
      prisma.siteConfig.update.mockResolvedValue({
        ...MOCK_CONFIG,
        shippingCost: 39.90,
        freeShippingThreshold: 299,
      });

      const result = await service.update({
        shippingCost: 39.90,
        freeShippingThreshold: 299,
      });

      expect(prisma.siteConfig.update).toHaveBeenCalledWith({
        where: { id: 'default' },
        data: expect.objectContaining({
          shippingCost: 39.90,
          freeShippingThreshold: 299,
        }),
      });
      expect(result.shippingCost).toBe(39.90);
    });

    it('should update hero text fields', async () => {
      prisma.siteConfig.update.mockResolvedValue({
        ...MOCK_CONFIG,
        heroTitleHe: 'כותרת חדשה',
        heroTitleEn: 'New Title',
      });

      await service.update({
        heroTitleHe: 'כותרת חדשה',
        heroTitleEn: 'New Title',
      });

      expect(prisma.siteConfig.update).toHaveBeenCalledWith({
        where: { id: 'default' },
        data: expect.objectContaining({
          heroTitleHe: 'כותרת חדשה',
          heroTitleEn: 'New Title',
        }),
      });
    });

    it('should update CTA URL', async () => {
      prisma.siteConfig.update.mockResolvedValue({
        ...MOCK_CONFIG,
        heroCtaUrl: '/category/women',
      });

      await service.update({ heroCtaUrl: '/category/women' });

      expect(prisma.siteConfig.update).toHaveBeenCalledWith({
        where: { id: 'default' },
        data: expect.objectContaining({ heroCtaUrl: '/category/women' }),
      });
    });
  });

  describe('uploadHeroImage', () => {
    it('should upload hero image to S3 and update config', async () => {
      const file = Buffer.from('hero image');

      prisma.siteConfig.findUnique.mockResolvedValue(MOCK_CONFIG);
      prisma.upload.create.mockResolvedValue(MOCK_UPLOAD);
      prisma.siteConfig.update.mockResolvedValue({
        ...MOCK_CONFIG,
        heroImageUploadId: 'upload-1',
        heroImageUrl: 'http://localhost:4566/baia-assets/site/abc.jpg',
      });

      const result = await service.uploadHeroImage(
        file, 'hero-banner.jpg', 'image/jpeg', 'user-1',
      );

      expect(storage.upload).toHaveBeenCalledWith(
        file,
        expect.stringContaining('site/'),
        'image/jpeg',
      );
      expect(prisma.upload.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          mimeType: 'image/jpeg',
          fileName: 'hero-banner.jpg',
          uploadedBy: 'user-1',
        }),
      });
      expect(prisma.siteConfig.update).toHaveBeenCalledWith({
        where: { id: 'default' },
        data: expect.objectContaining({
          heroImageUploadId: 'upload-1',
        }),
      });
      expect(result.heroImageUploadId).toBe('upload-1');
    });

    it('should replace old hero image when uploading new one', async () => {
      const file = Buffer.from('new hero');
      const oldUpload = { ...MOCK_UPLOAD, id: 'old-hero', s3Key: 'site/old.jpg' };

      prisma.siteConfig.findUnique.mockResolvedValue({
        ...MOCK_CONFIG,
        heroImageUploadId: 'old-hero',
      });
      prisma.upload.findUnique.mockResolvedValue(oldUpload);
      prisma.upload.delete.mockResolvedValue(oldUpload);
      prisma.upload.create.mockResolvedValue({ ...MOCK_UPLOAD, id: 'new-hero' });
      prisma.siteConfig.update.mockResolvedValue({
        ...MOCK_CONFIG,
        heroImageUploadId: 'new-hero',
      });

      await service.uploadHeroImage(file, 'new-hero.jpg', 'image/jpeg');

      expect(storage.delete).toHaveBeenCalledWith('site/old.jpg');
      expect(prisma.upload.delete).toHaveBeenCalledWith({ where: { id: 'old-hero' } });
    });

    it('should handle no config existing yet', async () => {
      const file = Buffer.from('first hero');

      prisma.siteConfig.findUnique.mockResolvedValue(null);
      prisma.upload.create.mockResolvedValue(MOCK_UPLOAD);
      prisma.siteConfig.update.mockResolvedValue({
        ...MOCK_CONFIG,
        heroImageUploadId: 'upload-1',
      });

      await service.uploadHeroImage(file, 'hero.jpg', 'image/jpeg');

      expect(storage.delete).not.toHaveBeenCalled();
      expect(storage.upload).toHaveBeenCalled();
    });

    it('should handle config with no previous hero image', async () => {
      const file = Buffer.from('first hero');

      prisma.siteConfig.findUnique.mockResolvedValue(MOCK_CONFIG);
      prisma.upload.create.mockResolvedValue(MOCK_UPLOAD);
      prisma.siteConfig.update.mockResolvedValue({
        ...MOCK_CONFIG,
        heroImageUploadId: 'upload-1',
      });

      await service.uploadHeroImage(file, 'hero.jpg', 'image/jpeg');

      expect(storage.delete).not.toHaveBeenCalled();
    });
  });
});
