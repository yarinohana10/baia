import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

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
 * Cheap, cookie-presence redirects for UX only. The real checks happen on the
 * server: the admin layout verifies the session role, and every admin API
 * route is protected by AuthGuard + @Roles('ADMIN').
 */
export default function middleware(request: NextRequest) {
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

    if (isAuthenticated && (pathWithoutLocale === '/login' || pathWithoutLocale === '/register')) {
      return NextResponse.redirect(new URL(`/${locale}`, request.url));
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/', '/(he|en)/:path*'],
};
