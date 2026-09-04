import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

const SESSION_COOKIE = 'baia.session_token';

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get(SESSION_COOKIE);
  const isAuthenticated = !!sessionToken?.value;

  const localeMatch = pathname.match(/^\/(he|en)(\/.*)?$/);
  if (localeMatch) {
    const locale = localeMatch[1];
    const pathWithoutLocale = localeMatch[2] || '/';

    if (
      !isAuthenticated &&
      (pathWithoutLocale === '/account' || pathWithoutLocale.startsWith('/account/'))
    ) {
      return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
    }

    if (
      isAuthenticated &&
      (pathWithoutLocale === '/login' || pathWithoutLocale === '/register')
    ) {
      return NextResponse.redirect(new URL(`/${locale}`, request.url));
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/', '/(he|en)/:path*'],
};
