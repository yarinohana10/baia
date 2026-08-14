import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

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

async function main() {
  console.log('Seeding database...');

  const adminEmail = 'yarinohana9@gmail.com';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    await prisma.user.create({
      data: { email: adminEmail, name: 'Yarin Ohana', role: 'ADMIN', emailVerified: true },
    });
    console.log(`Admin user created: ${adminEmail}`);
  }

  await prisma.siteConfig.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      shippingCost: 29.90,
      freeShippingThreshold: 249,
      heroTitleHe: 'קולקציית קיץ 2026',
      heroTitleEn: 'Summer Collection 2026',
      heroSubtitleHe: 'בגדי ים לכל המשפחה',
      heroSubtitleEn: 'Swimwear for the whole family',
    },
  });

  const existingProducts = await prisma.product.count();
  if (existingProducts > 0) {
    console.log(`${existingProducts} products already exist, skipping product seed.`);
    console.log('To re-seed, run: prisma migrate reset');
    return;
  }

  const men = await prisma.category.upsert({
    where: { slug: 'men' },
    update: {},
    create: { nameHe: 'גברים', nameEn: 'Men', slug: 'men', sortOrder: 1 },
  });
  const women = await prisma.category.upsert({
    where: { slug: 'women' },
    update: {},
    create: { nameHe: 'נשים', nameEn: 'Women', slug: 'women', sortOrder: 2 },
  });
  const children = await prisma.category.upsert({
    where: { slug: 'children' },
    update: {},
    create: { nameHe: 'ילדים', nameEn: 'Children', slug: 'children', sortOrder: 3 },
  });

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
          create: [{ url: product.image, color: product.color, altText: product.nameEn, sortOrder: 0 }],
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
