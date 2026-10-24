/**
 * Storage end-to-end check against the configured bucket (LocalStack locally, the real
 * bucket on Railway). Run from apps/server after `nest build`:
 *
 *   node --import tsx scripts/storage-e2e.ts            # full product flow (local DB only)
 *   node --import tsx scripts/storage-e2e.ts --storage  # bucket only: upload, read, delete
 *
 * Full mode creates a throwaway inactive product "storage-e2e-<time>", uploads an image
 * with it, adds and deletes a second image, then deletes the product, checking the
 * bucket after every step. `--storage` never touches the database (safe for production).
 */
import { NestFactory } from '@nestjs/core';
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { buildS3ClientConfig } from '../dist/storage/s3-client-options';
import { AppModule } from '../dist/app.module';
import { ProductsService } from '../dist/products/products.service';
import { PrismaService } from '../dist/prisma/prisma.service';
import { S3StorageService } from '../dist/storage/s3-storage.service';

type Storage = { upload(b: Buffer, k: string, m: string): Promise<string>; delete(k: string): Promise<void>; getUrl(k: string): string };

// 1x1 transparent PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

const step = (ok: boolean, label: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) process.exitCode = 1;
};

async function status(url: string) {
  const res = await fetch(url, { cache: 'no-store' });
  return res.status;
}

async function storageOnly(storage: Storage) {
  const key = `healthcheck/storage-e2e-${Date.now()}.png`;
  const url = await storage.upload(PNG, key, 'image/png');
  step(true, `uploaded ${key}`);
  step((await status(url)) === 200, `public URL serves the file (${new URL(url).host})`);
  await storage.delete(key);
  step(!(await existsInBucket(key)), 'deleted: the object is gone from the bucket');
  // A CDN in front of the bucket may keep serving its cached copy for a while; a fresh URL skips the cache.
  const fresh = await status(`${url}?nocache=${Date.now()}`);
  step(fresh === 403 || fresh === 404, `deleted: uncached URL returns ${fresh}`);
  console.log(`info  cached URL returns ${await status(url)} (CDN cache, expires on its own)`);
}

async function existsInBucket(key: string) {
  const client = new S3Client(buildS3ClientConfig(process.env));
  try {
    await client.send(new HeadObjectCommand({ Bucket: process.env.S3_BUCKET || 'baia-assets', Key: key }));
    return true;
  } catch (err) {
    const code = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (code === 404) return false;
    throw err;
  }
}

async function productFlow(app: Awaited<ReturnType<typeof NestFactory.createApplicationContext>>) {
  const products = app.get(ProductsService);
  const prisma = app.get(PrismaService);
  const category = await prisma.category.findFirst({ select: { id: true } });
  if (!category) throw new Error('No category to attach the test product to');

  const slug = `storage-e2e-${Date.now()}`;
  const file = { buffer: PNG, originalname: 'e2e.png', mimetype: 'image/png', size: PNG.length };
  const created = await products.create(
    { nameHe: 'בדיקת אחסון', nameEn: 'Storage check', slug, basePrice: 1, categoryId: category.id, isActive: false },
    [file],
  );
  const firstUrl = created.images[0]?.url;
  step(!!firstUrl, 'product created with its image');
  step((await status(firstUrl)) === 200, 'product image is served from the bucket');

  const second = await products.uploadImage(created.id, { ...file, originalname: 'e2e-2.png' });
  const secondUrl = second.url;
  step((await status(secondUrl)) === 200, 'second image uploaded and served');

  await products.deleteImage(second.id);
  const afterImageDelete = await status(secondUrl);
  step(afterImageDelete === 403 || afterImageDelete === 404, `deleted image is gone from the bucket (${afterImageDelete})`);

  const result = await products.delete(created.id);
  step('deleted' in result, 'product deleted (no orders, so not archived)');
  const afterProductDelete = await status(firstUrl);
  step(afterProductDelete === 403 || afterProductDelete === 404, `product's image is gone from the bucket (${afterProductDelete})`);
  step((await prisma.product.count({ where: { slug } })) === 0, 'no product row left behind');
}

async function main() {
  console.log(`Storage: ${process.env.STORAGE_PROVIDER} bucket=${process.env.S3_BUCKET} endpoint=${process.env.S3_ENDPOINT ?? '(aws default)'}`);
  if (process.argv.includes('--storage')) {
    // Bucket only: no Nest app, so no database connection and no scheduled jobs.
    const storage = new S3StorageService();
    await storage.onModuleInit?.();
    await storageOnly(storage);
    return;
  }
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    await productFlow(app);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('FAIL ', err);
  process.exit(1);
});
