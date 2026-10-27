/**
 * Uploads the store logo to the assets bucket (LocalStack / Cloudflare R2) and
 * prints the URLs to configure:
 *
 *   LOGO_URL        (client service) the logo in the header, admin and SEO data
 *   EMAIL_LOGO_URL  (server service) the logo at the top of every email
 *
 * Run from apps/server after `nest build` (with the target environment's env):
 *
 *   node --import tsx scripts/brand-assets.ts [--dry-run]
 *
 * Source files are the ones the storefront bundles as a fallback. Keys carry a
 * content hash because objects are uploaded with an immutable cache header:
 * a new logo gets a new URL instead of a stale cached one.
 */
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { S3StorageService } from '../dist/storage/s3-storage.service';

const PUBLIC = resolve(__dirname, '../../client/public');
const ASSETS = [
  { env: 'LOGO_URL', file: `${PUBLIC}/logo/baia-logo.png`, name: 'baia-logo' },
  { env: 'EMAIL_LOGO_URL', file: `${PUBLIC}/email/baia-logo.png`, name: 'baia-email-logo' },
];

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const storage = new S3StorageService();
  await storage.onModuleInit?.();
  for (const asset of ASSETS) {
    const buffer = readFileSync(asset.file);
    const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 10);
    const key = `site/brand/${asset.name}-${hash}.png`;
    const url = dryRun ? storage.getUrl(key) : await storage.upload(buffer, key, 'image/png');
    console.log(`${asset.env}=${url}${dryRun ? '   (dry run, not uploaded)' : ''}`);
  }
}

main().catch((err) => {
  console.error('FAIL ', err);
  process.exit(1);
});
