import type { EmailMessage, EmailTransport } from '../email.types';

/**
 * Fallback transport used when no SMTP server is configured. Logs only the
 * recipient and subject - never the body, which contains one-time tokens.
 */
export class ConsoleEmailTransport implements EmailTransport {
  readonly name = 'console';

  async send(message: EmailMessage & { from: string }): Promise<void> {
    console.log(`[email:console] to=${message.to} subject="${message.subject}" (no SMTP configured; message not delivered)`);
  }
}

/** Collects messages in memory. Useful for tests. */
export class MemoryEmailTransport implements EmailTransport {
  readonly name = 'memory';
  readonly sent: Array<EmailMessage & { from: string }> = [];

  async send(message: EmailMessage & { from: string }): Promise<void> {
    this.sent.push(message);
  }

  clear() {
    this.sent.length = 0;
  }
}
