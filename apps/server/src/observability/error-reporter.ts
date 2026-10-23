import { createErrorReporter, NOOP_REPORTER, parseDsn, type ErrorReporter } from '@baia/shared';

let reporter: ErrorReporter = NOOP_REPORTER;

/**
 * Builds the process-wide reporter from the environment. A strict no-op unless
 * SENTRY_DSN is set to a valid DSN. Called once from main.ts; safe to call again.
 */
export function initErrorReporting(env: Record<string, string | undefined> = process.env): ErrorReporter {
  const dsn = env.SENTRY_DSN?.trim();
  reporter = createErrorReporter({
    dsn,
    platform: 'node',
    environment: env.SENTRY_ENVIRONMENT?.trim() || env.RAILWAY_ENVIRONMENT_NAME?.trim() || env.NODE_ENV || 'development',
    release: env.SENTRY_RELEASE?.trim() || env.RAILWAY_GIT_COMMIT_SHA?.trim() || undefined,
    tags: { app: 'baia-server' },
  });
  if (dsn && !parseDsn(dsn)) {
    console.warn('[sentry] SENTRY_DSN is set but is not a valid DSN (expected https://<key>@<host>/<project-id>); error reporting is disabled.');
  } else if (reporter.enabled) {
    console.log('[sentry] error reporting enabled');
    // Observe-only: does not change Node's crash behaviour (unlike an 'uncaughtException' listener).
    process.on('uncaughtExceptionMonitor', (err) => reporter.captureException(err, { level: 'fatal' }));
  }
  return reporter;
}

/** The current reporter (a no-op until `initErrorReporting` ran with a DSN). */
export function getErrorReporter(): ErrorReporter {
  return reporter;
}
