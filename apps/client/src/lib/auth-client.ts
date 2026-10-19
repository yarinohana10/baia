import { createAuthClient } from 'better-auth/react';
import { locales, defaultLocale, type Locale } from '@/i18n/config';
import { publicAuthUrl } from './api-urls';

/** Locale of the page the user is on, from the URL (`/he/...` or `/en/...`). */
export function currentLocale(): Locale {
  if (typeof window === 'undefined') return defaultLocale;
  const segment = window.location.pathname.split('/')[1];
  return (locales as readonly string[]).includes(segment) ? (segment as Locale) : defaultLocale;
}

export const authClient = createAuthClient({
  // The storefront origin in proxy mode (first-party session cookie), else the API origin.
  baseURL: publicAuthUrl(),
  fetchOptions: {
    // Lets the server send verification/reset/welcome emails in the user's language.
    onRequest(context) {
      context.headers.set('x-locale', currentLocale());
      return context;
    },
  },
});

/**
 * Read the session from the database, bypassing (and refreshing) better-auth's
 * short-lived session cookie cache - e.g. right after the email was verified.
 */
export function getFreshSession() {
  return authClient.getSession({ query: { disableCookieCache: true } });
}

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  sendVerificationEmail,
  updateUser,
  changePassword,
  listAccounts,
} = authClient;

/** Map a better-auth error to a translation key in the `auth` namespace. */
export function authErrorKey(error: { status?: number; code?: string } | null | undefined): string {
  if (!error) return 'genericError';
  if (error.status === 429) return 'tooManyRequests';
  switch (error.code) {
    case 'INVALID_EMAIL_OR_PASSWORD':
      return 'invalidCredentials';
    case 'USER_ALREADY_EXISTS':
    case 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL':
      return 'emailTaken';
    case 'PASSWORD_TOO_SHORT':
      return 'passwordTooShort';
    case 'INVALID_PASSWORD':
      return 'wrongCurrentPassword';
    case 'INVALID_TOKEN':
    case 'TOKEN_EXPIRED':
      return 'invalidResetLink';
    default:
      return 'genericError';
  }
}
