import { PrismaClient } from '../src/generated/prisma';
import { auth } from '../src/auth/auth';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

const useS3 = process.env.STORAGE_PROVIDER === 's3';

let s3Client: any = null;
let PutObjectCommand: any = null;

async function getS3() {
  if (!s3Client) {
    const sdk = await import('@aws-sdk/client-s3');
    s3Client = new sdk.S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT || 'http://localhost:4566',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || 'test',
        secretAccessKey: process.env.S3_SECRET_KEY || 'test',
      },
      forcePathStyle: true,
    });
    PutObjectCommand = sdk.PutObjectCommand;

    // Ensure bucket exists
    try {
      await s3Client.send(new sdk.HeadBucketCommand({ Bucket: process.env.S3_BUCKET || 'baia-assets' }));
    } catch {
      try {
        await s3Client.send(new sdk.CreateBucketCommand({ Bucket: process.env.S3_BUCKET || 'baia-assets' }));
        console.log(`S3 bucket "${process.env.S3_BUCKET || 'baia-assets'}" created`);
      } catch (e) {
        console.warn('Could not create S3 bucket:', e);
      }
    }
  }
  return { s3Client, PutObjectCommand };
}

async function uploadToS3(filePath: string, s3Key: string, mimeType: string): Promise<string> {
  const { s3Client: client, PutObjectCommand: Cmd } = await getS3();
  const bucket = process.env.S3_BUCKET || 'baia-assets';
  const fileBuffer = fs.readFileSync(filePath);

  await client.send(
    new Cmd({
      Bucket: bucket,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: mimeType,
    }),
  );

  const publicUrl = process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT || 'http://localhost:4566';
  return `${publicUrl}/${bucket}/${s3Key}`;
}

async function createUploadRecord(
  s3Key: string,
  filePath: string,
  mimeType: string,
): Promise<string> {
  const bucket = process.env.S3_BUCKET || 'baia-assets';
  const stats = fs.statSync(filePath);

  const upload = await prisma.upload.create({
    data: {
      s3Key,
      s3Bucket: bucket,
      mimeType,
      sizeBytes: stats.size,
      fileName: path.basename(filePath),
      uploadedBy: null,
    },
  });

  return upload.id;
}

