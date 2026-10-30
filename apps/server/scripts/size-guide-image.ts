/**
 * Uploads a how-to-measure illustration to a size guide, through the same
 * service the admin "Choose image" button uses (assets bucket + Upload row;
 * the previous image is removed). For environments without an admin login at hand.
 *
 * Run from apps/server after `nest build`, with the target environment's env:
 *
 *   node --import tsx scripts/size-guide-image.ts <guide-slug> <image-file>
 *
 * The storefront shows the new image within its 5-minute cache window.
 */
import { readFileSync } from 'fs';
import { basename } from 'path';
import { PrismaService } from '../dist/prisma/prisma.service';
import { S3StorageService } from '../dist/storage/s3-storage.service';
import { SizeGuidesService } from '../dist/size-guides/size-guides.service';
import { detectImageMime } from '../dist/storage/image-upload.guard';

async function main() {
  const [slug, file] = process.argv.slice(2);
  if (!slug || !file) throw new Error('Usage: size-guide-image.ts <guide-slug> <image-file>');

  const buffer = readFileSync(file);
  const mime = detectImageMime(buffer);
  if (!mime) throw new Error(`${file} is not a jpeg/png/webp/avif/gif image`);

  const prisma = new PrismaService();
  const storage = new S3StorageService();
  await storage.onModuleInit?.();
  try {
    const guide = await prisma.sizeGuide.findUnique({ where: { slug }, select: { id: true } });
    if (!guide) throw new Error(`No size guide with slug "${slug}"`);
    const updated = await new SizeGuidesService(prisma, storage).uploadImage(guide.id, buffer, basename(file), mime);
    console.log(`${slug}: ${updated.imageUrl}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
