import { serverApiUrl, serverAuthUrl } from './api-urls';

/**
 * Coming Soon gate (admin Settings toggle, `comingSoon` on the site config).
 * While it is on, shoppers see only the Coming Soon page; Admins see the store
 * as usual. Used by the middleware, so it must stay cheap: the flag is cached
 * for a few seconds, and the session is only checked when the gate is on and a
 * session cookie is present.
 */

/** How long the middleware trusts its last read of the flag. */
const FLAG_TTL_MS = 10_000;

/** The page shoppers are shown (rewritten, so the address bar keeps their URL). */
export const COMING_SOON_PATH = '/coming-soon';

/** Paths (without locale) that stay reachable while the gate is on, so Admins can sign in. */
const OPEN_PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/admin', COMING_SOON_PATH];

export function isOpenPath(pathWithoutLocale: string): boolean {
  return OPEN_PATHS.some((base) => pathWithoutLocale === base || pathWithoutLocale.startsWith(`${base}/`));
}

let cached: { value: boolean; at: number } | null = null;

/** Whether the gate is on. If the API can't be reached the last known value (or open) is used. */
export async function comingSoonEnabled(now = Date.now()): Promise<boolean> {
  if (cached && now - cached.at < FLAG_TTL_MS) return cached.value;
  try {
    const res = await fetch(`${serverApiUrl()}/site-config`, { cache: 'no-store', signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`site-config ${res.status}`);
    const config = (await res.json()) as { comingSoon?: boolean } | null;
    cached = { value: config?.comingSoon === true, at: now };
  } catch {
    cached = { value: cached?.value ?? false, at: now };
  }
  return cached.value;
}

/** True when the request carries the session of a signed-in Admin. */
export async function isAdminRequest(cookieHeader: string | null): Promise<boolean> {
  if (!cookieHeader) return false;
  try {
    const res = await fetch(`${serverAuthUrl()}/api/auth/get-session`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const session = (await res.json()) as { user?: { role?: string } } | null;
    return session?.user?.role === 'ADMIN';
  } catch {
    return false;
  }
}

/** Test hook: forget the cached flag. */
export function resetComingSoonCache() {
  cached = null;
}
