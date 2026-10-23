import type { EmailMessage, EmailTransport } from '../email.types';

export interface ResendTransportOptions {
  apiKey: string;
  /** Overridable for tests. */
  endpoint?: string;
}

/**
 * Sends through Resend's HTTPS API (port 443). Use this where outbound SMTP is
 * blocked (Railway Hobby/Trial block ports 25/465/587).
 */
export class ResendEmailTransport implements EmailTransport {
  readonly name = 'resend';

  constructor(private readonly options: ResendTransportOptions) {}

  async send(message: EmailMessage & { from: string }): Promise<void> {
    const res = await fetch(this.options.endpoint ?? 'https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: message.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const body = (await res.text().catch(() => '')).slice(0, 300);
      throw new Error(`Resend API ${res.status}: ${body}`);
    }
  }
}
