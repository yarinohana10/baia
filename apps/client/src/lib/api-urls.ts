/**
 * Where the storefront talks to the API. Dependency-free so it can ship in the
 * browser bundle (validation with Zod lives in ./env.ts, build/server only).
 *
 * Two topologies:
 *
 *  - Direct (local dev): the browser calls the API origin, e.g.
 *    NEXT_PUBLIC_API_URL=http://localhost:8000/v1, NEXT_PUBLIC_AUTH_URL=http://localhost:8000.
 *
 *  - Same-origin proxy (Railway): NEXT_PUBLIC_API_URL=/v1 and Next rewrites
 *    /v1/* and /api/auth/* to API_INTERNAL_URL on the private network, so the
 *    session cookie is first-party on the storefront domain.
 *    NEXT_PUBLIC_AUTH_URL defaults to NEXT_PUBLIC_SITE_URL in this mode.
 *
 * NEXT_PUBLIC_* must be referenced literally so Next can inline them.
 */

const DEV_API_URL = 'http://localhost:8000/v1';
const DEV_AUTH_URL = 'http://localhost:8000';

const trimSlash = (value: string) => value.replace(/\/+$/, '');

export function isAbsoluteUrl(value: string | undefined): value is string {
  return !!value && /^https?:\/\//i.test(value);
}

/** True when the browser reaches the API through the storefront's own origin. */
export function isProxyMode(): boolean {
  const api = process.env.NEXT_PUBLIC_API_URL;
  return !!api && api.startsWith('/');
}

/** Base URL for browser API calls (axios). Relative ("/v1") in proxy mode. */
export function publicApiUrl(): string {
  return trimSlash(process.env.NEXT_PUBLIC_API_URL || DEV_API_URL);
}

/** Origin the better-auth client posts to (must be absolute). */
export function publicAuthUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_AUTH_URL;
  if (explicit) return trimSlash(explicit);
  if (isProxyMode() && process.env.NEXT_PUBLIC_SITE_URL) return trimSlash(process.env.NEXT_PUBLIC_SITE_URL);
  return DEV_AUTH_URL;
}

/**
 * API origin (no /v1) reachable from the Next.js server itself: the private
 * network address in proxy mode (API_INTERNAL_URL), else the public one.
 */
export function internalApiOrigin(): string | undefined {
  if (process.env.API_INTERNAL_URL) return trimSlash(process.env.API_INTERNAL_URL);
  return undefined;
}

/** Base URL (with /v1) for server-side catalogue fetches (RSC, sitemap, ISR). */
export function serverApiUrl(): string {
  if (process.env.API_URL) return trimSlash(process.env.API_URL);
  const internal = internalApiOrigin();
  if (internal) return `${internal}/v1`;
  const pub = process.env.NEXT_PUBLIC_API_URL;
  return isAbsoluteUrl(pub) ? trimSlash(pub) : DEV_API_URL;
}

/** Origin for server-side better-auth calls (admin layout session check, cache purge). */
export function serverAuthUrl(): string {
  if (process.env.AUTH_URL) return trimSlash(process.env.AUTH_URL);
  const internal = internalApiOrigin();
  if (internal) return internal;
  const pub = process.env.NEXT_PUBLIC_AUTH_URL;
  return isAbsoluteUrl(pub) ? trimSlash(pub) : DEV_AUTH_URL;
}

/**
 * Headers to forward on a server-side call made on behalf of a browser
 * request: the session cookie plus the client IP chain, so API rate limits
 * key on the shopper rather than on the storefront container.
 */
export function forwardedRequestHeaders(incoming: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  const cookie = incoming.get('cookie');
  if (cookie) out.cookie = cookie;
  const xff = incoming.get('x-forwarded-for');
  if (xff) out['x-forwarded-for'] = xff;
  return out;
}

/**
 * CSRF guard for cookie-authenticated route handlers: true when the browser's
 * Origin matches the host it requested (X-Forwarded-Host from a proxy, else
 * Host), the request URL's own origin, or the configured public site URL.
 */
export function isSameOriginRequest(origin: string, incoming: Headers, requestOrigin?: string): boolean {
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  if (requestOrigin && origin === requestOrigin) return true;
  const requested = (incoming.get('x-forwarded-host') ?? incoming.get('host') ?? '').split(',')[0].trim();
  if (requested && originHost === requested) return true;
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) return false;
  try {
    return new URL(site).origin === new URL(origin).origin;
  } catch {
    return false;
  }
}
