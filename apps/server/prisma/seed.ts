import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Seed admin user
  const adminEmail = 'yarinohana9@gmail.com';
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Yarin Ohana',
        role: 'ADMIN',
        emailVerified: true,
      },
    });
    console.log(`Admin user created: ${adminEmail}`);
  } else {
    console.log(`Admin user already exists: ${adminEmail}`);
  }

  // Seed site config
  const existingConfig = await prisma.siteConfig.findUnique({
    where: { id: 'default' },
  });

  if (!existingConfig) {
    await prisma.siteConfig.create({
      data: {
        id: 'default',
        shippingCost: 29.90,
        freeShippingThreshold: 249,
        heroTitleHe: 'קולקציית קיץ 2026',
        heroTitleEn: 'Summer Collection 2026',
        heroSubtitleHe: 'בגדי ים לכל המשפחה',
        heroSubtitleEn: 'Swimwear for the whole family',
      },
    });
    console.log('Site config created');
  }

  // Seed categories
  const existingCategories = await prisma.category.count();
  if (existingCategories === 0) {
    const men = await prisma.category.create({
      data: { nameHe: 'גברים', nameEn: 'Men', slug: 'men', sortOrder: 1 },
    });
    const women = await prisma.category.create({
      data: { nameHe: 'נשים', nameEn: 'Women', slug: 'women', sortOrder: 2 },
    });
    const children = await prisma.category.create({
      data: { nameHe: 'ילדים', nameEn: 'Children', slug: 'children', sortOrder: 3 },
    });

    await prisma.category.createMany({
      data: [
        { nameHe: 'מכנסי ים', nameEn: 'Swim Shorts', slug: 'men-swim-shorts', parentId: men.id, sortOrder: 1 },
        { nameHe: 'בורד שורטס', nameEn: 'Board Shorts', slug: 'men-board-shorts', parentId: men.id, sortOrder: 2 },
        { nameHe: 'ביקיני', nameEn: 'Bikini Sets', slug: 'women-bikini', parentId: women.id, sortOrder: 1 },
        { nameHe: 'שלם', nameEn: 'One-Piece', slug: 'women-one-piece', parentId: women.id, sortOrder: 2 },
        { nameHe: 'כיסויים', nameEn: 'Cover-Ups', slug: 'women-cover-ups', parentId: women.id, sortOrder: 3 },
        { nameHe: 'בנים', nameEn: 'Boys Swim', slug: 'children-boys', parentId: children.id, sortOrder: 1 },
        { nameHe: 'בנות', nameEn: 'Girls Swim', slug: 'children-girls', parentId: children.id, sortOrder: 2 },
      ],
    });
    console.log('Categories seeded');
  }

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
