import { z } from 'zod';

/**
 * Storefront environment validation (build + server only; never import this
 * from a client component - it pulls in Zod). Runtime URL helpers live in
 * ./api-urls.ts.
 *
 * `next.config.ts` calls `validateClientEnv()` during `next build`: in
 * production a missing/invalid variable fails the build with one message that
 * lists every problem. NEXT_PUBLIC_* values are inlined at build time, so on
 * Railway they must be present as build-time variables (they are by default).
 *
 * Full reference: docs/railway-env.md.
 */

type Env = Record<string, string | undefined>;

const optional = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v.trim() === '' ? undefined : v.trim()));

const schema = z.object({
  NODE_ENV: optional,
  NEXT_PUBLIC_SITE_URL: optional,
  NEXT_PUBLIC_API_URL: optional,
  NEXT_PUBLIC_AUTH_URL: optional,
  NEXT_PUBLIC_AUTH_COOKIE_PREFIX: optional,
  NEXT_PUBLIC_TRACKING_URL_TEMPLATE: optional,
  NEXT_PUBLIC_CONTACT_EMAIL: optional,
  API_INTERNAL_URL: optional,
  API_URL: optional,
  AUTH_URL: optional,
  IMAGE_REMOTE_PATTERNS: optional,
  NEXT_PUBLIC_SENTRY_DSN: optional,
});

export type ClientEnvResult = { success: true; warnings: string[] } | { success: false; errors: string[]; warnings: string[] };

function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname.endsWith('.localhost');
}

function parseUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

