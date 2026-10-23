import { EmailService } from '../../src/email/email.service';
import { MemoryEmailTransport } from '../../src/email/transports/console.transport';
import type { TestApp } from './app';

/** Routes every email the app sends into memory for the duration of a spec. */
export function captureEmails(t: Pick<TestApp, 'app'>) {
  const transport = new MemoryEmailTransport();
  t.app.get(EmailService).setTransport(transport);
  return transport;
}

/** Emails are fire-and-forget: poll until one matching `predicate` arrives. */
export async function waitForEmail(
  transport: MemoryEmailTransport,
  predicate: (m: MemoryEmailTransport['sent'][number]) => boolean,
  timeoutMs = 3000,
) {
  const started = Date.now();
  for (;;) {
    const found = transport.sent.find(predicate);
    if (found) return found;
    if (Date.now() - started > timeoutMs) {
      throw new Error(`no matching email; sent: ${transport.sent.map((m) => `${m.to} "${m.subject}"`).join(', ') || 'none'}`);
    }
    await new Promise((r) => setTimeout(r, 20));
  }
}

/** Give fire-and-forget sends a moment, then return everything sent. */
export async function settledEmails(transport: MemoryEmailTransport, ms = 150) {
  await new Promise((r) => setTimeout(r, ms));
  return transport.sent;
}
