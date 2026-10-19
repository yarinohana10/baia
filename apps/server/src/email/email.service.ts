import '../config/load-env';
import {
  DEFAULT_EMAIL_LOCALE,
  EMAIL_LOCALES,
  type EmailBranding,
  type EmailLocale,
  type EmailMessage,
  type EmailStore,
  type EmailTransport,
} from './email.types';
import { defaultBranding, lazyPrismaEmailStore, mergeBranding, trimError } from './email-store';
import { isCustomerFacing, renderTemplate, type EmailTemplateData, type EmailTemplateName } from './templates';
import { ConsoleEmailTransport } from './transports/console.transport';
import { SmtpEmailTransport } from './transports/smtp.transport';

export interface SendTemplateOptions<K extends EmailTemplateName> {
  to: string;
  locale?: string | null;
  data: EmailTemplateData[K];
  /**
   * Overrides the default Reply-To (the store's contact address on
   * customer-facing emails; none on store-inbox alerts).
   */
  replyTo?: string;
  /** Stored with the log row (e.g. so the admin can list an order's emails). */
  meta?: { orderId?: string | null };
}

export interface SendResult {
  status: 'SENT' | 'FAILED';
  attempts: number;
  error?: string;
}

export interface EmailServiceOptions {
  /** Footer details + audit log. Null = defaults only, nothing logged. */
  store?: EmailStore | null;
  /** Wait before each attempt; its length is the max number of attempts. */
  retryDelaysMs?: number[];
  /** How long SiteConfig branding is reused. */
  brandingTtlMs?: number;
  env?: NodeJS.ProcessEnv;
}

export const DEFAULT_RETRY_DELAYS_MS = [0, 2_000, 8_000];
const BRANDING_TTL_MS = 60_000;
/** After a failed branding lookup, retry the DB sooner than the normal TTL. */
const BRANDING_ERROR_TTL_MS = 10_000;

/** SMTP / socket errors that are worth retrying (vs. a rejected address or bad credentials). */
export function isTransientEmailError(err: unknown): boolean {
  const e = err as { code?: unknown; responseCode?: unknown } | null;
  const responseCode = typeof e?.responseCode === 'number' ? e.responseCode : null;
  if (responseCode !== null) return responseCode >= 400 && responseCode < 500;
  const code = typeof e?.code === 'string' ? e.code : null;
  if (code && ['EENVELOPE', 'EMESSAGE', 'EAUTH', 'ECONFIG'].includes(code)) return false;
  return true;
}

const sleep = (ms: number) => (ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve());

/**
 * Reusable email sender. Inject it via Nest (`EmailModule` is global) or import
 * the `emailService` singleton in non-Nest code such as the better-auth config.
 *
 * Every templated send: loads the footer branding (cached), renders, sets
 * Reply-To, retries transient failures and writes one EmailLog row.
 */
export class EmailService {
  private store: EmailStore | null;
  private readonly retryDelaysMs: number[];
  private readonly brandingTtlMs: number;
  private readonly env: NodeJS.ProcessEnv;
  private brandingCache: { value: EmailBranding; expiresAt: number } | null = null;

  constructor(
    private transport: EmailTransport,
    private readonly from: string,
    options: EmailServiceOptions = {},
  ) {
    this.store = options.store ?? null;
    this.retryDelaysMs = options.retryDelaysMs?.length ? options.retryDelaysMs : [0];
    this.brandingTtlMs = options.brandingTtlMs ?? BRANDING_TTL_MS;
    this.env = options.env ?? process.env;
  }

  get transportName(): string {
    return this.transport.name;
  }

  /** Swap the provider at runtime (used by tests). */
  setTransport(transport: EmailTransport) {
    this.transport = transport;
  }

  /** Swap the persistence (EmailModule wires the app's PrismaService in). */
  setStore(store: EmailStore | null) {
    this.store = store;
    this.brandingCache = null;
  }

  /** Raw send: no retries, no logging. */
  async send(message: EmailMessage): Promise<void> {
    await this.transport.send({ ...message, from: message.from ?? this.from });
  }

  /** Store details for the footer; cached, and never throws (falls back to defaults). */
  async branding(): Promise<EmailBranding> {
    const now = Date.now();
    if (this.brandingCache && this.brandingCache.expiresAt > now) return this.brandingCache.value;
    let value: EmailBranding;
    let ttl = this.brandingTtlMs;
    try {
      value = this.store ? mergeBranding(await this.store.branding(), this.env) : defaultBranding(this.env);
    } catch (err) {
      console.warn(`[email] could not load store details, using defaults: ${trimError(err)}`);
      value = defaultBranding(this.env);
      ttl = Math.min(ttl, BRANDING_ERROR_TTL_MS);
    }
    this.brandingCache = { value, expiresAt: now + ttl };
    return value;
  }

  /** Drop the cached branding (e.g. right after the admin edits SiteConfig). */
  invalidateBranding() {
    this.brandingCache = null;
  }

