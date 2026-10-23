import type { PrismaClient } from '../generated/prisma';

/**
 * Order Claim: attach guest orders to an Account by email. Guests are
 * identified only by the email typed at checkout, so anyone could type
 * someone else's address - orders are therefore claimed ONLY for an
 * email-verified Account (callers run this on the verification event and on
 * every sign-in of a verified account, so later logged-out orders are picked
 * up too). Raw SQL so nothing but `userId` changes (not even `updatedAt`).
 */
export async function claimGuestOrders(
  prisma: Pick<PrismaClient, '$executeRaw'>,
  user: { id: string; email: string; emailVerified: boolean },
): Promise<number> {
  if (!user.emailVerified) return 0;
  return prisma.$executeRaw`
    UPDATE "orders" SET "userId" = ${user.id}
    WHERE "userId" IS NULL AND lower("customerEmail") = ${user.email.trim().toLowerCase()}`;
}
