import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertClientEnv, imageRemotePatterns, validateClientEnv } from '../env';
import {
  forwardedRequestHeaders,
  isSameOriginRequest,
  isProxyMode,
  publicApiUrl,
  publicAuthUrl,
  serverApiUrl,
  serverAuthUrl,
} from '../api-urls';

afterEach(() => vi.unstubAllEnvs());

const proxyProd = {
  NEXT_PUBLIC_SITE_URL: 'https://baia.co.il',
  NEXT_PUBLIC_API_URL: '/v1',
  API_INTERNAL_URL: 'http://server.railway.internal:8000',
  IMAGE_REMOTE_PATTERNS: 'https://images.baia.co.il',
};

describe('validateClientEnv', () => {
  it('accepts an empty env outside production (dev defaults)', () => {
    expect(validateClientEnv({}, { production: false }).success).toBe(true);
  });

  it('accepts the Railway same-origin proxy setup', () => {
    expect(validateClientEnv(proxyProd, { production: true })).toEqual({ success: true, warnings: [] });
  });

  it('accepts the direct (custom domain) setup', () => {
    const result = validateClientEnv(
      {
        NEXT_PUBLIC_SITE_URL: 'https://baia.co.il',
        NEXT_PUBLIC_API_URL: 'https://api.baia.co.il/v1',
        NEXT_PUBLIC_AUTH_URL: 'https://api.baia.co.il',
        IMAGE_REMOTE_PATTERNS: 'https://images.baia.co.il',
      },
      { production: true },
    );
    expect(result.success).toBe(true);
  });

  it('lists every missing variable for a production build', () => {
    const result = validateClientEnv({}, { production: true });
    expect(result.success).toBe(false);
    if (result.success) return;
    const text = result.errors.join('\n');
    expect(text).toMatch(/NEXT_PUBLIC_SITE_URL is required/);
    expect(text).toMatch(/NEXT_PUBLIC_API_URL is required/);
  });

  it('requires API_INTERNAL_URL in proxy mode and https public URLs', () => {
    const result = validateClientEnv(
      { NEXT_PUBLIC_SITE_URL: 'http://baia.co.il', NEXT_PUBLIC_API_URL: '/v1' },
      { production: true },
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.join('\n')).toMatch(/API_INTERNAL_URL is required/);
    expect(result.errors.join('\n')).toMatch(/NEXT_PUBLIC_SITE_URL must use https/);
  });

  it('allows http on localhost (local production simulation)', () => {
    expect(
      validateClientEnv({ ...proxyProd, NEXT_PUBLIC_SITE_URL: 'http://localhost:3070' }, { production: true }).success,
    ).toBe(true);
  });

  it('rejects a proxied API path other than /v1 and bad templates', () => {
    const result = validateClientEnv(
      { ...proxyProd, NEXT_PUBLIC_API_URL: '/api', NEXT_PUBLIC_TRACKING_URL_TEMPLATE: 'https://t/x' },
      { production: true },
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.join('\n')).toMatch(/exactly "\/v1"/);
    expect(result.errors.join('\n')).toMatch(/\{tracking\}/);
  });

  it('assertClientEnv throws one message with every problem', () => {
    expect(() => assertClientEnv({}, { production: true })).toThrow(/2 problems[\s\S]*NEXT_PUBLIC_SITE_URL[\s\S]*NEXT_PUBLIC_API_URL/);
  });
});

describe('imageRemotePatterns', () => {
  it('turns URLs into next/image remote patterns', () => {
    expect(imageRemotePatterns('https://images.baia.co.il, http://baia-s3.localhost:9070/baia-assets/')).toEqual([
      { protocol: 'https', hostname: 'images.baia.co.il' },
      { protocol: 'http', hostname: 'baia-s3.localhost', port: '9070', pathname: '/baia-assets/**' },
    ]);
    expect(imageRemotePatterns(undefined)).toEqual([]);
  });
});

describe('api-urls', () => {
  it('defaults to the local API in development', () => {
    for (const name of ['NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_AUTH_URL', 'API_INTERNAL_URL', 'API_URL', 'AUTH_URL']) vi.stubEnv(name, '');
    expect(isProxyMode()).toBe(false);
    expect(publicApiUrl()).toBe('http://localhost:8000/v1');
    expect(publicAuthUrl()).toBe('http://localhost:8000');
    expect(serverApiUrl()).toBe('http://localhost:8000/v1');
    expect(serverAuthUrl()).toBe('http://localhost:8000');
  });

  it('uses the storefront origin in the browser and the private network on the server in proxy mode', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '/v1');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://baia.co.il/');
    vi.stubEnv('API_INTERNAL_URL', 'http://server.railway.internal:8000/');
    expect(isProxyMode()).toBe(true);
    expect(publicApiUrl()).toBe('/v1');
    expect(publicAuthUrl()).toBe('https://baia.co.il');
    expect(serverApiUrl()).toBe('http://server.railway.internal:8000/v1');
    expect(serverAuthUrl()).toBe('http://server.railway.internal:8000');
  });

  it('honours explicit server-side overrides', () => {
    vi.stubEnv('API_URL', 'http://api:8000/v1');
    vi.stubEnv('AUTH_URL', 'http://api:8000');
    expect(serverApiUrl()).toBe('http://api:8000/v1');
    expect(serverAuthUrl()).toBe('http://api:8000');
  });

  it('forwards only the cookie and the client IP chain', () => {
    const headers = new Headers({ cookie: 'a=b', 'x-forwarded-for': '203.0.113.7', authorization: 'x' });
    expect(forwardedRequestHeaders(headers)).toEqual({ cookie: 'a=b', 'x-forwarded-for': '203.0.113.7' });
  });
});

describe('isSameOriginRequest', () => {
  it('matches the Host the browser used, not the container bind address', () => {
    expect(isSameOriginRequest('https://baia.co.il', new Headers({ host: 'baia.co.il' }))).toBe(true);
    expect(isSameOriginRequest('https://baia.co.il', new Headers({ host: '0.0.0.0:3000', 'x-forwarded-host': 'baia.co.il' }))).toBe(true);
    expect(isSameOriginRequest('https://evil.example', new Headers({ host: 'baia.co.il' }))).toBe(false);
    expect(isSameOriginRequest('not a url', new Headers({ host: 'baia.co.il' }))).toBe(false);
  });

  it('falls back to NEXT_PUBLIC_SITE_URL', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://baia.co.il');
    expect(isSameOriginRequest('https://baia.co.il', new Headers({ host: 'internal:3000' }))).toBe(true);
  });
});

describe('validateClientEnv: Sentry', () => {
  it('treats NEXT_PUBLIC_SENTRY_DSN as optional and only warns on an invalid one', () => {
    expect(validateClientEnv({ ...proxyProd, NEXT_PUBLIC_SENTRY_DSN: 'https://abc@o1.ingest.sentry.io/42' }, { production: true })).toEqual({ success: true, warnings: [] });
    const bad = validateClientEnv({ ...proxyProd, NEXT_PUBLIC_SENTRY_DSN: 'nope' }, { production: true });
    expect(bad.success).toBe(true);
    expect(bad.warnings.join()).toMatch(/NEXT_PUBLIC_SENTRY_DSN/);
  });
});