  /**
   * Render a bilingual template, send it with retries and log the outcome.
   * Never throws: the result says whether it went out. Unknown locales fall
   * back to Hebrew.
   */
  async deliver<K extends EmailTemplateName>(name: K, options: SendTemplateOptions<K>): Promise<SendResult> {
    const locale = normalizeLocale(options.locale);
    let subject = '';
    let attempts = 0;
    let lastError: unknown = null;
    try {
      const branding = await this.branding();
      const rendered = renderTemplate(name, options.data, locale, branding);
      subject = rendered.subject;
      const replyTo = options.replyTo ?? (isCustomerFacing(name) ? branding.contactEmail ?? undefined : undefined);
      const message = { to: options.to, replyTo, ...rendered };
      for (const delay of this.retryDelaysMs) {
        await sleep(delay);
        attempts += 1;
        try {
          await this.send(message);
          await this.log({ name, options, locale, subject, status: 'SENT', attempts });
          return { status: 'SENT', attempts };
        } catch (err) {
          lastError = err;
          if (!isTransientEmailError(err)) break;
        }
      }
    } catch (err) {
      // Rendering or branding failure (should not happen): still logged below.
      lastError = err;
    }
    const error = trimError(lastError);
    console.error(`[email] failed to send "${name}" via ${this.transport.name} after ${attempts} attempt(s): ${error}`);
    await this.log({ name, options, locale, subject, status: 'FAILED', attempts: Math.max(1, attempts), error });
    return { status: 'FAILED', attempts: Math.max(1, attempts), error };
  }

  /** Like deliver, but throws when the email could not be sent. */
  async sendTemplate<K extends EmailTemplateName>(name: K, options: SendTemplateOptions<K>): Promise<void> {
    const result = await this.deliver(name, options);
    if (result.status === 'FAILED') throw new Error(result.error ?? `Failed to send "${name}"`);
  }

  /**
   * Fire-and-forget variant: never throws, logs failures. Use it from request
   * handlers where a mail outage must not break the user's action (and where
   * awaiting would leak timing information, e.g. password reset).
   */
  async dispatch<K extends EmailTemplateName>(name: K, options: SendTemplateOptions<K>): Promise<void> {
    await this.deliver(name, options);
  }

  private async log(entry: {
    name: string;
    options: SendTemplateOptions<EmailTemplateName>;
    locale: EmailLocale;
    subject: string;
    status: 'SENT' | 'FAILED';
    attempts: number;
    error?: string;
  }): Promise<void> {
    if (!this.store) return;
    try {
      await this.store.log({
        template: entry.name,
        to: entry.options.to,
        subject: entry.subject,
        locale: entry.locale,
        orderId: entry.options.meta?.orderId ?? null,
        status: entry.status,
        attempts: entry.attempts,
        error: entry.error ?? null,
      });
    } catch (err) {
      console.error(`[email] could not write the email log for "${entry.name}": ${trimError(err)}`);
    }
  }
}

export function normalizeLocale(value?: string | null): EmailLocale {
  return EMAIL_LOCALES.includes(value as EmailLocale) ? (value as EmailLocale) : DEFAULT_EMAIL_LOCALE;
}

/** EMAIL_RETRY_DELAYS_MS="0,2000,8000"; tests (NODE_ENV=test) default to no waiting. */
export function retryDelaysFromEnv(env: NodeJS.ProcessEnv = process.env): number[] {
  const raw = env.EMAIL_RETRY_DELAYS_MS?.trim();
  if (raw) {
    const parsed = raw
      .split(',')
      .map((x) => Number(x.trim()))
      .filter((x) => Number.isFinite(x) && x >= 0);
    if (parsed.length) return parsed;
  }
  return env.NODE_ENV === 'test' ? DEFAULT_RETRY_DELAYS_MS.map(() => 0) : DEFAULT_RETRY_DELAYS_MS;
}

export function createEmailTransportFromEnv(env: NodeJS.ProcessEnv = process.env): EmailTransport {
  const provider = (env.EMAIL_PROVIDER || (env.SMTP_HOST ? 'smtp' : 'console')).toLowerCase();
  if (provider === 'smtp') {
    if (!env.SMTP_HOST) throw new Error('EMAIL_PROVIDER=smtp requires SMTP_HOST');
    return new SmtpEmailTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT || 587),
      secure: env.SMTP_SECURE === 'true',
      user: env.SMTP_USER || undefined,
      password: env.SMTP_PASSWORD || undefined,
    });
  }
  if (provider === 'console') {
    if (env.NODE_ENV === 'production') {
      console.warn('[email] EMAIL_PROVIDER is "console" in production - emails will NOT be delivered. Configure SMTP_* env vars.');
    }
    return new ConsoleEmailTransport({ quiet: env.NODE_ENV === 'test' });
  }
  throw new Error(`Unknown EMAIL_PROVIDER "${provider}" (expected "smtp" or "console")`);
}

export function createEmailServiceFromEnv(env: NodeJS.ProcessEnv = process.env): EmailService {
  return new EmailService(createEmailTransportFromEnv(env), env.EMAIL_FROM || 'BAIA <no-reply@baia.local>', {
    // Outside Nest (CLI scripts) the singleton opens its own Prisma connection
    // on first send; EmailModule replaces this with the app's PrismaService.
    // Never in tests, so unit specs can't write to a real database.
    store: env.NODE_ENV === 'test' ? null : lazyPrismaEmailStore(),
    retryDelaysMs: retryDelaysFromEnv(env),
    env,
  });
}

/** Process-wide instance shared by Nest (EmailModule) and better-auth. */
export const emailService = createEmailServiceFromEnv();
