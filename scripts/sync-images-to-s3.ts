/**
 * Sync script: Re-upload all images tracked in the Upload table to S3.
 * 
 * This is needed when LocalStack is restarted (fresh S3 bucket) but DB 
 * still has Upload records pointing to S3 keys from a previous session.
 *
 * Usage:
 *   pnpm --filter @baia/server exec tsx ../../scripts/sync-images-to-s3.ts
 */

import { PrismaClient } from '../apps/server/src/generated/prisma';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const endpoint = process.env.S3_ENDPOINT || 'http://localhost:4566';
const region = process.env.S3_REGION || 'us-east-1';
const bucket = process.env.S3_BUCKET || 'baia-assets';

const s3 = new S3Client({
  region,
  endpoint,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || 'test',
    secretAccessKey: process.env.S3_SECRET_KEY || 'test',
  },
  forcePathStyle: true,
});

const CLIENT_PUBLIC = path.resolve(__dirname, '../apps/client/public');

async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`Bucket "${bucket}" created`);
  }
}

async function objectExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

function findLocalFile(s3Key: string): string | null {
  // Try to match s3Key back to a local public file
  // Product images: products/{productId}/{uuid}.jpg → find by productImage.url or original filename
  // Category images: categories/seed/{uuid}.jpg → find by category.image
  // Hero: site/hero-{uuid}.png → /hero/hero-banner.png

  if (s3Key.startsWith('site/hero')) {
    const heroPath = path.join(CLIENT_PUBLIC, 'hero/hero-banner.png');
    if (fs.existsSync(heroPath)) return heroPath;
    const heroJpg = path.join(CLIENT_PUBLIC, 'hero/hero-banner.jpg');
    if (fs.existsSync(heroJpg)) return heroJpg;
  }

  return null;
}

async function main() {
  console.log('=== S3 Image Sync ===');
  console.log(`Endpoint: ${endpoint} | Bucket: ${bucket}`);

  await ensureBucket();

  const uploads = await prisma.upload.findMany();
  console.log(`Found ${uploads.length} Upload records in DB`);

  let synced = 0;
  let skipped = 0;
  let missing = 0;

  for (const upload of uploads) {
    // Check if object already exists in S3
    if (await objectExists(upload.s3Key)) {
      skipped++;
      continue;
    }

    // Find the local source file
    // First: check product images
    const productImage = await prisma.productImage.findFirst({
      where: { uploadId: upload.id },
    });

    let localPath: string | null = null;

    if (productImage) {
      // Try the original public path pattern: /products/men/classic-cream.jpg
      // The URL in DB might be the S3 URL, but the original was in public/
      const publicFiles = fs.readdirSync(path.join(CLIENT_PUBLIC, 'products/men'), { withFileTypes: true })
        .filter(f => f.isFile())
        .map(f => f.name);
      
      // Match by original filename stored in upload record
      const origName = upload.fileName;
      const candidate = path.join(CLIENT_PUBLIC, 'products/men', origName);
      if (fs.existsSync(candidate)) {
        localPath = candidate;
      }
    }

    // Check category images
    if (!localPath) {
      const category = await prisma.category.findFirst({
        where: { imageUploadId: upload.id },
      });
      if (category) {
        // Category images: men.jpg, women.jpg, kids.jpg
        const slug = category.slug;
        for (const name of [`${slug}.jpg`, `${slug}.png`]) {
          const candidate = path.join(CLIENT_PUBLIC, 'categories', name);
          if (fs.existsSync(candidate)) {
            localPath = candidate;
            break;
          }
        }
        // Special case: children → kids
        if (!localPath && slug === 'children') {
          const kidsPath = path.join(CLIENT_PUBLIC, 'categories/kids.jpg');
          if (fs.existsSync(kidsPath)) localPath = kidsPath;
        }
      }
    }

    // Check hero image
    if (!localPath) {
      localPath = findLocalFile(upload.s3Key);
    }

    if (!localPath) {
      console.warn(`  ✗ No local file for: ${upload.s3Key} (${upload.fileName})`);
      missing++;
      continue;
    }

    // Upload to S3
    const fileBuffer = fs.readFileSync(localPath);
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: upload.s3Key,
      Body: fileBuffer,
      ContentType: upload.mimeType,
      CacheControl: 'public, max-age=31536000, immutable',
    }));

    synced++;
    console.log(`  ✓ ${upload.s3Key} ← ${path.relative(CLIENT_PUBLIC, localPath)}`);
  }

  console.log(`\nDone: ${synced} synced, ${skipped} already in S3, ${missing} missing source`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
