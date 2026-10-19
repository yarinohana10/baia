export type EmailLocale = 'he' | 'en';

export const EMAIL_LOCALES: readonly EmailLocale[] = ['he', 'en'] as const;
export const DEFAULT_EMAIL_LOCALE: EmailLocale = 'he';

/** A fully rendered message, ready to hand to a transport. */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
}

/**
 * Provider interface. Implement this to plug in another email provider
 * (SES, Resend, Postmark...). The service only ever talks to this interface.
 */
export interface EmailTransport {
  readonly name: string;
  send(message: EmailMessage & { from: string }): Promise<void>;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** Store details shown in every email footer (from SiteConfig, cached). */
export interface EmailBranding {
  businessName: string;
  /** ח.פ. / company number; null or a placeholder renders "coming soon". */
  companyId: string | null;
  businessAddress: string | null;
  businessPhone: string | null;
  contactEmail: string | null;
  /** International format without "+", e.g. "972501234567". */
  whatsappNumber: string | null;
  /** Storefront origin (CLIENT_URL), used for terms/privacy links. */
  siteUrl: string;
}

export type EmailLogStatusValue = 'SENT' | 'FAILED';

/** One row of the email audit log. Never contains the message body. */
export interface EmailLogEntry {
  template: string;
  to: string;
  subject: string;
  locale: string;
  orderId?: string | null;
  status: EmailLogStatusValue;
  attempts: number;
  error?: string | null;
}

/**
 * Persistence used by EmailService: business details for the footer and the
 * audit log. Implementations must be safe to call often (the service caches
 * branding) and may throw - the service swallows every error.
 */
export interface EmailStore {
  branding(): Promise<Partial<Omit<EmailBranding, 'siteUrl'>> | null>;
  log(entry: EmailLogEntry): Promise<void>;
}
