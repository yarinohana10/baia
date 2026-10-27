/**
 * Replaces the English colour at the end of seeded Hebrew product descriptions
 * ("... צבע: Blue") with its Hebrew name ("... צבע: כחול"), so Hebrew pages
 * stay all-Hebrew. Descriptions written in the admin are left untouched: only
 * the exact seed ending with a known colour is rewritten.
 *
 * Run from apps/server with the target environment's DATABASE_URL:
 *
 *   node --import tsx scripts/hebrew-color-descriptions.ts [--dry-run]
 *
 * The storefront picks the new text up within its 5-minute revalidation window.
 */
import { PrismaClient } from '../src/generated/prisma';

const COLOR_HE: Record<string, string> = {
  Black: 'שחור', 'Blue Stripe': 'פסים כחולים', Blue: 'כחול', Brown: 'חום', Burgundy: 'בורדו', Camo: 'קמופלאז׳',
  Charcoal: 'פחם', Cream: 'קרם', Green: 'ירוק', Orange: 'כתום', Red: 'אדום', Taupe: 'טאופ', Wine: 'יין', Yellow: 'צהוב',
};

const SEED_ENDING = /צבע: ([A-Za-z ]+)$/;

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const prisma = new PrismaClient();
  try {
    const products = await prisma.product.findMany({ select: { id: true, slug: true, descriptionHe: true } });
    let changed = 0;
    for (const p of products) {
      const match = p.descriptionHe?.match(SEED_ENDING);
      const hebrew = match && COLOR_HE[match[1].trim()];
      if (!p.descriptionHe || !match || !hebrew) continue;
      const next = p.descriptionHe.replace(SEED_ENDING, `צבע: ${hebrew}`);
      console.log(`${p.slug}: ${match[1]} -> ${hebrew}`);
      if (!dryRun) await prisma.product.update({ where: { id: p.id }, data: { descriptionHe: next } });
      changed++;
    }
    console.log(`${changed} of ${products.length} descriptions ${dryRun ? 'would change (dry run)' : 'updated'}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
