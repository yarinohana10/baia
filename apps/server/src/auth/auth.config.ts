import { betterAuth, type BetterAuthOptions } from 'better-auth';
import type { EmailService } from '../email/email.service';
import { DEFAULT_EMAIL_LOCALE, EMAIL_LOCALES, type EmailLocale } from '../email/email.types';

const DEV_SECRET = 'baia-dev-secret-not-for-production';
const KNOWN_PLACEHOLDER_SECRETS = new Set([
  'baia-dev-secret',
  DEV_SECRET,
  'change-me-to-a-random-secret',
  'generate-a-random-secret-here',
  'docker-dev-secret-change-me-in-production',
]);

/** Token lifetimes, in seconds. */
export const VERIFY_EMAIL_EXPIRES_IN = 24 * 60 * 60;
export const RESET_PASSWORD_EXPIRES_IN = 60 * 60;

/** Header the web client sends so emails go out in the language the user is browsing in. */
export const LOCALE_HEADER = 'x-locale';

/**
 * Production must provide a real secret: sessions and email tokens are signed
 * with it. Fail fast at boot instead of silently using a guessable value.
 */
export function resolveAuthSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.BETTER_AUTH_SECRET?.trim();
  if (env.NODE_ENV === 'production') {
    if (!secret) {
      throw new Error('BETTER_AUTH_SECRET must be set in production (generate one with `openssl rand -base64 32`).');
    }
    if (KNOWN_PLACEHOLDER_SECRETS.has(secret) || secret.length < 32) {
      throw new Error('BETTER_AUTH_SECRET is a placeholder or shorter than 32 characters; set a strong random secret.');
    }
    return secret;
  }
  if (!secret) {
    if (env.NODE_ENV !== 'test') {
      console.warn('[auth] BETTER_AUTH_SECRET not set - using an insecure development secret.');
    }
    return DEV_SECRET;
  }
  return secret;
}

function localeFromPath(value: string | null | undefined): EmailLocale | null {
  if (!value) return null;
  let pathname = value;
  try {
    pathname = new URL(value, 'http://placeholder').pathname;
  } catch {
    return null;
  }
  const first = pathname.split('/').filter(Boolean)[0];
  return EMAIL_LOCALES.includes(first as EmailLocale) ? (first as EmailLocale) : null;
}

/**
 * Pick the email language: explicit `x-locale` header from our client, then the
 * locale segment of a callback/redirect URL, then the Referer path, else Hebrew.
 */
export function resolveRequestLocale(request?: Request | null, urlWithCallback?: string): EmailLocale {
  const header = request?.headers?.get(LOCALE_HEADER)?.toLowerCase();
  if (header && EMAIL_LOCALES.includes(header as EmailLocale)) return header as EmailLocale;

  if (urlWithCallback) {
    try {
      const u = new URL(urlWithCallback);
      const fromCallback =
        localeFromPath(u.searchParams.get('callbackURL')) ?? localeFromPath(u.searchParams.get('redirectTo'));
      if (fromCallback) return fromCallback;
    } catch {
      // ignore malformed URL
    }
  }

  const fromReferer = localeFromPath(request?.headers?.get('referer'));
  return fromReferer ?? DEFAULT_EMAIL_LOCALE;
}

/** True when better-auth is sending the verification email as part of email/password sign-up. */
export function isSignUpRequest(request?: Request | null): boolean {
  if (!request?.url) return false;
  try {
    return new URL(request.url).pathname.endsWith('/sign-up/email');
  } catch {
    return false;
  }
}

