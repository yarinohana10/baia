import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';
import { COMING_SOON_PATH, comingSoonEnabled, isAdminRequest, isOpenPath } from './lib/coming-soon';

const intlMiddleware = createMiddleware(routing);

const COOKIE_PREFIX = process.env.NEXT_PUBLIC_AUTH_COOKIE_PREFIX || 'baia';
// better-auth adds the `__Secure-` prefix when cookies are secure (production/HTTPS).
const SESSION_COOKIES = [`${COOKIE_PREFIX}.session_token`, `__Secure-${COOKIE_PREFIX}.session_token`];

function hasSessionCookie(request: NextRequest): boolean {
  return SESSION_COOKIES.some((name) => !!request.cookies.get(name)?.value);
}

function isUnder(path: string, base: string): boolean {
  return path === base || path.startsWith(`${base}/`);
}

/**
 * Cheap, cookie-presence redirect to sign-in for UX only. The real checks happen
 * on the server: the admin layout verifies the session role, and every admin API
 * route is protected by AuthGuard + @Roles('ADMIN'). Signed-in shoppers are sent
 * away from /login and /register by the forms (useLeaveIfSignedIn), which check
 * that the session is real: a stale cookie must not lock anyone out of signing in.
 */
export default async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isAuthenticated = hasSessionCookie(request);

  const localeMatch = pathname.match(/^\/(he|en)(\/.*)?$/);
  if (localeMatch) {
    const locale = localeMatch[1];
    const pathWithoutLocale = localeMatch[2] || '/';

    if (!isAuthenticated && (isUnder(pathWithoutLocale, '/account') || isUnder(pathWithoutLocale, '/admin'))) {
      const loginUrl = new URL(`/${locale}/login`, request.url);
      loginUrl.searchParams.set('redirect', `${pathname}${search}`);
      return NextResponse.redirect(loginUrl);
    }

    // Coming Soon: shoppers get the Coming Soon page at whatever address they opened;
    // Admins (checked against the real session) see the store as usual.
    if (!isOpenPath(pathWithoutLocale) && (await comingSoonEnabled())) {
      const admin = isAuthenticated && (await isAdminRequest(request.headers.get('cookie')));
      if (!admin) {
        const response = NextResponse.rewrite(new URL(`/${locale}${COMING_SOON_PATH}`, request.url));
        response.headers.set('Cache-Control', 'no-store');
        return response;
      }
    }
  }

  return intlMiddleware(request);
}

export const config = {
  // Node runtime: reads API_URL / API_INTERNAL_URL at run time and keeps the flag cache between requests.
  runtime: 'nodejs',
  matcher: ['/', '/(he|en)/:path*'],
};
