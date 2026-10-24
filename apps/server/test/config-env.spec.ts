import { loadConfig, EnvValidationError, parseEnv, parseTrustProxy } from '../src/config/env';
import { resolveStorageProvider } from '../src/storage/storage.module';
import { S3StorageService } from '../src/storage/s3-storage.service';
import { LocalStorageService } from '../src/storage/local-storage.service';
import { securityHeaders } from '../src/common/security-headers';

const STRONG_SECRET = 'q7Vn2kP9xR4sT8wZ1bC6dF3gH5jK0mN2pQ4rS6tU8v=';

/** A complete, valid production environment (Railway proxy topology). */
function prodEnv(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://u:p@postgres.railway.internal:5432/railway',
    BETTER_AUTH_SECRET: STRONG_SECRET,
    BETTER_AUTH_URL: 'https://baia.co.il',
    CLIENT_URL: 'https://baia.co.il,https://www.baia.co.il',
    EMAIL_PROVIDER: 'smtp',
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: '465',
    SMTP_SECURE: 'true',
    SMTP_USER: 'shop@example.org',
    SMTP_PASSWORD: 'app-password',
    EMAIL_FROM: 'BAIA Swimwear <baiaswimwear0@gmail.com>',
    STORAGE_PROVIDER: 's3',
    S3_ENDPOINT: 'https://acc.r2.cloudflarestorage.com',
    S3_PUBLIC_URL: 'https://images.baia.co.il',
    S3_PUBLIC_URL_INCLUDES_BUCKET: 'false',
    S3_REGION: 'auto',
    S3_ACCESS_KEY: 'AKIAEXAMPLE',
    S3_SECRET_KEY: 'secret-example',
    S3_BUCKET: 'baia-assets',
    ADMIN_NOTIFY_EMAIL: 'orders@baia.co.il',
    PAYMENT_PROVIDER: 'mock',
    OWNER_EMAIL: 'owner@baia.co.il',
    ...overrides,
  };
}

function errorsOf(env: Record<string, string | undefined>): string[] {
  const result = parseEnv(env);
  return result.success ? [] : result.errors;
}

