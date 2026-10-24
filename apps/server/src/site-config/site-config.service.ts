import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService, STORAGE_SERVICE } from '../storage/storage.interface';
import { randomUUID } from 'crypto';
import { Prisma } from '../generated/prisma';
import { UpdateSiteConfigDto } from './dto/update-site-config.dto';
import { emailService } from '../email/email.service';

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

  /** Creates the singleton row on first use so updates never 404 on a fresh database. */
  private async ensureRow() {
    const existing = await this.prisma.siteConfig.findUnique({ where: { id: 'default' } });
    if (!existing) await this.prisma.siteConfig.create({ data: { id: 'default' } });
  }

  async update(data: UpdateSiteConfigDto) {
    const updateData: Prisma.SiteConfigUpdateInput = {};
    const keys = [
      'heroTitleHe',
      'heroTitleEn',
      'heroSubtitleHe',
      'heroSubtitleEn',
      'heroCtaUrl',
      'shippingCost',
      'freeShippingThreshold',
      'pickupPointCost',
      'courierEtaDays',
      'pickupEtaDays',
      'businessName',
      'companyId',
      'businessAddress',
      'businessPhone',
      'contactEmail',
      'whatsappNumber',
      'accessibilityCoordinatorName',
      'accessibilityCoordinatorPhone',
      'accessibilityCoordinatorEmail',
      'lowStockThreshold',
    ] as const;
    for (const key of keys) {
      if (data[key] !== undefined) (updateData as Record<string, unknown>)[key] = data[key];
    }

    await this.ensureRow();
    const updated = await this.prisma.siteConfig.update({
      where: { id: 'default' },
      data: updateData,
    });
    // Email footers carry the business details; drop the cached copy.
    emailService.invalidateBranding();
    return updated;
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

      if (!config) await this.prisma.siteConfig.create({ data: { id: 'default' } });
      const updated = await this.prisma.siteConfig.update({
        where: { id: 'default' },
        data: {
          heroImageUploadId: upload.id,
          heroImageUrl: this.storage.getUrl(s3Key),
        },
      });

      // Only remove the previous image once the new one is stored and linked.
      if (config?.heroImageUploadId) await this.removeUpload(config.heroImageUploadId);
      return updated;
    } catch (err) {
      await this.storage.delete(s3Key).catch(() => {});
      throw err;
    }
  }

  /** Unlinks the hero image, then deletes its Upload row and storage object. */
  async removeHeroImage() {
    const config = await this.prisma.siteConfig.findUnique({ where: { id: 'default' } });
    if (!config) return this.get();
    await this.prisma.siteConfig.update({
      where: { id: 'default' },
      data: { heroImageUploadId: null, heroImageUrl: null },
    });
    if (config.heroImageUploadId) await this.removeUpload(config.heroImageUploadId);
    return this.get();
  }

  private async removeUpload(uploadId: string) {
    const oldUpload = await this.prisma.upload.findUnique({ where: { id: uploadId } });
    if (!oldUpload) return;
    await this.prisma.upload.delete({ where: { id: oldUpload.id } }).catch(() => {});
    await this.storage.delete(oldUpload.s3Key).catch(() => {});
  }
}
