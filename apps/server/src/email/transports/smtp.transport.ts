import { createTransport, type Transporter } from 'nodemailer';
import type { EmailMessage, EmailTransport } from '../email.types';

export interface SmtpTransportOptions {
  host: string;
  port: number;
  /** true = implicit TLS (usually port 465). STARTTLS is negotiated automatically otherwise. */
  secure: boolean;
  user?: string;
  password?: string;
}

export class SmtpEmailTransport implements EmailTransport {
  readonly name = 'smtp';
  private readonly transporter: Transporter;

  constructor(options: SmtpTransportOptions) {
    this.transporter = createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      auth: options.user ? { user: options.user, pass: options.password ?? '' } : undefined,
    });
  }

  async send(message: EmailMessage & { from: string }): Promise<void> {
    await this.transporter.sendMail({
      from: message.from,
      to: message.to,
      replyTo: message.replyTo,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  }
}
