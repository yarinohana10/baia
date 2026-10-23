import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('storefront error reporter', () => {
  it('is a no-op without NEXT_PUBLIC_SENTRY_DSN', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
    const { getErrorReporter } = await import('../error-reporting');
    expect(getErrorReporter().enabled).toBe(false);
  });

  it('is enabled with a valid DSN', async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://abc@o1.ingest.sentry.io/42');
    const { getErrorReporter } = await import('../error-reporting');
    expect(getErrorReporter().enabled).toBe(true);
  });
});
