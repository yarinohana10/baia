import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { StorageService } from './storage.interface';

@Injectable()
export class S3StorageService implements StorageService, OnModuleInit {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly publicUrlIncludesBucket: boolean;

  constructor() {
    const endpoint = process.env.S3_ENDPOINT;
    const region = process.env.S3_REGION || 'us-east-1';
    const accessKeyId = process.env.S3_ACCESS_KEY || 'test';
    const secretAccessKey = process.env.S3_SECRET_KEY || 'test';

    this.bucket = process.env.S3_BUCKET || 'baia-assets';

    // CDN_URL takes priority (e.g. CloudFront/Cloudflare), then S3_PUBLIC_URL, then endpoint
    this.publicUrl = (process.env.CDN_URL || process.env.S3_PUBLIC_URL || endpoint || '').replace(/\/+$/, '');

    // Public URL layout: `${publicUrl}/${bucket}/${key}` (path style: LocalStack,
    // MinIO, S3 website endpoints) or `${publicUrl}/${key}` when the public URL
    // already points at the bucket (Cloudflare R2 public domain, CDN origin).
    this.publicUrlIncludesBucket = process.env.S3_PUBLIC_URL_INCLUDES_BUCKET?.trim().toLowerCase() !== 'false';

    // forcePathStyle is required for LocalStack/MinIO but not for real AWS S3.
    // S3_FORCE_PATH_STYLE overrides the localhost heuristic (e.g. MinIO on a
    // Docker network hostname).
    const isLocalEndpoint = !!endpoint && (endpoint.includes('localhost') || endpoint.includes('127.0.0.1'));
    const forcePathStyleEnv = process.env.S3_FORCE_PATH_STYLE?.trim().toLowerCase();
    const forcePathStyle = forcePathStyleEnv ? forcePathStyleEnv === 'true' : isLocalEndpoint;

    this.client = new S3Client({
      region,
      ...(endpoint ? { endpoint } : {}),
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle,
    });
  }

  async onModuleInit() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        console.log(`S3 bucket "${this.bucket}" created`);
      } catch (createErr) {
        console.warn(`Could not create S3 bucket "${this.bucket}":`, createErr);
      }
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
