import type { PrismaClient } from '../generated/prisma';
import type { EmailBranding, EmailLogEntry, EmailStore } from './email.types';

/** Storefront origin used for links in emails (first entry of CLIENT_URL). */
export function siteUrlFromEnv(env: NodeJS.ProcessEnv = process.env): string {
  return (env.CLIENT_URL || 'http://localhost:3000').split(',')[0].trim().replace(/\/$/, '');
}

/** Used until SiteConfig is reachable (and when a field is empty). */
export function defaultBranding(env: NodeJS.ProcessEnv = process.env): EmailBranding {
  return {
    businessName: 'BAIA Swimwear',
    companyId: null,
    businessAddress: null,
    businessPhone: null,
    contactEmail: env.ADMIN_NOTIFY_EMAIL?.trim() || null,
    whatsappNumber: null,
    siteUrl: siteUrlFromEnv(env),
  };
}

/** Merge stored values over the defaults, ignoring blanks. */
export function mergeBranding(
  stored: Partial<Omit<EmailBranding, 'siteUrl'>> | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): EmailBranding {
  const base = defaultBranding(env);
  if (!stored) return base;
  const pick = (v: string | null | undefined, fallback: string | null) => (v && v.trim() ? v.trim() : fallback);
  return {
    businessName: pick(stored.businessName, base.businessName) ?? base.businessName,
    companyId: pick(stored.companyId, base.companyId),
    businessAddress: pick(stored.businessAddress, base.businessAddress),
    businessPhone: pick(stored.businessPhone, base.businessPhone),
    contactEmail: pick(stored.contactEmail, base.contactEmail),
    whatsappNumber: pick(stored.whatsappNumber, base.whatsappNumber),
    siteUrl: base.siteUrl,
  };
}

const MAX_ERROR_LENGTH = 500;

/** Error text for the log: single line, trimmed, never huge. */
export function trimError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw.replace(/\s+/g, ' ').trim().slice(0, MAX_ERROR_LENGTH) || 'Unknown error';
}

type EmailPrisma = Pick<PrismaClient, 'siteConfig' | 'emailLog'>;

/** SiteConfig for the footer, `email_logs` for the audit trail. */
export class PrismaEmailStore implements EmailStore {
  constructor(private readonly prisma: EmailPrisma) {}

  async branding() {
    return this.prisma.siteConfig.findUnique({
      where: { id: 'default' },
      select: {
        businessName: true,
        companyId: true,
        businessAddress: true,
        businessPhone: true,
        contactEmail: true,
        whatsappNumber: true,
      },
    });
  }

  async log(entry: EmailLogEntry): Promise<void> {
    await this.prisma.emailLog.create({
      data: {
        template: entry.template,
        to: entry.to.slice(0, 320),
        subject: entry.subject.slice(0, 300),
        locale: entry.locale,
        orderId: entry.orderId ?? null,
        status: entry.status,
        attempts: entry.attempts,
        error: entry.error ? entry.error.slice(0, MAX_ERROR_LENGTH) : null,
      },
    });
  }
}

/**
 * Store for code running outside Nest (CLI scripts, better-auth before the
 * app module has started): opens its own PrismaClient on first use. Inside
 * the app, EmailModule swaps in a store backed by the shared PrismaService.
 */
export function lazyPrismaEmailStore(): EmailStore {
  let store: Promise<PrismaEmailStore> | null = null;
  const get = () => {
    store ??= import('../generated/prisma').then(({ PrismaClient }) => new PrismaEmailStore(new PrismaClient()));
    return store;
  };
  return {
    branding: async () => (await get()).branding(),
    log: async (entry) => (await get()).log(entry),
  };
}
