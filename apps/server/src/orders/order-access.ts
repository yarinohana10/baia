import type { Request } from 'express';
import { readCookie } from '../common/cookies';
import { tokenMatchesHash } from '../common/secure-token';
import type { SessionUser } from '../common/session';

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

export function isValidOrderToken(order: OrderAccessFields, token: string | undefined, now = new Date()): boolean {
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
