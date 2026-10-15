import { PrismaClient } from '../src/generated/prisma';
import {
  DEFAULT_SIZE_SETS,
  TOP_LEVEL_CATEGORY_SIZE_SET,
  matchSizeSet,
} from '../src/products/size-sets';

/** Upserts the built-in size sets. Existing rows keep any admin edits to `sizes`. */
export async function ensureSizeSets(prisma: PrismaClient) {
  for (const def of DEFAULT_SIZE_SETS) {
    await prisma.sizeSet.upsert({
      where: { key: def.key },
      update: {},
      create: def,
    });
  }
  return prisma.sizeSet.findMany({ orderBy: { sortOrder: 'asc' } });
}

/**
 * Safe, idempotent backfill for flexible sizing:
 * - top-level categories without a size set get their default (men/women → adult, children → kids)
 * - products without a size set get the first set containing ALL of their variant sizes;
 *   products whose sizes fit no set stay `null` (custom sizes)
 * Variant rows are never modified, so existing SKUs, carts and orders are untouched.
 */
export async function backfillSizeSets(prisma: PrismaClient) {
  const sets = await ensureSizeSets(prisma);
  const byKey = new Map(sets.map((s) => [s.key, s]));

  let categoriesUpdated = 0;
  for (const [slug, key] of Object.entries(TOP_LEVEL_CATEGORY_SIZE_SET)) {
    const set = byKey.get(key);
    if (!set) continue;
    const res = await prisma.category.updateMany({
      where: { slug, parentId: null, sizeSetId: null },
      data: { sizeSetId: set.id },
    });
    categoriesUpdated += res.count;
  }

  const products = await prisma.product.findMany({
    where: { sizeSetId: null },
    select: { id: true, variants: { select: { size: true } } },
  });

  let productsUpdated = 0;
  for (const product of products) {
    const sizes = [...new Set(product.variants.map((v) => v.size))];
    const match = matchSizeSet(sizes, sets);
    if (match) {
      await prisma.product.update({ where: { id: product.id }, data: { sizeSetId: match.id } });
      productsUpdated++;
    }
  }

  return { sizeSets: sets.length, categoriesUpdated, productsUpdated, productsChecked: products.length };
}
