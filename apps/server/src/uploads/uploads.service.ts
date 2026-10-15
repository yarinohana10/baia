import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService, STORAGE_SERVICE } from '../storage/storage.interface';
import { randomUUID } from 'crypto';

@Injectable()
export class UploadsService {
  constructor(
    private prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private storage: StorageService,
  ) {}

  async upload(
    file: Buffer,
    originalName: string,
    mimeType: string,
    sizeBytes: number,
    keyPrefix: string,
    uploadedBy?: string,
  ) {
    const ext = originalName.split('.').pop() || 'bin';
    const uploadId = randomUUID();
    const s3Key = `${keyPrefix}/${uploadId}.${ext}`;
    const bucket = this.getBucket();

    await this.storage.upload(file, s3Key, mimeType);

    const upload = await this.prisma.upload.create({
      data: {
        s3Key,
        s3Bucket: bucket,
        mimeType,
        sizeBytes,
        fileName: originalName,
        uploadedBy,
      },
    });

    return {
      ...upload,
      url: this.storage.getUrl(s3Key),
    };
  }

  async findById(id: string) {
    const upload = await this.prisma.upload.findUnique({ where: { id } });
    if (!upload) throw new NotFoundException('Upload not found');
    return {
      ...upload,
      url: this.storage.getUrl(upload.s3Key),
    };
  }

  async delete(id: string) {
    const upload = await this.prisma.upload.findUnique({ where: { id } });
    if (!upload) throw new NotFoundException('Upload not found');

    await this.storage.delete(upload.s3Key);
    await this.prisma.upload.delete({ where: { id } });

    return { deleted: true };
  }

  getUrl(s3Key: string): string {
    return this.storage.getUrl(s3Key);
  }

  private getBucket(): string {
    return process.env.S3_BUCKET || 'baia-assets';
  }
}
