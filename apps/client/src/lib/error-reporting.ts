import { createErrorReporter, NOOP_REPORTER, type ErrorReporter } from '@baia/shared';

/**
 * Storefront error reporter (browser and Next server). A strict no-op unless
 * NEXT_PUBLIC_SENTRY_DSN was set at build time. Events are scrubbed of PII
 * before they leave (see packages/shared/src/error-reporting.ts).
 * NEXT_PUBLIC_* values are inlined, so they must be referenced literally.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

let reporter: ErrorReporter | undefined;

export function getErrorReporter(): ErrorReporter {
  if (!dsn) return NOOP_REPORTER;
  reporter ??= createErrorReporter({
    dsn,
    platform: typeof window === 'undefined' ? 'node' : 'javascript',
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || undefined,
    tags: { app: 'baia-client', runtime: typeof window === 'undefined' ? 'server' : 'browser' },
  });
  return reporter;
}
