import { getErrorReporter } from '@/lib/error-reporting';

/**
 * Runs in the browser before the app hydrates. Registers global handlers only
 * when a DSN is configured, so without one nothing is attached at all.
 */
const reporter = getErrorReporter();

if (reporter.enabled && typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    // Cross-origin scripts / extensions surface as an opaque "Script error." with no Error object.
    if (!(event.error instanceof Error)) return;
    reporter.captureException(event.error, { request: { url: window.location.pathname } });
  });
  window.addEventListener('unhandledrejection', (event) => {
    reporter.captureException(event.reason, { request: { url: window.location.pathname }, tags: { kind: 'unhandledrejection' } });
  });
}