const MEN_PRODUCTS = [
  { nameEn: 'Classic Swim Shorts - Cream', nameHe: 'מכנסי ים קלאסיק - קרם', slug: 'classic-cream', color: 'Cream', image: '/products/men/classic-cream.jpg', price: 149.90, featured: true },
  { nameEn: 'Classic Swim Shorts - Black', nameHe: 'מכנסי ים קלאסיק - שחור', slug: 'classic-black', color: 'Black', image: '/products/men/classic-black.jpg', price: 149.90, featured: true },
  { nameEn: 'Classic Swim Shorts - Yellow', nameHe: 'מכנסי ים קלאסיק - צהוב', slug: 'classic-yellow', color: 'Yellow', image: '/products/men/classic-yellow.jpg', price: 149.90, featured: false },
  { nameEn: 'Classic Swim Shorts - Orange', nameHe: 'מכנסי ים קלאסיק - כתום', slug: 'classic-orange', color: 'Orange', image: '/products/men/classic-orange.jpg', price: 149.90, featured: false },
  { nameEn: 'Classic Swim Shorts - Charcoal', nameHe: 'מכנסי ים קלאסיק - פחם', slug: 'classic-charcoal', color: 'Charcoal', image: '/products/men/classic-charcoal.jpg', price: 149.90, featured: true },
  { nameEn: 'Classic Swim Shorts - Burgundy', nameHe: 'מכנסי ים קלאסיק - בורדו', slug: 'classic-burgundy', color: 'Burgundy', image: '/products/men/classic-burgundy.jpg', price: 149.90, featured: false },
  { nameEn: 'Classic Swim Shorts - Red', nameHe: 'מכנסי ים קלאסיק - אדום', slug: 'classic-red', color: 'Red', image: '/products/men/classic-red.jpg', price: 149.90, featured: false },
  { nameEn: 'Classic Swim Shorts - Green', nameHe: 'מכנסי ים קלאסיק - ירוק', slug: 'classic-green', color: 'Green', image: '/products/men/classic-green.jpg', price: 149.90, featured: false },
  { nameEn: 'Classic Swim Shorts - Brown', nameHe: 'מכנסי ים קלאסיק - חום', slug: 'classic-brown', color: 'Brown', image: '/products/men/classic-brown.jpg', price: 149.90, featured: false },
  { nameEn: 'Classic Swim Shorts - Blue', nameHe: 'מכנסי ים קלאסיק - כחול', slug: 'classic-blue', color: 'Blue', image: '/products/men/classic-blue.jpg', price: 149.90, featured: true },
  { nameEn: 'Classic Swim Shorts - Wine', nameHe: 'מכנסי ים קלאסיק - יין', slug: 'classic-wine', color: 'Wine', image: '/products/men/classic-wine.jpg', price: 149.90, featured: false },
  { nameEn: 'Classic Swim Shorts - Taupe', nameHe: 'מכנסי ים קלאסיק - טאופ', slug: 'classic-taupe', color: 'Taupe', image: '/products/men/classic-taupe.jpg', price: 149.90, featured: false },
  { nameEn: 'Nylon Swim Shorts - Black', nameHe: 'מכנסי ים ניילון - שחור', slug: 'nylon-black', color: 'Black', image: '/products/men/nylon-black.jpg', price: 179.90, featured: true },
  { nameEn: 'Nylon Swim Shorts - Orange', nameHe: 'מכנסי ים ניילון - כתום', slug: 'nylon-orange', color: 'Orange', image: '/products/men/nylon-orange.jpg', price: 179.90, featured: false },
  { nameEn: 'Geometric Print Shorts', nameHe: 'מכנסי ים הדפס גיאומטרי', slug: 'print-geometric', color: 'Brown', image: '/products/men/print-geometric.jpg', price: 189.90, featured: true },
  { nameEn: 'Tile Print Shorts', nameHe: 'מכנסי ים הדפס אריחים', slug: 'print-tile', color: 'Blue', image: '/products/men/print-tile.jpg', price: 189.90, featured: false },
  { nameEn: 'Abstract Camo Shorts', nameHe: 'מכנסי ים קמופלאז\' מופשט', slug: 'print-camo', color: 'Camo', image: '/products/men/print-camo.jpg', price: 189.90, featured: true },
  { nameEn: 'Stripe Swim Shorts', nameHe: 'מכנסי ים פסים', slug: 'print-stripe', color: 'Blue Stripe', image: '/products/men/print-stripe.jpg', price: 189.90, featured: false },
  { nameEn: 'Gingham Swim Shorts', nameHe: 'מכנסי ים משבצות', slug: 'print-gingham', color: 'Yellow', image: '/products/men/print-gingham.jpg', price: 189.90, featured: true },
];

const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

