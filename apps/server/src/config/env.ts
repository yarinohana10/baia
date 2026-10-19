import { z } from 'zod';

/**
 * Typed, validated server configuration.
 *
 * `process.env` is parsed ONCE at boot (see `validate-env.ts`, imported first by
 * `main.ts`). Development gets sensible defaults; `NODE_ENV=production` turns
 * the deploy-critical variables into hard requirements and the process refuses
 * to start with a single message listing EVERY missing/invalid variable.
 *
 * Adoption is incremental: modules that tests drive by mutating `process.env`
 * keep reading it lazily. New code should prefer `getConfig()`.
 *
 * The full variable reference lives in docs/railway-env.md.
 */

type Env = Record<string, string | undefined>;

/** Values that ship in example files / old docs and must never sign real sessions. */
export const PLACEHOLDER_SECRETS: ReadonlySet<string> = new Set([
  'baia-dev-secret',
  'baia-dev-secret-not-for-production',
  'change-me-to-a-random-secret',
  'generate-a-random-secret-here',
  'docker-dev-secret-change-me-in-production',
]);

const DEV_CLIENT_URL = 'http://localhost:3000';
const DEV_SERVER_URL = 'http://localhost:8000';
const DEV_EMAIL_FROM = 'BAIA <no-reply@baia.local>';

/** Hosts where plain http is acceptable even in production (local prod simulation). */
function isLocalHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.localhost') ||
    hostname === 'host.docker.internal'
  );
}

function tryUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/** Split a comma-separated list, trimming blanks and trailing slashes. */
export function parseList(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

function parseBool(value: string | undefined): boolean | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const v = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(v)) return true;
  if (['false', '0', 'no', 'off'].includes(v)) return false;
  return undefined;
}

/** Express `trust proxy` value: hop count, boolean, or a list of names/CIDRs. */
export type TrustProxy = boolean | number | string;

export function parseTrustProxy(value: string | undefined, isProduction: boolean): TrustProxy {
  const raw = value?.trim();
  // Railway (and most PaaS) put exactly one proxy hop in front of the container.
  if (!raw) return isProduction ? 1 : false;
  const bool = parseBool(raw);
  if (bool !== undefined && !/^\d+$/.test(raw)) return bool;
  if (/^\d+$/.test(raw)) return Number(raw);
  return raw;
}

export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  isProduction: boolean;
  port: number;
  databaseUrl: string | undefined;
  /** Express `trust proxy` setting (req.ip / rate limiting behind Railway's proxy). */
  trustProxy: TrustProxy;
  /** Max JSON / urlencoded request body (file uploads use multer's own limit). */
  bodyLimit: string;
  /** Storefront origins (CLIENT_URL list); the first one is used in emails/links. */
  clientUrls: string[];
  clientUrl: string;
  /** Browser origins allowed by CORS and by better-auth (CLIENT_URL + TRUSTED_ORIGINS). */
  allowedOrigins: string[];
  auth: {
    secret: string | undefined;
    baseUrl: string;
    cookiePrefix: string;
    cookieDomain: string | undefined;
    rateLimit: boolean | undefined;
    /** Proxy IPs/CIDRs better-auth may strip from X-Forwarded-For. */
    trustedProxies: string[];
    google: { clientId: string; clientSecret: string } | null;
  };
  email: {
    provider: 'smtp' | 'console';
    from: string;
    smtp: { host: string; port: number; secure: boolean; user?: string; password?: string } | null;
    adminNotifyEmail: string | undefined;
  };
  storage: {
    provider: 's3' | 'local';
    uploadsDir: string;
    s3: {
      endpoint: string | undefined;
      region: string;
      bucket: string;
      publicUrl: string;
      forcePathStyle: boolean | undefined;
      publicUrlIncludesBucket: boolean;
    };
  };
  payment: { provider: string | undefined; webhookSecret: string | undefined };
}

export type EnvParseResult =
  | { success: true; config: AppConfig; warnings: string[] }
  | { success: false; errors: string[]; warnings: string[] };

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v.trim() === '' ? undefined : v.trim()));