describe('server env validation', () => {
  describe('development', () => {
    it('boots with an empty environment using dev defaults', () => {
      const result = parseEnv({});
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.config.nodeEnv).toBe('development');
      expect(result.config.port).toBe(8000);
      expect(result.config.clientUrl).toBe('http://localhost:3000');
      expect(result.config.storage.provider).toBe('local');
      expect(result.config.email.provider).toBe('console');
      expect(result.config.trustProxy).toBe(false);
      expect(result.warnings.join(' ')).toMatch(/BETTER_AUTH_SECRET/);
    });

    it('parses CLIENT_URL as a comma list and merges TRUSTED_ORIGINS for CORS', () => {
      const result = parseEnv({ CLIENT_URL: 'http://localhost:3050/, http://127.0.0.1:3050', TRUSTED_ORIGINS: 'http://localhost:6006' });
      expect(result.success && result.config.allowedOrigins).toEqual([
        'http://localhost:3050',
        'http://127.0.0.1:3050',
        'http://localhost:6006',
      ]);
      expect(result.success && result.config.clientUrl).toBe('http://localhost:3050');
    });

    it('still rejects malformed values', () => {
      const errors = errorsOf({ PORT: 'eighty', CLIENT_URL: 'not a url', SMTP_HOST: 'h', SMTP_USER: 'u' });
      expect(errors.join('\n')).toMatch(/PORT/);
      expect(errors.join('\n')).toMatch(/CLIENT_URL must be an absolute/);
      expect(errors.join('\n')).toMatch(/SMTP_PASSWORD is required when SMTP_USER/);
    });
  });

  describe('production', () => {
    it('accepts a complete production environment', () => {
      const result = parseEnv(prodEnv());
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.config.isProduction).toBe(true);
      expect(result.config.trustProxy).toBe(1);
      expect(result.config.email.smtp).toMatchObject({ host: 'smtp.gmail.com', port: 465, secure: true });
      expect(result.config.storage.s3.publicUrlIncludesBucket).toBe(false);
      expect(result.warnings.join(' ')).toMatch(/PAYMENT_PROVIDER=mock/);
    });

    it('validates OWNER_EMAIL and lowercases it', () => {
      expect(errorsOf(prodEnv({ OWNER_EMAIL: 'not-an-email' })).join('\n')).toMatch(/OWNER_EMAIL must be an email/);
      const result = parseEnv(prodEnv({ OWNER_EMAIL: 'Owner@Baia.co.il' }));
      expect(result.success && result.config.auth.ownerEmail).toBe('owner@baia.co.il');
    });

    it('lists EVERY missing variable at once', () => {
      const errors = errorsOf({ NODE_ENV: 'production' });
      const text = errors.join('\n');
      for (const name of [
        'DATABASE_URL',
        'CLIENT_URL',
        'BETTER_AUTH_SECRET',
        'BETTER_AUTH_URL',
        'EMAIL_PROVIDER',
        'EMAIL_FROM',
        'STORAGE_PROVIDER',
        'PAYMENT_PROVIDER',
        'OWNER_EMAIL',
      ]) {
        expect(text).toContain(name);
      }
      expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(EnvValidationError);
    });

    it.each([
      ['missing', undefined, /required in production/],
      ['placeholder', 'change-me-to-a-random-secret', /placeholder/],
      ['placeholder-like', 'please-change-me-please-change-me-please', /placeholder/],
      ['short', 'tooShortSecret123', /at least 32 characters/],
    ])('rejects a %s BETTER_AUTH_SECRET', (_label, secret, pattern) => {
      expect(errorsOf(prodEnv({ BETTER_AUTH_SECRET: secret })).join('\n')).toMatch(pattern);
    });

    it('requires https origins (localhost is allowed for local production simulations)', () => {
      expect(errorsOf(prodEnv({ CLIENT_URL: 'http://baia.co.il' })).join('\n')).toMatch(/CLIENT_URL must use https/);
      expect(errorsOf(prodEnv({ BETTER_AUTH_URL: 'http://api.baia.co.il' })).join('\n')).toMatch(/BETTER_AUTH_URL must use https/);
      expect(errorsOf(prodEnv({ CLIENT_URL: 'https://baia.co.il/he' })).join('\n')).toMatch(/origin without a path/);
      expect(parseEnv(prodEnv({ CLIENT_URL: 'http://localhost:3070', BETTER_AUTH_URL: 'http://localhost:3070' })).success).toBe(true);
    });

    it('requires SMTP settings when EMAIL_PROVIDER=smtp', () => {
      const errors = errorsOf(prodEnv({ SMTP_HOST: undefined, SMTP_PASSWORD: undefined })).join('\n');
      expect(errors).toMatch(/SMTP_HOST is required/);
      expect(errors).toMatch(/SMTP_PASSWORD is required/);
    });

    it('rejects placeholder senders', () => {
      expect(errorsOf(prodEnv({ EMAIL_FROM: 'BAIA <no-reply@baia.local>' })).join('\n')).toMatch(/placeholder domain/);
    });

    it('rejects local storage and incomplete S3 settings', () => {
      expect(errorsOf(prodEnv({ STORAGE_PROVIDER: 'local' })).join('\n')).toMatch(/STORAGE_PROVIDER must be "s3" in production/);
      expect(errorsOf(prodEnv({ STORAGE_PROVIDER: undefined })).join('\n')).toMatch(/STORAGE_PROVIDER must be "s3"/);
      const s3 = errorsOf(prodEnv({ S3_BUCKET: undefined, S3_ACCESS_KEY: 'test', S3_PUBLIC_URL: undefined })).join('\n');
      expect(s3).toMatch(/S3_BUCKET is required/);
      expect(s3).toMatch(/LocalStack "test" placeholders/);
      expect(s3).toMatch(/S3_PUBLIC_URL \(or CDN_URL\) is required/);
    });

    it('requires an explicit payment provider and rejects unknown ones', () => {
      expect(errorsOf(prodEnv({ PAYMENT_PROVIDER: undefined })).join('\n')).toMatch(/PAYMENT_PROVIDER is required/);
      expect(errorsOf(prodEnv({ PAYMENT_PROVIDER: 'stripe' })).join('\n')).toMatch(/not implemented/);
    });

    it('rejects a cookie domain on the public suffix up.railway.app', () => {
      expect(errorsOf(prodEnv({ AUTH_COOKIE_DOMAIN: '.up.railway.app' })).join('\n')).toMatch(/Public Suffix List/);
      expect(parseEnv(prodEnv({ AUTH_COOKIE_DOMAIN: '.baia.co.il' })).success).toBe(true);
    });

    it('validates numeric knobs, Google pairs and the tracking template', () => {
      const errors = errorsOf(
        prodEnv({ PENDING_ORDER_TTL_MINUTES: '-5', GOOGLE_CLIENT_ID: 'id', TRACKING_URL_TEMPLATE: 'https://track/x' }),
      ).join('\n');
      expect(errors).toMatch(/PENDING_ORDER_TTL_MINUTES/);
      expect(errors).toMatch(/GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET/);
      expect(errors).toMatch(/\{tracking\}/);
    });
    it('enables Google sign-in only when both the client id and secret are set', () => {
      const both = parseEnv(prodEnv({ GOOGLE_CLIENT_ID: 'id.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'GOCSPX-x' }));
      expect(both.success && both.config.auth.google).toEqual({ clientId: 'id.apps.googleusercontent.com', clientSecret: 'GOCSPX-x' });
      const none = parseEnv(prodEnv());
      expect(none.success && none.config.auth.google).toBeNull();
    });
  });

  describe('parseTrustProxy', () => {
    it.each([
      [undefined, false, false],
      [undefined, true, 1],
      ['2', true, 2],
      ['true', true, true],
      ['false', true, false],
      ['loopback, uniquelocal', true, 'loopback, uniquelocal'],
    ])('%s (prod=%s) -> %s', (value, prod, expected) => {
      expect(parseTrustProxy(value, prod)).toEqual(expected);
    });
  });
});

describe('resolveStorageProvider', () => {
  it('uses S3 when configured', () => {
    expect(resolveStorageProvider({ STORAGE_PROVIDER: 's3', NODE_ENV: 'production' })).toBe(S3StorageService);
  });
  it('falls back to local disk outside production', () => {
    expect(resolveStorageProvider({ NODE_ENV: 'development' })).toBe(LocalStorageService);
  });
  it('refuses local disk in production', () => {
    expect(() => resolveStorageProvider({ NODE_ENV: 'production', STORAGE_PROVIDER: 'local' })).toThrow(/not allowed in production/);
    expect(() => resolveStorageProvider({ NODE_ENV: 'production' })).toThrow(/not allowed in production/);
  });
});

describe('securityHeaders', () => {
  function run(path: string, hsts: boolean) {
    const headers: Record<string, string> = {};
    const res = { setHeader: (k: string, v: string) => (headers[k] = v) };
    const next = jest.fn();
    securityHeaders({ hsts })({ path } as never, res as never, next);
    expect(next).toHaveBeenCalled();
    return headers;
  }

  it('sets baseline headers and HSTS only when asked', () => {
    const prod = run('/v1/products', true);
    expect(prod['X-Content-Type-Options']).toBe('nosniff');
    expect(prod['X-Frame-Options']).toBe('DENY');
    expect(prod['Strict-Transport-Security']).toMatch(/max-age=31536000/);
    expect(prod['Cross-Origin-Resource-Policy']).toBe('same-site');
    expect(run('/v1/products', false)['Strict-Transport-Security']).toBeUndefined();
  });

  it('lets other sites embed uploaded images', () => {
    expect(run('/uploads/products/a.jpg', true)['Cross-Origin-Resource-Policy']).toBe('cross-origin');
  });
});

describe('server env validation: S3 endpoints', () => {
  it('allows a plain-http private S3 endpoint but requires https public image URLs', () => {
    const base = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://u:p@db:5432/x',
      BETTER_AUTH_SECRET: 'q7Vn2kP9xR4sT8wZ1bC6dF3gH5jK0mN2pQ4rS6tU8v=',
      BETTER_AUTH_URL: 'https://baia.co.il',
      CLIENT_URL: 'https://baia.co.il',
      EMAIL_PROVIDER: 'console',
      EMAIL_FROM: 'orders@baia.co.il',
      STORAGE_PROVIDER: 's3',
      S3_ENDPOINT: 'http://minio.railway.internal:9000',
      S3_ACCESS_KEY: 'k',
      S3_SECRET_KEY: 's',
      S3_BUCKET: 'b',
      PAYMENT_PROVIDER: 'mock',
      OWNER_EMAIL: 'owner@baia.co.il',
    };
    expect(parseEnv({ ...base, S3_PUBLIC_URL: 'https://images.baia.co.il' }).success).toBe(true);
    const bad = parseEnv({ ...base, S3_PUBLIC_URL: 'http://images.baia.co.il' });
    expect(!bad.success && bad.errors.join('\n')).toMatch(/S3_PUBLIC_URL must use https/);
  });
});