// Resolve path to client public directory (works from both local and Docker)
function resolvePublicPath(imagePath: string): string | null {
  const cwd = process.cwd();
  const candidates = [
    // Running from apps/server/ (pnpm --filter @baia/server prisma:seed)
    path.join(cwd, '../client/public', imagePath),
    // Running from monorepo root
    path.join(cwd, 'apps/client/public', imagePath),
    // Running from apps/server/prisma/
    path.join(cwd, '../../client/public', imagePath),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  console.warn(`  Could not resolve public path: ${imagePath} (cwd: ${cwd})`);
  return null;
}

async function main() {
  console.log('Seeding database...');
  console.log(`Storage provider: ${useS3 ? 's3' : 'local'}`);

  const adminEmail = 'yarinohana9@gmail.com';
  const adminPassword = '123456789';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const ctx = await auth.api.signUpEmail({
      body: { email: adminEmail, password: adminPassword, name: 'Yarin Ohana' },
    });
    if (ctx?.user?.id) {
      await prisma.user.update({
        where: { id: ctx.user.id },
        data: { role: 'ADMIN', emailVerified: true },
      });
      console.log(`Admin user created: ${adminEmail} (password: ${adminPassword})`);
    } else {
      console.error('Failed to create admin user via better-auth');
    }
  } else {
    const hasCredential = await prisma.account.findFirst({
      where: { userId: existingAdmin.id, providerId: 'credential' },
    });
    if (!hasCredential) {
      await prisma.user.delete({ where: { id: existingAdmin.id } });
      const ctx = await auth.api.signUpEmail({
        body: { email: adminEmail, password: adminPassword, name: 'Yarin Ohana' },
      });
      if (ctx?.user?.id) {
        await prisma.user.update({
          where: { id: ctx.user.id },
          data: { role: 'ADMIN', emailVerified: true },
        });
        console.log(`Admin user recreated with password: ${adminEmail}`);
      }
    } else {
      console.log(`Admin user already exists: ${adminEmail}`);
    }
  }

  // Seed SiteConfig with hero image (upload to S3 if available)
  const existingSiteConfig = await prisma.siteConfig.findUnique({ where: { id: 'default' } });
  const needsHeroUpload = !existingSiteConfig?.heroImageUploadId;

  let heroImageUrl: string | null = existingSiteConfig?.heroImageUrl || null;
  let heroImageUploadId: string | null = existingSiteConfig?.heroImageUploadId || null;

  if (needsHeroUpload) {
    if (useS3) {
      const heroPath = resolvePublicPath('/hero/hero-banner.png');
      if (heroPath) {
        const uid = randomUUID();
        const s3Key = `site/hero-${uid}.png`;
        try {
          heroImageUrl = await uploadToS3(heroPath, s3Key, 'image/png');
          heroImageUploadId = await createUploadRecord(s3Key, heroPath, 'image/png');
          console.log(`  S3: hero-banner.png → ${s3Key}`);
        } catch {
          console.warn('  S3 upload failed for hero banner, using local path');
          heroImageUrl = '/hero/hero-banner.png';
        }
      }
    } else {
      heroImageUrl = '/hero/hero-banner.png';
    }
  }

  await prisma.siteConfig.upsert({
    where: { id: 'default' },
    update: {
      heroImageUrl: heroImageUrl ?? undefined,
      heroImageUploadId: heroImageUploadId ?? undefined,
    },
    create: {
      id: 'default',
      shippingCost: 29.90,
      freeShippingThreshold: 249,
      heroTitleHe: 'קולקציית קיץ 2026',
      heroTitleEn: 'Summer Collection 2026',
      heroSubtitleHe: 'בגדי ים לכל המשפחה',
      heroSubtitleEn: 'Swimwear for the whole family',
      heroImageUrl,
      heroImageUploadId,
    },
  });

  // Helper: upload category image to S3 and return { image, imageUploadId }
  async function seedCategoryImage(localPath: string): Promise<{ image: string | null; imageUploadId: string | null }> {
    if (useS3) {
      const filePath = resolvePublicPath(localPath);
      if (filePath) {
        const uid = randomUUID();
        const ext = path.extname(localPath).slice(1) || 'jpg';
        const s3Key = `categories/seed/${uid}.${ext}`;
        try {
          const url = await uploadToS3(filePath, s3Key, `image/${ext}`);
          const uploadId = await createUploadRecord(s3Key, filePath, `image/${ext}`);
          console.log(`  S3: ${localPath} → ${s3Key}`);
          return { image: url, imageUploadId: uploadId };
        } catch {
          console.warn(`  S3 upload failed for ${localPath}, using local path`);
        }
      }
    }
    return { image: localPath, imageUploadId: null };
  }

  // Seed categories — always runs (upsert with image update)
  async function upsertCategoryWithImage(
    slug: string, nameHe: string, nameEn: string, sortOrder: number, imagePath: string,
  ) {
    const existing = await prisma.category.findUnique({ where: { slug } });
    const needsImage = !existing?.imageUploadId;
    const imgData = needsImage ? await seedCategoryImage(imagePath) : { image: existing?.image, imageUploadId: existing?.imageUploadId };

    return prisma.category.upsert({
      where: { slug },
      update: {
        image: imgData.image ?? undefined,
        imageUploadId: imgData.imageUploadId ?? undefined,
      },
      create: { nameHe, nameEn, slug, sortOrder, image: imgData.image, imageUploadId: imgData.imageUploadId },
    });
  }

  const men = await upsertCategoryWithImage('men', 'גברים', 'Men', 1, '/categories/men.jpg');
  const women = await upsertCategoryWithImage('women', 'נשים', 'Women', 2, '/categories/women.jpg');
  const children = await upsertCategoryWithImage('children', 'ילדים', 'Children', 3, '/categories/kids.jpg');

  const existingProducts = await prisma.product.count();
  if (existingProducts > 0) {
    console.log(`${existingProducts} products already exist, skipping product seed.`);
    console.log('To re-seed, run: prisma migrate reset');
    return;
  }

  const menSwimShorts = await prisma.category.upsert({
    where: { slug: 'men-swim-shorts' },
    update: {},
    create: { nameHe: 'מכנסי ים', nameEn: 'Swim Shorts', slug: 'men-swim-shorts', parentId: men.id, sortOrder: 1 },
  });

  const subCategories = [
    { nameHe: 'בורד שורטס', nameEn: 'Board Shorts', slug: 'men-board-shorts', parentId: men.id, sortOrder: 2 },
    { nameHe: 'ביקיני', nameEn: 'Bikini Sets', slug: 'women-bikini', parentId: women.id, sortOrder: 1 },
    { nameHe: 'שלם', nameEn: 'One-Piece', slug: 'women-one-piece', parentId: women.id, sortOrder: 2 },
    { nameHe: 'כיסויים', nameEn: 'Cover-Ups', slug: 'women-cover-ups', parentId: women.id, sortOrder: 3 },
    { nameHe: 'בנים', nameEn: 'Boys Swim', slug: 'children-boys', parentId: children.id, sortOrder: 1 },
    { nameHe: 'בנות', nameEn: 'Girls Swim', slug: 'children-girls', parentId: children.id, sortOrder: 2 },
  ];

  for (const cat of subCategories) {
    await prisma.category.upsert({ where: { slug: cat.slug }, update: {}, create: cat });
  }
  console.log('Categories seeded');

  for (const product of MEN_PRODUCTS) {
    let imageUrl = product.image;
    let uploadId: string | undefined;

    if (useS3) {
      const filePath = resolvePublicPath(product.image);
      if (filePath) {
        const uid = randomUUID();
        const ext = path.extname(product.image).slice(1) || 'jpg';
        const s3Key = `products/seed/${uid}.${ext}`;
        try {
          imageUrl = await uploadToS3(filePath, s3Key, 'image/jpeg');
          uploadId = await createUploadRecord(s3Key, filePath, 'image/jpeg');
          console.log(`  S3: ${product.image} → ${s3Key}`);
        } catch (e) {
          console.warn(`  S3 upload failed for ${product.image}, using local path`);
        }
      }
    }

    const created = await prisma.product.create({
      data: {
        nameHe: product.nameHe,
        nameEn: product.nameEn,
        slug: product.slug,
        descriptionHe: `מכנסי ים איכותיים מבד מתייבש מהר עם שרוך מותאם. צבע: ${product.color}`,
        descriptionEn: `Premium swim shorts with quick-dry fabric and adjustable drawstring. Color: ${product.color}`,
        basePrice: product.price,
        categoryId: menSwimShorts.id,
        isFeatured: product.featured,
        isActive: true,
        images: {
          create: [{
            url: imageUrl,
            uploadId: uploadId || null,
            color: product.color,
            altText: product.nameEn,
            sortOrder: 0,
          }],
        },
      },
    });

    for (const size of SIZES) {
      await prisma.productVariant.create({
        data: {
          productId: created.id,
          color: product.color,
          size,
          sku: `${product.slug}-${size.toLowerCase()}`,
          stockQuantity: Math.floor(Math.random() * 15) + 5,
          isActive: true,
        },
      });
    }

    console.log(`  + ${product.nameEn}`);
  }

  console.log(`\nSeeded ${MEN_PRODUCTS.length} products with ${MEN_PRODUCTS.length * SIZES.length} variants`);
  console.log('Seeding complete!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
