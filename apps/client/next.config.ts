import type { NextConfig } from 'next';
import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import createNextIntlPlugin from 'next-intl/plugin';
import { assertClientEnv, imageRemotePatterns, parseList } from './src/lib/env';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const isProduction = process.env.NODE_ENV === 'production';

/** Local development image hosts (API static uploads, LocalStack S3). Not allowed in production builds. */
const DEV_IMAGE_PATTERNS: NonNullable<NextConfig['images']>['remotePatterns'] = [
  { protocol: 'http', hostname: 'localhost', port: '8000' },
  { protocol: 'http', hostname: 'localhost', port: '8050' },
  { protocol: 'http', hostname: 'localhost', port: '4566' },
];

/**
 * Same-origin API proxy (Railway). With API_INTERNAL_URL set, the browser
 * only ever talks to the storefront origin: /v1/* and /api/auth/* are
 * forwarded to the API over the private network, so better-auth's session
 * cookie is first-party (Railway's *.up.railway.app is a public suffix, so a
 * cookie can't be shared between two Railway subdomains).
 *
 * Rewrites are resolved at BUILD time (routes-manifest), so API_INTERNAL_URL
 * must be available to `next build` (Railway passes service variables as
 * Docker build args - see apps/client/Dockerfile).
 */
function apiProxyRewrites() {
  const target = process.env.API_INTERNAL_URL?.trim().replace(/\/+$/, '');
  if (!target) return [];
  return [
    { source: '/api/auth/:path*', destination: `${target}/api/auth/:path*` },
    { source: '/v1/:path*', destination: `${target}/v1/:path*` },
    // Local-disk uploads (dev/simulation only; production serves images from S3).
    { source: '/uploads/:path*', destination: `${target}/uploads/:path*` },
  ];
}

/** Origin of a URL string, or null. */
function originOf(value: string | undefined): string | null {
  try {
    return value ? new URL(value).origin : null;
  } catch {
    return null;
  }
}

/**
 * Content-Security-Policy in REPORT-ONLY mode: browsers log violations in the
 * console but block nothing, so it cannot break the shop. Next.js needs inline
 * scripts for hydration, hence 'unsafe-inline' (a nonce-based policy would
 * make every page dynamic). Review the console on a staging deploy, then
 * consider enforcing it. Image/API hosts come from the same variables the app
 * already uses (IMAGE_REMOTE_PATTERNS, NEXT_PUBLIC_SENTRY_DSN).
 */
function reportOnlyCsp(): string {
  const imageHosts = parseList(process.env.IMAGE_REMOTE_PATTERNS).map(originOf).filter((o): o is string => !!o);
  const sentryHost = originOf(process.env.NEXT_PUBLIC_SENTRY_DSN?.replace(/^(https?:\/\/)[^@]*@/, '$1'));
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${imageHosts.join(' ')}`.trim(),
    "font-src 'self' data:",
    `connect-src 'self' ${sentryHost ?? ''}`.trim(),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  ...(isProduction
    ? [
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        { key: 'Content-Security-Policy-Report-Only', value: reportOnlyCsp() },
      ]
    : []),
];

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  // Inlined into the browser bundle for error reports (Railway sets the commit SHA at build time).
  env: { NEXT_PUBLIC_SENTRY_RELEASE: process.env.RAILWAY_GIT_COMMIT_SHA ?? '' },
  transpilePackages: ['@baia/shared'],
  experimental: {
    // Request bodies proxied through rewrites are buffered up to this size;
    // the API accepts image uploads up to 10 MB (plus multipart overhead).
    middlewareClientMaxBodySize: '25mb',
  },
  images: {
    remotePatterns: [
      ...(isProduction ? [] : DEV_IMAGE_PATTERNS),
      ...imageRemotePatterns(process.env.IMAGE_REMOTE_PATTERNS),
    ],
  },
  async rewrites() {
    return apiProxyRewrites();
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Private/transactional pages (order access links carry tokens): never indexed, even if linked.
      {
        source: '/:locale(he|en)/:page(order-status|cancel-order|order-confirmation|checkout|cart|account|admin|login|register|wishlist)/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

/**
 * True only for `next build` itself. `next lint` and Storybook also load this
 * config with the production-build phase and must not require deploy env.
 */
function isNextBuild(phase: string): boolean {
  if (phase !== PHASE_PRODUCTION_BUILD || process.env.SKIP_ENV_VALIDATION === '1') return false;
  const bin = process.argv[1] ?? '';
  return /[\\/]next[\\/]dist[\\/]bin[\\/]next$/.test(bin) && process.argv.includes('build');
}

export default function config(phase: string): NextConfig {
  // Fail `next build` with every missing/invalid variable at once.
  if (isNextBuild(phase)) assertClientEnv(process.env, { production: true });
  return withNextIntl(nextConfig);
}
