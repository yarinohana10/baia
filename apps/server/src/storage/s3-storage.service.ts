import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { StorageService } from './storage.interface';
import { buildS3ClientConfig } from './s3-client-options';

@Injectable()
export class S3StorageService implements StorageService, OnModuleInit {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly publicUrlIncludesBucket: boolean;

  private readonly logger = new Logger(S3StorageService.name);

  constructor() {
    this.bucket = process.env.S3_BUCKET || 'baia-assets';

    // CDN_URL takes priority (e.g. CloudFront/Cloudflare), then S3_PUBLIC_URL, then endpoint
    this.publicUrl = (process.env.CDN_URL || process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT || '').replace(/\/+$/, '');

    // Public URL layout: `${publicUrl}/${bucket}/${key}` (path style: LocalStack,
    // MinIO, S3 website endpoints) or `${publicUrl}/${key}` when the public URL
    // already points at the bucket (Cloudflare R2 public domain, CDN origin).
    this.publicUrlIncludesBucket = process.env.S3_PUBLIC_URL_INCLUDES_BUCKET?.trim().toLowerCase() !== 'false';

    // Endpoint, region, path style and checksums for LocalStack / R2 / MinIO / AWS: see s3-client-options.ts
    this.client = new S3Client(buildS3ClientConfig(process.env));
  }

  /**
   * Boot-time bucket check. NEVER throws: a deploy must not be blocked because a
   * (least-privilege) token cannot HeadBucket/CreateBucket. Uploads still fail
   * loudly later if the bucket or credentials are really wrong.
   * Outside production a missing bucket is created (LocalStack); in production
   * it is not: create the bucket in the provider's dashboard.
   */
  async onModuleInit() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return;
    } catch (headErr) {
      const status = (headErr as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
      const name = (headErr as { name?: string })?.name;
      const missing = status === 404 || name === 'NotFound' || name === 'NoSuchBucket';

      if (process.env.NODE_ENV === 'production') {
        this.logger.error(
          missing
            ? `S3 bucket "${this.bucket}" was not found at the configured endpoint. Create it in the storage provider's dashboard; image uploads will fail until it exists.`
            : `Could not verify S3 bucket "${this.bucket}" (${name ?? 'unknown error'}${status ? `, HTTP ${status}` : ''}). Check S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY and S3_SECRET_KEY; image uploads will fail until fixed. Continuing to boot.`,
        );
        return;
      }
      if (!missing && status !== undefined) {
        this.logger.warn(`Could not verify S3 bucket "${this.bucket}" (${name ?? 'error'}, HTTP ${status}); trying to create it.`);
      }
    }
    try {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`S3 bucket "${this.bucket}" created`);
    } catch (createErr) {
      this.logger.warn(`Could not create S3 bucket "${this.bucket}": ${(createErr as Error)?.message ?? createErr}`);
    }
  }

  async upload(file: Buffer, key: string, mimeType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file,
        ContentType: mimeType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return this.getUrl(key);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  getUrl(key: string): string {
    return this.publicUrlIncludesBucket ? `${this.publicUrl}/${this.bucket}/${key}` : `${this.publicUrl}/${key}`;
  }

  getBucket(): string {
    return this.bucket;
  }
}
