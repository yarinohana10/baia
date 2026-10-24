'use client';

import { useEffect, useRef } from 'react';
import { useLocale } from 'next-intl';
import { useSession } from '@/lib/auth-client';

/** `?redirect=` target: same-origin paths only, never `//host` or absolute URLs (open redirect). */
export function redirectTarget(locale: string): string {
  const redirect = new URLSearchParams(window.location.search).get('redirect');
  const safe = redirect && redirect.startsWith('/') && !redirect.startsWith('//') && !redirect.startsWith('/\\');
  return safe ? redirect : `/${locale}`;
}

/**
 * Sign-in / sign-up pages: a shopper who is already signed in goes on to the
 * `?redirect=` target. Decided once, from the session the server confirms
 * (a leftover cookie of an expired session must not keep anyone from signing in),
 * so signing in or up on the page itself is left to the form.
 */
export function useLeaveIfSignedIn() {
  const locale = useLocale();
  const { data: session, isPending } = useSession();
  const decided = useRef(false);

  useEffect(() => {
    if (isPending || decided.current) return;
    decided.current = true;
    if (session?.user) window.location.replace(redirectTarget(locale));
  }, [isPending, session, locale]);
}
