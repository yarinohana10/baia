import type { Request } from 'express';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { readCookie } from '../common/cookies';
import { tokenMatchesHash } from '../common/secure-token';
import type { SessionUser } from '../common/session';
import { resolveAuthSecret } from '../auth/auth.config';

/**
 * Guest order access model
 * ------------------------
 * On guest order creation the API generates a 256-bit random token, stores
 * only sha256(token) + expiry on the order, and returns the raw token once in
 * the JSON response body (never in a URL the server sees).
 *
 * The client carries it to the confirmation page in the URL *fragment*
 * (`#token=...`): fragments are never sent to servers, never appear in access
 * logs and are stripped from Referer headers. The page immediately exchanges
 * it via POST /orders/:id/access (token in the body) for an httpOnly,
 * SameSite=Lax cookie whose Path is scoped to /v1/orders/:id, then removes the
 * fragment with history.replaceState. Refreshes use the cookie; JS never needs
 * to hold the token again.
 *
 * Proof of ownership accepted by GET /orders/:id and POST /payment/charge:
 *   (a) session user id === order.userId
 *   (b) valid, unexpired token (X-Order-Token header or the scoped cookie)
 *   (c) ADMIN session (read endpoints only — admins cannot pay for others)
 * Any failure returns 404 so order ids cannot be enumerated.
 *
 * Signed access links (emails and order lookup)
 * ---------------------------------------------
 * The creation token is never stored, so later links (the confirmation /
 * shipping emails, and POST /orders/lookup after proving order number +
 * email) carry a *signed* token instead: `v1_<expiry>_<HMAC(orderId.expiry)>`
 * keyed with a key derived from BETTER_AUTH_SECRET. Minting one does not
 * rotate the stored hash, so the shopper's original confirmation cookie, the
 * email link and a lookup link all stay valid side by side until they expire.
 * It travels exactly like the creation token: URL fragment -> POST
 * /orders/:id/access -> scoped httpOnly cookie.
 */

export const ORDER_TOKEN_HEADER = 'x-order-token';
export const orderAccessCookieName = (orderId: string) => `baia_ot_${orderId}`;

const DEFAULT_TTL_DAYS = 30;
export function orderTokenTtlMs(): number {
  const days = Number(process.env.ORDER_ACCESS_TOKEN_TTL_DAYS);
  return (Number.isFinite(days) && days > 0 ? days : DEFAULT_TTL_DAYS) * 24 * 60 * 60 * 1000;
}

/** How long the exchanged browser cookie lives (shorter than the token). */
export const ORDER_ACCESS_COOKIE_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export type OrderAccessFields = {
  id: string;
  userId: string | null;
  accessTokenHash: string | null;
  accessTokenExpiresAt: Date | null;
};

export type OrderRequester = {
  user: SessionUser | null;
  token?: string;
};

export function extractOrderToken(req: Request, orderId: string): string | undefined {
  const header = req.headers[ORDER_TOKEN_HEADER];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  if (fromHeader) return fromHeader;
  return readCookie(req, orderAccessCookieName(orderId));
}

const SIGNED_PREFIX = 'v1_';

let cachedKey: Buffer | null = null;
function signingKey(): Buffer {
  cachedKey ??= createHash('sha256').update(`baia-order-access:${resolveAuthSecret()}`, 'utf8').digest();
  return cachedKey;
}

function mac(orderId: string, exp: string): Buffer {
  return createHmac('sha256', signingKey()).update(`${orderId}.${exp}`, 'utf8').digest();
}

/** A signed, non-rotating access token for one order (see the model above). */
export function signOrderToken(orderId: string, expiresAt: Date = new Date(Date.now() + orderTokenTtlMs())): string {
  const exp = Math.floor(expiresAt.getTime() / 1000).toString(36);
  return `${SIGNED_PREFIX}${exp}_${mac(orderId, exp).toString('base64url')}`;
}

/** Expiry of a valid signed token for this order, or null. */
export function signedTokenExpiry(orderId: string, token: string | undefined, now = new Date()): Date | null {
  if (!token || token.length > 256 || !token.startsWith(SIGNED_PREFIX)) return null;
  const rest = token.slice(SIGNED_PREFIX.length);
  const sep = rest.indexOf('_');
  if (sep <= 0) return null;
  const exp = rest.slice(0, sep);
  if (!/^[0-9a-z]+$/.test(exp)) return null;
  let provided: Buffer;
  try {
    provided = Buffer.from(rest.slice(sep + 1), 'base64url');
  } catch {
    return null;
  }
  const expected = mac(orderId, exp);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  const expiresAt = new Date(parseInt(exp, 36) * 1000);
  return expiresAt.getTime() > now.getTime() ? expiresAt : null;
}

/** When the given (valid) token stops working, or null when it is not valid. */
export function orderTokenExpiry(order: OrderAccessFields, token: string | undefined, now = new Date()): Date | null {
  const signed = signedTokenExpiry(order.id, token, now);
  if (signed) return signed;
  return isValidOrderToken(order, token, now) ? order.accessTokenExpiresAt : null;
}

export function isValidOrderToken(order: OrderAccessFields, token: string | undefined, now = new Date()): boolean {
  if (token?.startsWith(SIGNED_PREFIX)) return signedTokenExpiry(order.id, token, now) !== null;
  if (!token || !order.accessTokenHash || !order.accessTokenExpiresAt) return false;
  // Always run the constant-time comparison before checking expiry so the
  // response time does not reveal whether the token itself was correct.
  const matches = tokenMatchesHash(token, order.accessTokenHash);
  return matches && order.accessTokenExpiresAt.getTime() > now.getTime();
}

export function canAccessOrder(
  order: OrderAccessFields,
  requester: OrderRequester,
  opts: { allowAdmin: boolean },
): boolean {
  const { user, token } = requester;
  if (user && order.userId && order.userId === user.id) return true;
  if (opts.allowAdmin && user?.role === 'ADMIN') return true;
  return isValidOrderToken(order, token);
}
