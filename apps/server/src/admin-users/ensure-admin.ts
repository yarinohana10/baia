import { randomBytes } from 'crypto';
import { hashPassword } from 'better-auth/crypto';
import type { PrismaClient } from '../generated/prisma';

export const MIN_ADMIN_PASSWORD_LENGTH = 8;
export const MAX_ADMIN_PASSWORD_LENGTH = 128;

export type EnsureAdminResult =
  | { action: 'created'; userId: string }
  | { action: 'promoted'; userId: string; passwordSet: boolean }
  | { action: 'unchanged'; userId: string; passwordSet: boolean };

export interface EnsureAdminInput {
  email: string;
  password?: string;
  name?: string;
  /**
   * Overwrite the password of an existing credential account. Off by default:
   * re-running the seed or CLI must never silently change an admin's password.
   */
  resetPassword?: boolean;
}

type AdminPrisma = Pick<PrismaClient, 'user' | 'account'>;

export class EnsureAdminError extends Error {}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateAdminPassword(password: string): void {
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH || password.length > MAX_ADMIN_PASSWORD_LENGTH) {
    throw new EnsureAdminError(
      `Password must be between ${MIN_ADMIN_PASSWORD_LENGTH} and ${MAX_ADMIN_PASSWORD_LENGTH} characters.`,
    );
  }
}

function newId(): string {
  // Same shape as better-auth's generated ids (32 url-safe chars).
  return randomBytes(24).toString('base64url');
}

/**
 * Idempotently make `email` an ADMIN.
 * - Missing user: created (verified email, credential password) - requires a password.
 * - Existing user: promoted; never deleted or recreated. If they have no
 *   credential account (e.g. Google-only) and a password is given, one is added.
 * - Existing password is only changed when `resetPassword` is true.
 * Users are written directly (not via better-auth sign-up) so no customer
 * verification/welcome emails are sent.
 */
export async function ensureAdmin(prisma: AdminPrisma, input: EnsureAdminInput): Promise<EnsureAdminResult> {
  const email = normalizeEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new EnsureAdminError('A valid email address is required.');
  }
  if (input.password !== undefined) validateAdminPassword(input.password);

  const existing = await prisma.user.findUnique({ where: { email } });

  if (!existing) {
    if (!input.password) {
      throw new EnsureAdminError(`No user with email ${email} exists; a password is required to create one.`);
    }
    const id = newId();
    const passwordHash = await hashPassword(input.password);
    await prisma.user.create({
      data: {
        id,
        email,
        name: input.name?.trim() || email.split('@')[0],
        emailVerified: true,
        role: 'ADMIN',
        accounts: {
          create: { id: newId(), accountId: id, providerId: 'credential', password: passwordHash },
        },
      },
    });
    return { action: 'created', userId: id };
  }

  let passwordSet = false;
  if (input.password) {
    const credential = await prisma.account.findFirst({
      where: { userId: existing.id, providerId: 'credential' },
    });
    if (!credential) {
      await prisma.account.create({
        data: {
          id: newId(),
          accountId: existing.id,
          providerId: 'credential',
          userId: existing.id,
          password: await hashPassword(input.password),
        },
      });
      passwordSet = true;
    } else if (input.resetPassword) {
      await prisma.account.update({
        where: { id: credential.id },
        data: { password: await hashPassword(input.password) },
      });
      passwordSet = true;
    }
  }

  if (existing.role === 'ADMIN') {
    return { action: 'unchanged', userId: existing.id, passwordSet };
  }

  await prisma.user.update({ where: { id: existing.id }, data: { role: 'ADMIN' } });
  return { action: 'promoted', userId: existing.id, passwordSet };
}