function parseList(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

export interface CreateAuthOptions {
  database: BetterAuthOptions['database'];
  email: EmailService;
  env?: NodeJS.ProcessEnv;
}

export function createAuth({ database, email, env = process.env }: CreateAuthOptions) {
  const isProduction = env.NODE_ENV === 'production';
  const clientUrl = (env.CLIENT_URL || 'http://localhost:3000').split(',')[0].trim().replace(/\/$/, '');
  const trustedOrigins = Array.from(new Set([...parseList(env.CLIENT_URL), ...parseList(env.TRUSTED_ORIGINS)]));
  if (trustedOrigins.length === 0) trustedOrigins.push(clientUrl);

  const rateLimitEnabled =
    env.AUTH_RATE_LIMIT !== undefined ? env.AUTH_RATE_LIMIT === 'true' : env.NODE_ENV !== 'test';

  const welcome = (user: { email: string; name?: string | null }, locale: EmailLocale) =>
    email.dispatch('welcome', {
      to: user.email,
      locale,
      data: { name: user.name, shopUrl: `${clientUrl}/${locale}` },
    });

  return betterAuth({
    database,
    baseURL: env.BETTER_AUTH_URL || 'http://localhost:8000',
    secret: resolveAuthSecret(env),
    trustedOrigins,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      // Registration is optional and must never block login or checkout.
      requireEmailVerification: false,
      resetPasswordTokenExpiresIn: RESET_PASSWORD_EXPIRES_IN,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url, token }, request) => {
        const locale = resolveRequestLocale(request, url);
        // Not awaited: response time must not reveal whether the email exists.
        void email.dispatch('reset-password', {
          to: user.email,
          locale,
          data: {
            name: user.name,
            url: `${clientUrl}/${locale}/reset-password?token=${encodeURIComponent(token)}`,
            expiresInMinutes: RESET_PASSWORD_EXPIRES_IN / 60,
          },
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: false,
      autoSignInAfterVerification: false,
      expiresIn: VERIFY_EMAIL_EXPIRES_IN,
      sendVerificationEmail: async ({ user, url, token }, request) => {
        const locale = resolveRequestLocale(request, url);
        const verifyUrl = `${clientUrl}/${locale}/verify-email?token=${encodeURIComponent(token)}`;
        const expiresInHours = VERIFY_EMAIL_EXPIRES_IN / 3600;
        // Sign-up gets ONE warm welcome that carries the verify button; resends
        // (from the account banner) get the plain verification email.
        if (isSignUpRequest(request)) {
          void email.dispatch('welcome-verify', {
            to: user.email,
            locale,
            data: { name: user.name, url: verifyUrl, expiresInHours, shopUrl: `${clientUrl}/${locale}` },
          });
          return;
        }
        void email.dispatch('verify-email', {
          to: user.email,
          locale,
          data: { name: user.name, url: verifyUrl, expiresInHours },
        });
      },
      // No afterEmailVerification welcome: the sign-up email already welcomed them.
    },
    databaseHooks: {
      user: {
        create: {
          // Social sign-ups arrive already verified and never get the
          // welcome-verify email - welcome them on creation instead.
          after: async (user, ctx) => {
            if (user.emailVerified) void welcome(user, resolveRequestLocale(ctx?.request));
          },
        },
      },
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID || '',
        clientSecret: env.GOOGLE_CLIENT_SECRET || '',
        enabled: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      },
    },
    user: {
      additionalFields: {
        role: {
          type: 'string',
          defaultValue: 'CUSTOMER',
          input: false,
        },
      },
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
      },
    },
    rateLimit: {
      enabled: rateLimitEnabled,
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 10 },
        '/sign-up/email': { window: 60, max: 5 },
        '/request-password-reset': { window: 300, max: 3 },
        '/reset-password': { window: 300, max: 5 },
        '/send-verification-email': { window: 300, max: 3 },
        '/verify-email': { window: 60, max: 10 },
      },
    },
    advanced: {
      cookiePrefix: env.AUTH_COOKIE_PREFIX || 'baia',
      // In production cookies get the `__Secure-` prefix and the Secure flag.
      useSecureCookies: isProduction,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProduction,
      },
      // Share the session cookie between e.g. baia.com and api.baia.com so the
      // Next.js middleware/admin layout can see it.
      crossSubDomainCookies: env.AUTH_COOKIE_DOMAIN
        ? { enabled: true, domain: env.AUTH_COOKIE_DOMAIN }
        : undefined,
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