/** Every variable the server understands; all optional at the type level, rules live in superRefine. */
const rawEnvSchema = z.object({
  NODE_ENV: optionalString,
  PORT: optionalString,
  DATABASE_URL: optionalString,
  TRUST_PROXY: optionalString,
  BODY_LIMIT: optionalString,
  CLIENT_URL: optionalString,
  TRUSTED_ORIGINS: optionalString,
  BETTER_AUTH_SECRET: optionalString,
  BETTER_AUTH_URL: optionalString,
  AUTH_COOKIE_PREFIX: optionalString,
  AUTH_COOKIE_DOMAIN: optionalString,
  AUTH_RATE_LIMIT: optionalString,
  AUTH_TRUSTED_PROXIES: optionalString,
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  EMAIL_PROVIDER: optionalString,
  EMAIL_FROM: optionalString,
  SMTP_HOST: optionalString,
  SMTP_PORT: optionalString,
  SMTP_SECURE: optionalString,
  SMTP_USER: optionalString,
  SMTP_PASSWORD: optionalString,
  ADMIN_NOTIFY_EMAIL: optionalString,
  EMAIL_RETRY_DELAYS_MS: optionalString,
  STORAGE_PROVIDER: optionalString,
  UPLOADS_DIR: optionalString,
  S3_ENDPOINT: optionalString,
  S3_PUBLIC_URL: optionalString,
  CDN_URL: optionalString,
  S3_REGION: optionalString,
  S3_ACCESS_KEY: optionalString,
  S3_SECRET_KEY: optionalString,
  S3_BUCKET: optionalString,
  S3_FORCE_PATH_STYLE: optionalString,
  S3_PUBLIC_URL_INCLUDES_BUCKET: optionalString,
  PAYMENT_PROVIDER: optionalString,
  PAYMENT_WEBHOOK_SECRET: optionalString,
  PAYMENT_INSTALLMENTS_MIN_TOTAL: optionalString,
  PENDING_ORDER_TTL_MINUTES: optionalString,
  ORDER_ACCESS_TOKEN_TTL_DAYS: optionalString,
  TRACKING_URL_TEMPLATE: optionalString,
  SERVER_URL: optionalString,
});

type RawEnv = z.infer<typeof rawEnvSchema>;

/**
 * Pure: validates an env object and returns the typed config or the full list
 * of problems. Never throws, never logs, never reads process.env itself.
 */
