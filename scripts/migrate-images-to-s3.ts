/**
 * Migration script: Move existing images from local filesystem to S3.
 *
 * This script:
 * 1. Reads all ProductImage records where uploadId IS NULL
 * 2. Resolves the file from apps/client/public/{url}
 * 3. Uploads to S3 at products/{productId}/{uuid}.{ext}
 * 4. Creates an Upload record
 * 5. Updates ProductImage.uploadId
 *
 * Usage:
 *   npx ts-node scripts/migrate-images-to-s3.ts
 *
 * Prerequisites:
 *   - S3 must be accessible (LocalStack running or real S3 configured)
 *   - Environment variables: S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET
 *   - DATABASE_URL must be set
 */

import { PrismaClient } from '../apps/server/src/generated/prisma';
import {
  S3Client,
  PutObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import * as mime from 'mime-types';

const prisma = new PrismaClient();

const endpoint = process.env.S3_ENDPOINT || 'http://localhost:4566';
const region = process.env.S3_REGION || 'us-east-1';
const accessKeyId = process.env.S3_ACCESS_KEY || 'test';
const secretAccessKey = process.env.S3_SECRET_KEY || 'test';
const bucket = process.env.S3_BUCKET || 'baia-assets';
const publicUrl = process.env.S3_PUBLIC_URL || endpoint;

const s3 = new S3Client({
  region,
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,
});

const CLIENT_PUBLIC = path.resolve(__dirname, '../apps/client/public');

async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`Bucket "${bucket}" already exists`);
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`Bucket "${bucket}" created`);
  }
}

async function migrateProductImages() {
  const images = await prisma.productImage.findMany({
    where: { uploadId: null },
    include: { product: true },
  });

  console.log(`Found ${images.length} product images to migrate`);

  let migrated = 0;
  let skipped = 0;

  for (const image of images) {
    const filePath = path.join(CLIENT_PUBLIC, image.url);

    if (!fs.existsSync(filePath)) {
      console.warn(`  SKIP: File not found: ${filePath}`);
      skipped++;
      continue;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(image.url).slice(1) || 'jpg';
    const uploadId = randomUUID();
    const s3Key = `products/${image.productId}/${uploadId}.${ext}`;
    const mimeType = mime.lookup(filePath) || 'image/jpeg';

    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: s3Key,
          Body: fileBuffer,
          ContentType: mimeType,
        }),
      );

      const upload = await prisma.upload.create({
        data: {
          s3Key,
          s3Bucket: bucket,
          mimeType,
          sizeBytes: fileBuffer.length,
          fileName: path.basename(image.url),
          uploadedBy: null,
        },
      });

      await prisma.productImage.update({
        where: { id: image.id },
        data: {
          uploadId: upload.id,
          url: `${publicUrl}/${bucket}/${s3Key}`,
        },
      });

      migrated++;
      console.log(`  ✓ ${image.url} → s3://${bucket}/${s3Key}`);
    } catch (err) {
      console.error(`  ✗ Failed to migrate ${image.url}:`, err);
      skipped++;
    }
  }

  console.log(`Product images: ${migrated} migrated, ${skipped} skipped`);
}

async function migrateCategoryImages() {
  const categories = await prisma.category.findMany({
    where: {
      image: { not: null },
      imageUploadId: null,
    },
  });

  console.log(`Found ${categories.length} category images to migrate`);

  let migrated = 0;
  let skipped = 0;

  for (const category of categories) {
    if (!category.image) continue;

    const filePath = path.join(CLIENT_PUBLIC, category.image);

    if (!fs.existsSync(filePath)) {
      console.warn(`  SKIP: File not found: ${filePath}`);
      skipped++;
      continue;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(category.image).slice(1) || 'jpg';
    const uploadId = randomUUID();
    const s3Key = `categories/${category.id}/${uploadId}.${ext}`;
    const mimeType = mime.lookup(filePath) || 'image/jpeg';

    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: s3Key,
          Body: fileBuffer,
          ContentType: mimeType,
        }),
      );

      const upload = await prisma.upload.create({
        data: {
          s3Key,
          s3Bucket: bucket,
          mimeType,
          sizeBytes: fileBuffer.length,
          fileName: path.basename(category.image),
          uploadedBy: null,
        },
      });

      await prisma.category.update({
        where: { id: category.id },
        data: {
          imageUploadId: upload.id,
          image: `${publicUrl}/${bucket}/${s3Key}`,
        },
      });

      migrated++;
      console.log(`  ✓ ${category.image} → s3://${bucket}/${s3Key}`);
    } catch (err) {
      console.error(`  ✗ Failed to migrate ${category.image}:`, err);
      skipped++;
    }
  }

  console.log(`Category images: ${migrated} migrated, ${skipped} skipped`);
}

async function migrateHeroImage() {
  const config = await prisma.siteConfig.findUnique({
    where: { id: 'default' },
  });

  if (!config?.heroImageUrl || config.heroImageUploadId) {
    console.log('Hero image: nothing to migrate');
    return;
  }

  const filePath = path.join(CLIENT_PUBLIC, config.heroImageUrl);

  if (!fs.existsSync(filePath)) {
    console.warn(`Hero image file not found: ${filePath}`);
    return;
  }

  const fileBuffer = fs.readFileSync(filePath);
  const ext = path.extname(config.heroImageUrl).slice(1) || 'jpg';
  const uploadId = randomUUID();
  const s3Key = `site/${uploadId}.${ext}`;
  const mimeType = mime.lookup(filePath) || 'image/jpeg';

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: mimeType,
      }),
    );

    const upload = await prisma.upload.create({
      data: {
        s3Key,
        s3Bucket: bucket,
        mimeType,
        sizeBytes: fileBuffer.length,
        fileName: path.basename(config.heroImageUrl),
        uploadedBy: null,
      },
    });

    await prisma.siteConfig.update({
      where: { id: 'default' },
      data: {
        heroImageUploadId: upload.id,
        heroImageUrl: `${publicUrl}/${bucket}/${s3Key}`,
      },
    });

    console.log(`Hero image: ✓ ${config.heroImageUrl} → s3://${bucket}/${s3Key}`);
  } catch (err) {
    console.error(`Hero image: ✗ Failed to migrate:`, err);
  }
}

async function main() {
  console.log('=== Image Migration to S3 ===');
  console.log(`S3 Endpoint: ${endpoint}`);
  console.log(`Bucket: ${bucket}`);
  console.log(`Client public dir: ${CLIENT_PUBLIC}`);
  console.log('');

  await ensureBucket();
  console.log('');

  await migrateProductImages();
  console.log('');

  await migrateCategoryImages();
  console.log('');

  await migrateHeroImage();
  console.log('');

  console.log('=== Migration complete ===');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