describe('server env validation: payments flag and business inbox', () => {
  it('accepts EMAIL_PROVIDER=resend with RESEND_API_KEY and rejects it without the key', () => {
    const base = { EMAIL_PROVIDER: 'resend', SMTP_HOST: undefined, SMTP_USER: undefined, SMTP_PASSWORD: undefined, ADMIN_NOTIFY_EMAIL: 'shop@example.org' };
    expect(errorsOf(prodEnv({ ...base, RESEND_API_KEY: 're_x' }))).toEqual([]);
    expect(errorsOf(prodEnv(base)).join('\n')).toMatch(/RESEND_API_KEY is required/);
  });

  it('requires ADMIN_NOTIFY_EMAIL in production when EMAIL_PROVIDER=smtp', () => {
    expect(errorsOf(prodEnv({ ADMIN_NOTIFY_EMAIL: undefined })).join('\n')).toMatch(/ADMIN_NOTIFY_EMAIL is required/);
    expect(errorsOf(prodEnv({ ADMIN_NOTIFY_EMAIL: undefined, EMAIL_PROVIDER: 'console', SMTP_HOST: undefined })).join('\n')).not.toMatch(
      /ADMIN_NOTIFY_EMAIL is required/,
    );
  });

  it('PAYMENTS_ENABLED defaults to off in production and on elsewhere, and can be overridden', () => {
    const enabled = (env: Record<string, string | undefined>) => {
      const result = parseEnv(env);
      if (!result.success) throw new Error(result.errors.join('; '));
      return result.config.payment.enabled;
    };
    expect(enabled(prodEnv())).toBe(false);
    expect(enabled(prodEnv({ PAYMENTS_ENABLED: 'true' }))).toBe(true);
    expect(enabled({ NODE_ENV: 'development' })).toBe(true);
    expect(enabled({ NODE_ENV: 'development', PAYMENTS_ENABLED: 'false' })).toBe(false);
    expect(errorsOf(prodEnv({ PAYMENTS_ENABLED: 'maybe' })).join('\n')).toMatch(/PAYMENTS_ENABLED must be true or false/);
  });
});

