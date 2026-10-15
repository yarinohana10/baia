import type { Request, Response } from 'express';
import { readCookie, secureCookieOptions } from '../common/cookies';
import { generateSecureToken, sha256Hex } from '../common/secure-token';

/**
 * Guest cart identity
 * -------------------
 * Previously a client-generated UUID in localStorage sent as
 * `x-guest-session` (readable by any XSS, chosen by the client). Now the
 * server mints a 256-bit random key and stores it in an httpOnly cookie;
 * the database only stores sha256(key) in Cart.sessionId, so a DB leak does
 * not let anyone impersonate a guest cart.
 *
 * Path is /v1 because both /v1/cart/* and POST /v1/orders need it.
 */
export const GUEST_CART_COOKIE = 'baia_cart';
const GUEST_CART_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const GUEST_KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type CartOwner = { userId: string; guestKeyHash?: undefined } | { userId?: undefined; guestKeyHash: string };

export function readGuestCartKeyHash(req: Request): string | undefined {
  const raw = readCookie(req, GUEST_CART_COOKIE);
  if (!raw || !GUEST_KEY_PATTERN.test(raw)) return undefined;
  return sha256Hex(raw);
}

/** Mint a new guest cart key, set the cookie, and return its hash. */
export function issueGuestCartKey(res: Response): string {
  const raw = generateSecureToken();
  res.cookie(GUEST_CART_COOKIE, raw, secureCookieOptions({ path: '/v1', maxAge: GUEST_CART_MAX_AGE_MS }));
  return sha256Hex(raw);
}

export function clearGuestCartCookie(res: Response) {
  res.clearCookie(GUEST_CART_COOKIE, secureCookieOptions({ path: '/v1' }));
}
