'use client';

import { useCallback } from 'react';
import { useLocale } from 'next-intl';
import { signIn } from '@/lib/auth-client';
import { useBusyAction } from './useBusyAction';

/**
 * "Continue with Google": stays busy while the browser is sent to Google;
 * calls `onError` (and clears the busy state) when the redirect can't start.
 */
export function useGoogleSignIn(onError: () => void): [pending: boolean, start: () => Promise<void>] {
  const locale = useLocale();
  const [pending, run] = useBusyAction();
  const start = useCallback(
    () =>
      run(async () => {
        try {
          // Absolute URLs so Google sends the user back to the shop, not the API origin.
          await signIn.social({
            provider: 'google',
            callbackURL: `${window.location.origin}/${locale}`,
            errorCallbackURL: `${window.location.origin}/${locale}/login`,
          });
          return 'navigating';
        } catch {
          onError();
          return 'done';
        }
      }),
    [run, locale, onError],
  );
  return [pending, start];
}
