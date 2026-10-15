import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Payment webhook design (stub — no real provider is wired yet)
 * --------------------------------------------------------------
 * Real providers confirm payments asynchronously (3-D Secure, bank
 * redirects). The webhook, not the browser, must be the source of truth:
 *
 *   provider --POST /v1/payment/webhook (raw body + signature header)--> API
 *     1. WebhookVerifier.verify(rawBody, headers) authenticates the request
 *        against a shared secret / provider public key, in constant time,
 *        rejecting stale timestamps (replay protection). Invalid -> 400,
 *        no details leaked.
 *     2. The verified event is mapped to a provider-neutral PaymentWebhookEvent.
 *     3. PaymentService.applyWebhookEvent() checks amount + currency against
 *        the server-side order and performs the same idempotent conditional
 *        update as /payment/charge (WHERE status = PENDING_PAYMENT), so
 *        duplicate or reordered deliveries are harmless.
 *
 * main.ts already enables `rawBody: true`, so req.rawBody is available.
 * When no verifier is bound (default, and always for the mock provider) the
 * endpoint answers 404.
 */
export type PaymentWebhookEvent = {
  type: 'payment.succeeded' | 'payment.failed';
  /** Provider event id; use for de-duplication/audit. */
  eventId: string;
  orderId: string;
  providerRef: string;
  /** Major units, e.g. 149.9 */
  amount: number;
  currency: string;
};

export interface WebhookVerifier {
  /** Returns the parsed event, or null if the signature/payload is invalid. */
  verify(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): PaymentWebhookEvent | null;
}

export const PAYMENT_WEBHOOK_VERIFIER = 'PAYMENT_WEBHOOK_VERIFIER';

/**
 * Reference HMAC-SHA256 verifier (Stripe-style `t=<unix>,v1=<hex>` header,
 * signed payload = `${t}.${rawBody}`). Usable for a self-hosted gateway or as
 * a template; a real provider will usually ship its own verifier.
 */
export class HmacSha256WebhookVerifier implements WebhookVerifier {
  constructor(
    private readonly secret: string,
    private readonly options: { header?: string; toleranceSeconds?: number; now?: () => number } = {},
  ) {
    if (!secret || secret.length < 32) {
      throw new Error('Webhook secret must be at least 32 characters');
    }
  }

  static sign(secret: string, rawBody: Buffer | string, timestamp: number): string {
    const mac = createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest('hex');
    return `t=${timestamp},v1=${mac}`;
  }

  verify(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): PaymentWebhookEvent | null {
    const headerName = (this.options.header ?? 'x-baia-signature').toLowerCase();
    const rawHeader = headers[headerName];
    const header = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    if (!header || !rawBody) return null;

    const parts = Object.fromEntries(
      header.split(',').map((kv) => {
        const i = kv.indexOf('=');
        return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
      }),
    );
    const timestamp = Number(parts.t);
    const signature = parts.v1;
    if (!Number.isInteger(timestamp) || !signature || !/^[0-9a-f]{64}$/.test(signature)) return null;

    const nowSec = Math.floor((this.options.now?.() ?? Date.now()) / 1000);
    if (Math.abs(nowSec - timestamp) > (this.options.toleranceSeconds ?? 300)) return null;

    const expected = createHmac('sha256', this.secret).update(`${timestamp}.`).update(rawBody).digest();
    const provided = Buffer.from(signature, 'hex');
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

    try {
      const body = JSON.parse(rawBody.toString('utf8'));
      if (
        (body.type !== 'payment.succeeded' && body.type !== 'payment.failed') ||
        typeof body.eventId !== 'string' ||
        typeof body.orderId !== 'string' ||
        typeof body.providerRef !== 'string' ||
        typeof body.amount !== 'number' ||
        typeof body.currency !== 'string'
      ) {
        return null;
      }
      return {
        type: body.type,
        eventId: body.eventId,
        orderId: body.orderId,
        providerRef: body.providerRef,
        amount: body.amount,
        currency: body.currency,
      };
    } catch {
      return null;
    }
  }
}

export function createWebhookVerifier(env: Record<string, string | undefined> = process.env): WebhookVerifier | null {
  const secret = env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) return null;
  return new HmacSha256WebhookVerifier(secret);
}
