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
