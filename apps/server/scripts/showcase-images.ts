/**
 * Puts store images in place through the same services the Admin panel uses, so
 * every image gets its Upload row and storage object and can be removed from the
 * Admin later (Settings → hero banner, Products → image gallery).
 *
 * Run from apps/server after `nest build` (with the target environment's env):
 *
 *   node --import tsx scripts/showcase-images.ts --hero <file>
 *   node --import tsx scripts/showcase-images.ts --image <file> --products slug-a,slug-b [--position 2]
 *   ... add --dry-run to only print what would change
 *
 * `--image` adds the file to each listed product (skipped when that product already
 * has an image with the same file name) and moves it to `--position` (default 2, the
 * photo shown when a shopper hovers the product card).
 */
import { readFileSync } from 'fs';
import { basename, extname } from 'path';
import { PrismaService } from '../dist/prisma/prisma.service';
import { S3StorageService } from '../dist/storage/s3-storage.service';
import { ProductImagesService } from '../dist/products/product-images.service';
import { SiteConfigService } from '../dist/site-config/site-config.service';

const MIME: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function readImage(path: string) {
  const mimetype = MIME[extname(path).toLowerCase()];
  if (!mimetype) throw new Error(`Unsupported image type: ${path}`);
  const buffer = readFileSync(path);
  return { buffer, originalname: basename(path), mimetype, size: buffer.length };
}

async function setHero(prisma: PrismaService, storage: S3StorageService, path: string, dryRun: boolean) {
  const file = readImage(path);
  const before = await prisma.siteConfig.findUnique({ where: { id: 'default' }, select: { heroImageUploadId: true } });
  console.log(`hero: ${file.originalname} (${Math.round(file.size / 1024)} KB), replaces upload ${before?.heroImageUploadId ?? '(none)'}`);
  if (dryRun) return;
  const config = await new SiteConfigService(prisma, storage).uploadHeroImage(file.buffer, file.originalname, file.mimetype);
  console.log(`hero: now ${config.heroImageUrl}`);
}

async function addToProducts(
  prisma: PrismaService,
  images: ProductImagesService,
  path: string,
  slugs: string[],
  position: number,
  dryRun: boolean,
) {
  const file = readImage(path);
  for (const slug of slugs) {
    const product = await prisma.product.findUnique({
      where: { slug },
      select: { id: true, images: { orderBy: { sortOrder: 'asc' }, select: { id: true, upload: { select: { fileName: true } } } } },
    });
    if (!product) {
      console.log(`${slug}: not found, skipped`);
      continue;
    }
    if (product.images.some((img) => img.upload?.fileName === file.originalname)) {
      console.log(`${slug}: already has ${file.originalname}, skipped`);
      continue;
    }
    console.log(`${slug}: ${product.images.length} image(s) -> add ${file.originalname} at position ${position}`);
    if (dryRun) continue;
    const added = await images.upload(product.id, file, { altTextHe: 'בגד ים BAIA', altTextEn: 'BAIA swimwear' });
    const order = product.images.map((img) => img.id);
    order.splice(Math.min(Math.max(position - 1, 0), order.length), 0, added.id);
    await images.reorder(product.id, order);
    console.log(`${slug}: added ${added.url}`);
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const prisma = new PrismaService();
  const storage = new S3StorageService();
  await storage.onModuleInit?.();
  try {
    const hero = arg('hero');
    if (hero) await setHero(prisma, storage, hero, dryRun);
    const image = arg('image');
    if (image) {
      const slugs = (arg('products') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      if (!slugs.length) throw new Error('--image needs --products slug-a,slug-b');
      await addToProducts(prisma, new ProductImagesService(prisma, storage), image, slugs, Number(arg('position') ?? 2), dryRun);
    }
    if (!hero && !image) console.log('Nothing to do: pass --hero <file> and/or --image <file> --products <slugs>');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('FAIL ', err);
  process.exit(1);
});