/** Pure validation of an env object (tests pass their own). */
export function validateClientEnv(env: Env, options: { production?: boolean } = {}): ClientEnvResult {
  const raw = schema.parse(env);
  const production = options.production ?? raw.NODE_ENV === 'production';
  const errors: string[] = [];
  const warnings: string[] = [];

  const url = (name: keyof typeof raw, opts: { https?: boolean; origin?: boolean } = {}): URL | null => {
    const value = raw[name];
    if (!value) return null;
    const parsed = parseUrl(value);
    if (!parsed) {
      errors.push(`${name} must be an absolute http(s) URL (got "${value}").`);
      return null;
    }
    if (opts.origin && parsed.pathname !== '/' && parsed.pathname !== '') {
      errors.push(`${name} must be an origin without a path (got "${value}").`);
    }
    if (opts.https && production && parsed.protocol !== 'https:' && !isLocalHost(parsed.hostname)) {
      errors.push(`${name} must use https in production (got "${value}").`);
    }
    return parsed;
  };

  // Public site origin: canonical URLs, sitemap, robots, OG tags.
  if (production && !raw.NEXT_PUBLIC_SITE_URL) {
    errors.push('NEXT_PUBLIC_SITE_URL is required for a production build (the public storefront origin, e.g. https://baia.co.il).');
  }
  url('NEXT_PUBLIC_SITE_URL', { https: true, origin: true });

  // Browser API base: absolute (direct) or a path (same-origin proxy).
  const api = raw.NEXT_PUBLIC_API_URL;
  const proxyMode = !!api && api.startsWith('/');
  if (production && !api) {
    errors.push('NEXT_PUBLIC_API_URL is required for a production build ("/v1" with the same-origin proxy, or https://api.example.com/v1).');
  }
  if (api && !proxyMode) url('NEXT_PUBLIC_API_URL', { https: true });
  if (proxyMode && api !== '/v1') {
    errors.push(`NEXT_PUBLIC_API_URL must be exactly "/v1" in proxy mode (got "${api}"); only /v1/* is proxied.`);
  }

  url('NEXT_PUBLIC_AUTH_URL', { https: true, origin: true });
  if (production && api && !proxyMode && !raw.NEXT_PUBLIC_AUTH_URL) {
    errors.push('NEXT_PUBLIC_AUTH_URL is required when NEXT_PUBLIC_API_URL is absolute (the API origin that serves /api/auth).');
  }
  if (proxyMode && raw.NEXT_PUBLIC_AUTH_URL && raw.NEXT_PUBLIC_SITE_URL) {
    const auth = parseUrl(raw.NEXT_PUBLIC_AUTH_URL);
    const site = parseUrl(raw.NEXT_PUBLIC_SITE_URL);
    if (auth && site && auth.origin !== site.origin) {
      warnings.push(
        `NEXT_PUBLIC_AUTH_URL (${auth.origin}) differs from NEXT_PUBLIC_SITE_URL (${site.origin}) in proxy mode: ` +
          'the session cookie is only first-party if auth calls go through the storefront origin.',
      );
    }
  }

  // Server-only: where the Next server reaches the API (private network).
  url('API_INTERNAL_URL', { origin: true });
  url('API_URL');
  url('AUTH_URL', { origin: true });
  if (proxyMode && !raw.API_INTERNAL_URL) {
    errors.push(
      'API_INTERNAL_URL is required when NEXT_PUBLIC_API_URL is "/v1": the proxy target, e.g. http://${{server.RAILWAY_PRIVATE_DOMAIN}}:8000 on Railway.',
    );
  }

  for (const entry of parseList(raw.IMAGE_REMOTE_PATTERNS)) {
    if (!parseUrl(entry)) errors.push(`IMAGE_REMOTE_PATTERNS entries must be absolute URLs (got "${entry}").`);
  }
  if (production && !raw.IMAGE_REMOTE_PATTERNS) {
    warnings.push('IMAGE_REMOTE_PATTERNS is empty: next/image will refuse product photos hosted on your S3/CDN domain.');
  }

  // Optional error reporting: an invalid DSN only disables it, it never fails the build.
  if (raw.NEXT_PUBLIC_SENTRY_DSN && !/^https?:\/\/[^@/\s]+@[^/\s]+(\/[^/\s]+)*\/\d+$/.test(raw.NEXT_PUBLIC_SENTRY_DSN)) {
    warnings.push('NEXT_PUBLIC_SENTRY_DSN is not a valid DSN (expected https://<key>@<host>/<project-id>); error reporting will be disabled.');
  }

  if (raw.NEXT_PUBLIC_TRACKING_URL_TEMPLATE && !raw.NEXT_PUBLIC_TRACKING_URL_TEMPLATE.includes('{tracking}')) {
    errors.push('NEXT_PUBLIC_TRACKING_URL_TEMPLATE must contain the {tracking} placeholder.');
  }
  if (raw.NEXT_PUBLIC_CONTACT_EMAIL && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.NEXT_PUBLIC_CONTACT_EMAIL)) {
    errors.push(`NEXT_PUBLIC_CONTACT_EMAIL must be an email address (got "${raw.NEXT_PUBLIC_CONTACT_EMAIL}").`);
  }

  return errors.length ? { success: false, errors, warnings } : { success: true, warnings };
}

export function parseList(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

type RemotePattern = { protocol: 'http' | 'https'; hostname: string; port?: string; pathname?: string };

/** next/image remotePatterns from IMAGE_REMOTE_PATTERNS ("https://images.baia.co.il,https://pub-x.r2.dev/baia/"). */
export function imageRemotePatterns(value: string | undefined): RemotePattern[] {
  return parseList(value).flatMap((entry) => {
    const u = parseUrl(entry);
    if (!u) return [];
    const path = u.pathname.replace(/\/+$/, '');
    return [
      {
        protocol: u.protocol.replace(':', '') as 'http' | 'https',
        hostname: u.hostname,
        ...(u.port ? { port: u.port } : {}),
        ...(path ? { pathname: `${path}/**` } : {}),
      },
    ];
  });
}

/** Throws one readable error listing every problem (used by next.config.ts at build). */
export function assertClientEnv(env: Env = process.env, options: { production?: boolean } = {}): void {
  const result = validateClientEnv(env, options);
  for (const w of result.warnings) console.warn(`[env] WARNING: ${w}`);
  if (!result.success) {
    throw new Error(
      `Invalid storefront environment (${result.errors.length} problem${result.errors.length === 1 ? '' : 's'}):\n` +
        result.errors.map((e) => `  - ${e}`).join('\n') +
        '\nSee docs/railway-env.md.',
    );
  }
}
