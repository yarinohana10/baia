import { Logger } from '@nestjs/common';
import type { PrismaClient } from '../generated/prisma';
import { claimGuestOrders } from '../orders/order-claim.service';

const logger = new Logger('VerifiedEmailGrants');

type GrantsPrisma = Pick<PrismaClient, 'user' | 'adminInvitation' | '$transaction' | '$executeRaw'>;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** The Owner's email from OWNER_EMAIL (read lazily so tests can change it), lowercased. */
export function ownerEmail(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const value = env.OWNER_EMAIL?.trim().toLowerCase();
  return value || undefined;
}

export function isOwnerEmail(email: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const owner = ownerEmail(env);
  return !!owner && normalizeEmail(email) === owner;
}

/**
 * Everything an email-verified Account is entitled to, applied idempotently:
 * - Owner email -> ADMIN (promotion only, nobody is ever demoted here);
 * - pending Admin Invitation for the email -> ADMIN, invitation consumed
 *   (same transaction, so it can't be applied twice);
 * - guest orders placed with this email -> Order Claim.
 * An unverified account gets none of it.
 */
export async function applyVerifiedEmailGrants(
  prisma: GrantsPrisma,
  user: { id: string; email: string; emailVerified: boolean },
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  if (!user.emailVerified) return;
  const email = normalizeEmail(user.email);

  if (isOwnerEmail(email, env)) {
    const { count } = await prisma.user.updateMany({ where: { id: user.id, role: { not: 'ADMIN' } }, data: { role: 'ADMIN' } });
    if (count) logger.log(`Owner ${email} is now an ADMIN`);
  } else {
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.adminInvitation.deleteMany({ where: { email } });
      if (!count) return;
      await tx.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
      logger.log(`Admin Invitation for ${email} accepted: now an ADMIN`);
    });
  }

  const claimed = await claimGuestOrders(prisma, user);
  if (claimed) logger.log(`Order Claim: attached ${claimed} guest order(s) to ${email}`);
}

/** Hook entry point: never throws (a grants hiccup must not break sign-in or verification). */
export async function applyGrantsForUserId(prisma: GrantsPrisma & Pick<PrismaClient, 'user'>, userId: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, emailVerified: true } });
    if (user) await applyVerifiedEmailGrants(prisma, user);
  } catch (err) {
    logger.error(`Applying verified-email grants failed for user ${userId}: ${(err as Error).message}`);
  }
}
