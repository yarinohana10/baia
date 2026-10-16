import type { CookieOptions, Request } from 'express';

/**
 * Minimal Cookie header parser (avoids adding cookie-parser just for two
 * cookies). Invalid percent-encoding is ignored rather than throwing.
 */
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers?.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() !== name) continue;
    const raw = part.slice(idx + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Baseline options for every security-relevant cookie we set.
 * - httpOnly: unreadable from JS (XSS can't exfiltrate it).
 * - sameSite=lax: client (baiaswimwear.com) and API (api.baiaswimwear.com),
 *   and localhost:3000 <-> :8000 in dev, are same-site, so credentialed XHR
 *   still carries the cookie while cross-site POSTs do not.
 * - secure in production (HTTPS only).
 */
export function secureCookieOptions(overrides: CookieOptions = {}): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    ...overrides,
  };
}
