import type { PrismaClient } from '../generated/prisma';
import { ensureAdmin, type EnsureAdminResult } from './ensure-admin';

type Log = (message: string) => void;

/**
 * Local-development convenience used by `prisma/seed.ts` (production does not
 * seed: the Owner is pinned by OWNER_EMAIL, see OwnerBootstrapService). Creates/promotes the admin only when both
 * ADMIN_EMAIL and ADMIN_PASSWORD are set. Never deletes users and never changes
 * an existing password. Never logs the password.
 */
export async function seedAdminFromEnv(
  prisma: Pick<PrismaClient, 'user' | 'account'>,
  env: NodeJS.ProcessEnv = process.env,
  log: Log = console.log,
): Promise<EnsureAdminResult | null> {
  const email = env.ADMIN_EMAIL?.trim();
  const password = env.ADMIN_PASSWORD;
  if (!email || !password) {
    log('Admin: ADMIN_EMAIL/ADMIN_PASSWORD not set - skipping admin creation (run `pnpm --filter @baia/server admin:create` to add one).');
    return null;
  }

  const result = await ensureAdmin(prisma, { email, password, name: env.ADMIN_NAME, resetPassword: false });
  switch (result.action) {
    case 'created':
      log(`Admin: created ${email}`);
      break;
    case 'promoted':
      log(`Admin: promoted existing user ${email} to ADMIN`);
      break;
    default:
      log(`Admin: ${email} already exists (password unchanged)`);
  }
  return result;
}