export function parseEnv(env: Env): EnvParseResult {
  const raw: RawEnv = rawEnvSchema.parse(env);
  const errors: string[] = [];
  const warnings: string[] = [];

  const nodeEnvRaw = raw.NODE_ENV ?? 'development';
  if (!['development', 'production', 'test'].includes(nodeEnvRaw)) {
    errors.push(`NODE_ENV must be one of development | production | test (got "${nodeEnvRaw}").`);
  }
  const nodeEnv = (['development', 'production', 'test'].includes(nodeEnvRaw) ? nodeEnvRaw : 'development') as AppConfig['nodeEnv'];
  const isProduction = nodeEnv === 'production';

  const requireInProd = (name: keyof RawEnv, hint: string) => {
    if (isProduction && !raw[name]) errors.push(`${name} is required in production: ${hint}`);
  };

  /** Validates an absolute http(s) URL; with `https`, plain http is rejected in production except for local hosts. */
  const checkUrl = (name: string, value: string | undefined, opts: { originOnly?: boolean; https?: boolean } = {}): string | undefined => {
    if (!value) return undefined;
    const url = tryUrl(value);
    if (!url || !['http:', 'https:'].includes(url.protocol)) {
      errors.push(`${name} must be an absolute http(s) URL (got "${value}").`);
      return undefined;
    }
    if (opts.originOnly && url.pathname !== '/' && url.pathname !== '') {
      errors.push(`${name} must be an origin without a path (got "${value}"; expected e.g. "${url.origin}").`);
    }
    if (opts.https && isProduction && url.protocol !== 'https:' && !isLocalHost(url.hostname)) {
      errors.push(`${name} must use https in production (got "${value}").`);
    }
    return value.replace(/\/+$/, '');
  };

  // ── Core ───────────────────────────────────────────
  const port = raw.PORT === undefined ? 8000 : Number(raw.PORT);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) errors.push(`PORT must be a TCP port number (got "${raw.PORT}").`);

  requireInProd('DATABASE_URL', 'the Postgres connection string (Railway: ${{Postgres.DATABASE_URL}}).');
  if (raw.DATABASE_URL && !/^postgres(ql)?:\/\//.test(raw.DATABASE_URL)) {
    errors.push('DATABASE_URL must start with postgresql:// or postgres://.');
  }

  const bodyLimit = raw.BODY_LIMIT ?? '1mb';
  if (!/^\d+(b|kb|mb)$/i.test(bodyLimit)) errors.push(`BODY_LIMIT must look like "1mb" or "500kb" (got "${bodyLimit}").`);

  // ── Origins ────────────────────────────────────────
  requireInProd('CLIENT_URL', 'the public storefront origin(s), comma separated (e.g. https://baia.co.il,https://www.baia.co.il).');
  const clientUrls = parseList(raw.CLIENT_URL).map((u) => checkUrl('CLIENT_URL', u, { originOnly: true, https: true })).filter((u): u is string => !!u);
  const extraOrigins = parseList(raw.TRUSTED_ORIGINS).map((u) => checkUrl('TRUSTED_ORIGINS', u, { originOnly: true, https: true })).filter((u): u is string => !!u);
  const effectiveClientUrls = clientUrls.length ? clientUrls : [DEV_CLIENT_URL];
  const allowedOrigins = Array.from(new Set([...effectiveClientUrls, ...extraOrigins]));

  // ── Auth ───────────────────────────────────────────
  const secret = raw.BETTER_AUTH_SECRET;
  if (isProduction) {
    if (!secret) {
      errors.push('BETTER_AUTH_SECRET is required in production (generate one with `openssl rand -base64 32`).');
    } else if (PLACEHOLDER_SECRETS.has(secret) || /change-?me|generate-a|placeholder/i.test(secret)) {
      errors.push('BETTER_AUTH_SECRET is a placeholder value; set a strong random secret (`openssl rand -base64 32`).');
    } else if (secret.length < 32) {
      errors.push(`BETTER_AUTH_SECRET must be at least 32 characters (got ${secret.length}).`);
    }
  } else if (!secret && nodeEnv === 'development') {
    warnings.push('BETTER_AUTH_SECRET not set - using an insecure development secret.');
  }

  requireInProd(
    'BETTER_AUTH_URL',
    'the public origin the browser uses for /api/auth (the storefront origin when the storefront proxies the API, else the API origin).',
  );
  const authBaseUrl = checkUrl('BETTER_AUTH_URL', raw.BETTER_AUTH_URL, { originOnly: true, https: true }) ?? DEV_SERVER_URL;
  checkUrl('SERVER_URL', raw.SERVER_URL, { originOnly: true, https: true });

  if (raw.AUTH_COOKIE_DOMAIN && /\.up\.railway\.app$|^\.?up\.railway\.app$/.test(raw.AUTH_COOKIE_DOMAIN)) {
    errors.push(
      'AUTH_COOKIE_DOMAIN cannot be a *.up.railway.app domain (it is on the Public Suffix List; browsers reject the cookie). ' +
        'Use the same-origin API proxy or a custom domain instead.',
    );
  }

  const trustedProxies = parseList(raw.AUTH_TRUSTED_PROXIES);
  const rateLimit = parseBool(raw.AUTH_RATE_LIMIT);
  if (raw.AUTH_RATE_LIMIT && rateLimit === undefined) errors.push('AUTH_RATE_LIMIT must be true or false.');
  if (isProduction && rateLimit === false) warnings.push('AUTH_RATE_LIMIT=false in production: sign-in/sign-up are not rate limited.');

  let google: AppConfig['auth']['google'] = null;
  if (!!raw.GOOGLE_CLIENT_ID !== !!raw.GOOGLE_CLIENT_SECRET) {
    errors.push('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together (or both left empty to disable Google sign-in).');
  } else if (raw.GOOGLE_CLIENT_ID && raw.GOOGLE_CLIENT_SECRET) {
    google = { clientId: raw.GOOGLE_CLIENT_ID, clientSecret: raw.GOOGLE_CLIENT_SECRET };
  }

  // ── Email ──────────────────────────────────────────
  const emailProviderRaw = (raw.EMAIL_PROVIDER ?? (raw.SMTP_HOST ? 'smtp' : 'console')).toLowerCase();
  if (!['smtp', 'console'].includes(emailProviderRaw)) {
    errors.push(`EMAIL_PROVIDER must be "smtp" or "console" (got "${raw.EMAIL_PROVIDER}").`);
  }
  const emailProvider = (emailProviderRaw === 'smtp' ? 'smtp' : 'console') as 'smtp' | 'console';
  requireInProd('EMAIL_PROVIDER', 'set it to "smtp" (or "console" to deliberately disable email delivery).');
  if (isProduction && emailProvider === 'console' && raw.EMAIL_PROVIDER) {
    warnings.push('EMAIL_PROVIDER=console in production: order confirmations and password resets will NOT be delivered.');
  }
  let smtp: AppConfig['email']['smtp'] = null;
  if (emailProvider === 'smtp') {
    if (!raw.SMTP_HOST) errors.push('SMTP_HOST is required when EMAIL_PROVIDER=smtp.');
    const smtpPort = raw.SMTP_PORT === undefined ? 587 : Number(raw.SMTP_PORT);
    if (!Number.isInteger(smtpPort) || smtpPort <= 0 || smtpPort > 65535) errors.push(`SMTP_PORT must be a port number (got "${raw.SMTP_PORT}").`);
    const secure = parseBool(raw.SMTP_SECURE);
    if (raw.SMTP_SECURE && secure === undefined) errors.push('SMTP_SECURE must be true or false.');
    if (raw.SMTP_USER && !raw.SMTP_PASSWORD) errors.push('SMTP_PASSWORD is required when SMTP_USER is set.');
    if (isProduction && !raw.SMTP_USER) warnings.push('SMTP_USER is empty: most production SMTP providers require authentication.');
    if (isProduction && smtpPort === 465 && secure !== true) warnings.push('SMTP_PORT=465 usually needs SMTP_SECURE=true (implicit TLS).');
    smtp = {
      host: raw.SMTP_HOST ?? '',
      port: smtpPort,
      secure: secure ?? false,
      user: raw.SMTP_USER,
      password: raw.SMTP_PASSWORD,
    };
  }
  requireInProd('EMAIL_FROM', 'the sender, e.g. "BAIA Swimwear <orders@baia.co.il>" (must be a verified sender at your SMTP provider).');
  if (isProduction && raw.EMAIL_FROM && /@baia\.local\b|@example\.(com|org)\b/i.test(raw.EMAIL_FROM)) {
    errors.push(`EMAIL_FROM uses a placeholder domain (${raw.EMAIL_FROM}); use a real, verified sender address.`);
  }
  const emailRe = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
  if (raw.EMAIL_FROM && !emailRe.test(raw.EMAIL_FROM.match(/<([^>]+)>/)?.[1] ?? raw.EMAIL_FROM)) {
    errors.push(`EMAIL_FROM must be "address@domain" or "Name <address@domain>" (got "${raw.EMAIL_FROM}").`);
  }
  if (raw.ADMIN_NOTIFY_EMAIL && !emailRe.test(raw.ADMIN_NOTIFY_EMAIL)) {
    errors.push(`ADMIN_NOTIFY_EMAIL must be an email address (got "${raw.ADMIN_NOTIFY_EMAIL}").`);
  }
  if (raw.EMAIL_RETRY_DELAYS_MS && !/^\s*\d+(\s*,\s*\d+)*\s*$/.test(raw.EMAIL_RETRY_DELAYS_MS)) {
    errors.push('EMAIL_RETRY_DELAYS_MS must be a comma-separated list of milliseconds, e.g. "0,2000,8000".');
  }

  // ── Storage ────────────────────────────────────────
  const storageProviderRaw = (raw.STORAGE_PROVIDER ?? 'local').toLowerCase();
  if (!['s3', 'local'].includes(storageProviderRaw)) {
    errors.push(`STORAGE_PROVIDER must be "s3" or "local" (got "${raw.STORAGE_PROVIDER}").`);
  }
  const storageProvider = (storageProviderRaw === 's3' ? 's3' : 'local') as 's3' | 'local';
  if (isProduction && storageProvider !== 's3') {
    errors.push(
      'STORAGE_PROVIDER must be "s3" in production: container filesystems (Railway) are ephemeral and uploaded images would be lost on every deploy. ' +
        'Use an S3-compatible bucket (Cloudflare R2, AWS S3, ...).',
    );
  }
  const forcePathStyle = parseBool(raw.S3_FORCE_PATH_STYLE);
  if (raw.S3_FORCE_PATH_STYLE && forcePathStyle === undefined) errors.push('S3_FORCE_PATH_STYLE must be true or false.');
  const includesBucket = parseBool(raw.S3_PUBLIC_URL_INCLUDES_BUCKET);
  if (raw.S3_PUBLIC_URL_INCLUDES_BUCKET && includesBucket === undefined) errors.push('S3_PUBLIC_URL_INCLUDES_BUCKET must be true or false.');
  checkUrl('S3_ENDPOINT', raw.S3_ENDPOINT);
  // Public image URLs end up in pages and emails: https only (mixed content).
  checkUrl('S3_PUBLIC_URL', raw.S3_PUBLIC_URL, { https: true });
  checkUrl('CDN_URL', raw.CDN_URL, { https: true });
  if (storageProvider === 's3' && isProduction) {
    for (const name of ['S3_BUCKET', 'S3_ACCESS_KEY', 'S3_SECRET_KEY'] as const) {
      if (!raw[name]) errors.push(`${name} is required in production when STORAGE_PROVIDER=s3.`);
    }
    if (raw.S3_ACCESS_KEY === 'test' || raw.S3_SECRET_KEY === 'test') {
      errors.push('S3_ACCESS_KEY / S3_SECRET_KEY are the LocalStack "test" placeholders; set real bucket credentials.');
    }
    if (!raw.S3_PUBLIC_URL && !raw.CDN_URL) {
      errors.push('S3_PUBLIC_URL (or CDN_URL) is required in production: the public base URL product images are served from.');
    }
  }
  const s3PublicUrl = (raw.CDN_URL || raw.S3_PUBLIC_URL || raw.S3_ENDPOINT || '').replace(/\/+$/, '');

  // ── Payment ────────────────────────────────────────
  const paymentProvider = raw.PAYMENT_PROVIDER?.toLowerCase();
  if (isProduction && !paymentProvider) {
    errors.push(
      'PAYMENT_PROVIDER is required in production. No real provider is integrated yet; PAYMENT_PROVIDER=mock confirms orders WITHOUT charging ' +
        'and is only acceptable for a staging/demo deploy.',
    );
  }
  if (paymentProvider && paymentProvider !== 'mock') {
    errors.push(`PAYMENT_PROVIDER "${raw.PAYMENT_PROVIDER}" is not implemented (supported: mock).`);
  }
  if (isProduction && paymentProvider === 'mock') {
    warnings.push('PAYMENT_PROVIDER=mock in production: orders are confirmed WITHOUT charging customers. Never take real orders like this.');
  }

  // ── Numbers / templates ────────────────────────────
  const nonNegative = (name: keyof RawEnv) => {
    const v = raw[name];
    if (v !== undefined && !(Number.isFinite(Number(v)) && Number(v) >= 0)) {
      errors.push(`${name} must be a non-negative number (got "${v}").`);
    }
  };
  nonNegative('PAYMENT_INSTALLMENTS_MIN_TOTAL');
  nonNegative('PENDING_ORDER_TTL_MINUTES');
  nonNegative('ORDER_ACCESS_TOKEN_TTL_DAYS');
  if (raw.TRACKING_URL_TEMPLATE && !raw.TRACKING_URL_TEMPLATE.includes('{tracking}')) {
    errors.push('TRACKING_URL_TEMPLATE must contain the {tracking} placeholder.');
  }

  if (errors.length) return { success: false, errors, warnings };

  return {
    success: true,
    warnings,
    config: {
      nodeEnv,
      isProduction,
      port,
      databaseUrl: raw.DATABASE_URL,
      trustProxy: parseTrustProxy(raw.TRUST_PROXY, isProduction),
      bodyLimit,
      clientUrls: effectiveClientUrls,
      clientUrl: effectiveClientUrls[0],
      allowedOrigins,
      auth: {
        secret,
        baseUrl: authBaseUrl,
        cookiePrefix: raw.AUTH_COOKIE_PREFIX ?? 'baia',
        cookieDomain: raw.AUTH_COOKIE_DOMAIN,
        rateLimit,
        trustedProxies,
        google,
      },
      email: {
        provider: emailProvider,
        from: raw.EMAIL_FROM ?? DEV_EMAIL_FROM,
        smtp,
        adminNotifyEmail: raw.ADMIN_NOTIFY_EMAIL,
      },
      storage: {
        provider: storageProvider,
        uploadsDir: raw.UPLOADS_DIR ?? './uploads',
        s3: {
          endpoint: raw.S3_ENDPOINT,
          region: raw.S3_REGION ?? 'us-east-1',
          bucket: raw.S3_BUCKET ?? 'baia-assets',
          publicUrl: s3PublicUrl,
          forcePathStyle,
          publicUrlIncludesBucket: includesBucket ?? true,
        },
      },
      payment: { provider: paymentProvider, webhookSecret: raw.PAYMENT_WEBHOOK_SECRET },
    },
  };
}

export class EnvValidationError extends Error {
  constructor(readonly errors: string[]) {
    super(
      `Invalid environment configuration (${errors.length} problem${errors.length === 1 ? '' : 's'}):\n` +
        errors.map((e) => `  - ${e}`).join('\n') +
        '\nSee docs/railway-env.md for every variable.',
    );
    this.name = 'EnvValidationError';
  }
}

/** Parse or throw an EnvValidationError listing every problem. */
export function loadConfig(env: Env = process.env): { config: AppConfig; warnings: string[] } {
  const result = parseEnv(env);
  if (!result.success) throw new EnvValidationError(result.errors);
  return { config: result.config, warnings: result.warnings };
}

let cached: AppConfig | null = null;

/** The validated config for this process (parsed on first use, then cached). */
export function getConfig(): AppConfig {
  if (!cached) cached = loadConfig(process.env).config;
  return cached;
}

/** Test helper: forget the cached config after mutating process.env. */
export function resetConfigCache() {
  cached = null;
}
