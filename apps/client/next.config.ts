import type { NextConfig } from 'next';
import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import createNextIntlPlugin from 'next-intl/plugin';
import { assertClientEnv, imageRemotePatterns } from './src/lib/env';

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

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  ...(isProduction ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }] : []),
];

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
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
    return [{ source: '/:path*', headers: securityHeaders }];
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
