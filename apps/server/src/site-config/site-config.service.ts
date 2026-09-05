import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService, STORAGE_SERVICE } from '../storage/storage.interface';
import { randomUUID } from 'crypto';

@Injectable()
export class SiteConfigService {
  constructor(
    private prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private storage: StorageService,
  ) {}

  async get() {
    let config = await this.prisma.siteConfig.findUnique({
      where: { id: 'default' },
    });

    if (!config) {
      config = await this.prisma.siteConfig.create({
        data: { id: 'default' },
      });
    }

    // Resolve hero image URL from upload if exists
    if (config.heroImageUploadId) {
      const upload = await this.prisma.upload.findUnique({
        where: { id: config.heroImageUploadId },
      });
      if (upload) {
        return { ...config, heroImageUrl: this.storage.getUrl(upload.s3Key) };
      }
    }

    return config;
  }

  async update(data: {
    shippingCost?: number;
    freeShippingThreshold?: number;
    heroImageUrl?: string;
    heroTitleHe?: string;
    heroTitleEn?: string;
    heroSubtitleHe?: string;
    heroSubtitleEn?: string;
    heroCtaUrl?: string;
  }) {
    const updateData: any = { ...data };

    if (data.shippingCost !== undefined) {
      updateData.shippingCost = data.shippingCost;
    }
    if (data.freeShippingThreshold !== undefined) {
      updateData.freeShippingThreshold = data.freeShippingThreshold;
    }

    return this.prisma.siteConfig.update({
      where: { id: 'default' },
      data: updateData,
    });
  }

  async uploadHeroImage(
    file: Buffer,
    originalName: string,
    mimeType: string,
    uploadedBy?: string,
  ) {
    const config = await this.prisma.siteConfig.findUnique({
      where: { id: 'default' },
    });

    // Delete old hero image upload if exists
    if (config?.heroImageUploadId) {
      const oldUpload = await this.prisma.upload.findUnique({
        where: { id: config.heroImageUploadId },
      });
      if (oldUpload) {
        await this.storage.delete(oldUpload.s3Key);
        await this.prisma.upload.delete({ where: { id: oldUpload.id } });
      }
    }

    const ext = originalName.split('.').pop() || 'jpg';
    const uploadIdValue = randomUUID();
    const s3Key = `site/${uploadIdValue}.${ext}`;
    const bucket = process.env.S3_BUCKET || 'baia-assets';

    await this.storage.upload(file, s3Key, mimeType);

    try {
      const upload = await this.prisma.upload.create({
        data: {
          s3Key,
          s3Bucket: bucket,
          mimeType,
          sizeBytes: file.length,
          fileName: originalName,
          uploadedBy,
        },
      });

      return await this.prisma.siteConfig.update({
        where: { id: 'default' },
        data: {
          heroImageUploadId: upload.id,
          heroImageUrl: this.storage.getUrl(s3Key),
        },
      });
    } catch (err) {
      await this.storage.delete(s3Key).catch(() => {});
      throw err;
    }
  }
}
