import '../config/load-env';
import {
  DEFAULT_EMAIL_LOCALE,
  EMAIL_LOCALES,
  type EmailLocale,
  type EmailMessage,
  type EmailTransport,
} from './email.types';
import { renderTemplate, type EmailTemplateData, type EmailTemplateName } from './templates';
import { ConsoleEmailTransport } from './transports/console.transport';
import { SmtpEmailTransport } from './transports/smtp.transport';

export interface SendTemplateOptions<K extends EmailTemplateName> {
  to: string;
  locale?: string | null;
  data: EmailTemplateData[K];
  replyTo?: string;
}

/**
 * Reusable email sender. Inject it via Nest (`EmailModule` is global) or import
 * the `emailService` singleton in non-Nest code such as the better-auth config.
 */
export class EmailService {
  constructor(
    private transport: EmailTransport,
    private readonly from: string,
  ) {}

  get transportName(): string {
    return this.transport.name;
  }

  /** Swap the provider at runtime (used by tests). */
  setTransport(transport: EmailTransport) {
    this.transport = transport;
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transport.send({ ...message, from: message.from ?? this.from });
  }

  /** Render a bilingual template and send it. Unknown locales fall back to Hebrew. */
  async sendTemplate<K extends EmailTemplateName>(name: K, options: SendTemplateOptions<K>): Promise<void> {
    const locale = normalizeLocale(options.locale);
    const rendered = renderTemplate(name, options.data, locale);
    await this.send({ to: options.to, replyTo: options.replyTo, ...rendered });
  }

  /**
   * Fire-and-forget variant: never throws, logs failures. Use it from request
   * handlers where a mail outage must not break the user's action (and where
   * awaiting would leak timing information, e.g. password reset).
   */
  dispatch<K extends EmailTemplateName>(name: K, options: SendTemplateOptions<K>): Promise<void> {
    return this.sendTemplate(name, options).catch((err: unknown) => {
      const reason = err instanceof Error ? err.message : String(err);
      console.error(`[email] failed to send "${name}" via ${this.transport.name}: ${reason}`);
    });
  }
}

export function normalizeLocale(value?: string | null): EmailLocale {
  return EMAIL_LOCALES.includes(value as EmailLocale) ? (value as EmailLocale) : DEFAULT_EMAIL_LOCALE;
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
    return new ConsoleEmailTransport();
  }
  throw new Error(`Unknown EMAIL_PROVIDER "${provider}" (expected "smtp" or "console")`);
}

export function createEmailServiceFromEnv(env: NodeJS.ProcessEnv = process.env): EmailService {
  return new EmailService(createEmailTransportFromEnv(env), env.EMAIL_FROM || 'BAIA <no-reply@baia.local>');
}

/** Process-wide instance shared by Nest (EmailModule) and better-auth. */
export const emailService = createEmailServiceFromEnv();
