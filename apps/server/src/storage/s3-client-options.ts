import type { S3ClientConfig } from '@aws-sdk/client-s3';

type Env = Record<string, string | undefined>;

function bool(value: string | undefined): boolean | undefined {
  const v = value?.trim().toLowerCase();
  if (v === 'true') return true;
  if (v === 'false') return false;
  return undefined;
}

/** Real AWS S3 endpoints (or no endpoint at all = AWS). Everything else is an S3-compatible service. */
function isAwsEndpoint(endpoint: string | undefined): boolean {
  if (!endpoint) return true;
  try {
    return /(^|\.)amazonaws\.com(\.cn)?$/.test(new URL(endpoint).hostname);
  } catch {
    return false;
  }
}

/**
 * One S3 client configuration for the API, the seed and the image scripts, so
 * they all behave the same on LocalStack, Cloudflare R2, MinIO and AWS.
 *
 * - Path-style addressing is used for every S3-compatible endpoint (LocalStack,
 *   MinIO, R2 `https://<account>.r2.cloudflarestorage.com`); only real AWS uses
 *   virtual-hosted style. `S3_FORCE_PATH_STYLE=true|false` overrides.
 * - R2 region is `auto` (S3_REGION); the SDK needs no ACLs from us (none are sent).
 * - Request/response checksums are only computed when an operation requires them
 *   for non-AWS endpoints: the SDK's newer default adds CRC32 trailers that some
 *   S3-compatible services reject.
 */
export function buildS3ClientConfig(env: Env = process.env): S3ClientConfig {
  const endpoint = env.S3_ENDPOINT?.trim() || undefined;
  const forcePathStyle = bool(env.S3_FORCE_PATH_STYLE) ?? !isAwsEndpoint(endpoint);
  return {
    region: env.S3_REGION?.trim() || 'us-east-1',
    ...(endpoint ? { endpoint } : {}),
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY || 'test',
      secretAccessKey: env.S3_SECRET_KEY || 'test',
    },
    forcePathStyle,
    ...(isAwsEndpoint(endpoint)
      ? {}
      : { requestChecksumCalculation: 'WHEN_REQUIRED' as const, responseChecksumValidation: 'WHEN_REQUIRED' as const }),
  };
}

/**
 * Public URL of an object. `CDN_URL` wins over `S3_PUBLIC_URL`, which wins over
 * the endpoint. With `S3_PUBLIC_URL_INCLUDES_BUCKET=false` (R2 public custom
 * domain, CDNs) the bucket is not part of the path.
 */
export function buildPublicUrl(key: string, env: Env = process.env): string {
  const bucket = env.S3_BUCKET || 'baia-assets';
  const base = (env.CDN_URL || env.S3_PUBLIC_URL || env.S3_ENDPOINT || '').replace(/\/+$/, '');
  const includesBucket = env.S3_PUBLIC_URL_INCLUDES_BUCKET?.trim().toLowerCase() !== 'false';
  return includesBucket ? `${base}/${bucket}/${key}` : `${base}/${key}`;
}
