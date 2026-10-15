/**
 * One-off (idempotent) data migration for flexible sizing.
 * Run after `prisma db push`:  pnpm --filter @baia/server prisma:migrate-size-sets
 */
import { PrismaClient } from '../src/generated/prisma';
import { backfillSizeSets } from './size-sets';

const prisma = new PrismaClient();

backfillSizeSets(prisma)
  .then((result) => console.log('Size sets backfill complete:', result))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
