/**
 * Railway Infrastructure as Code for BAIA (replaces railway.json / railway.toml,
 * which Railway no longer reads after 2026-12-01 and new services can't opt into).
 *
 *   npx -y @railway/cli@latest login
 *   npx -y @railway/cli@latest link            # pick the BAIA project
 *   npx -y @railway/cli@latest config plan     # review (values redacted)
 *   npx -y @railway/cli@latest config apply
 *
 * Secrets are NOT in this file: `preserve()` keeps whatever is set in the
 * Railway dashboard (Variables tab). Set them there before the first deploy.
 * The full variable reference is docs/railway-env.md; the runbook is
 * docs/DEPLOYMENT.md (which also lists the equivalent dashboard settings).
 *
 * Not modelled here: the nightly database-backup Cron service (scripts/backup/Dockerfile).
 * Railway's cron schedule is a dashboard setting; docs/DEPLOYMENT.md §11 and docs/GO-LIVE.md
 * walk through it.
 */
import { defineRailway, github, postgres, preserve, project, service } from 'railway/iac';

const REPO = 'yarinohana10/baia';
const BRANCH = 'main';

/**
 * Storefront public origin, as seen from each service. Replace both with
 * 'https://baia.co.il' once the custom domain is live (then redeploy the
 * client: NEXT_PUBLIC_* are baked in at build time).
 */
const SITE_URL_FROM_SERVER = 'https://${{client.RAILWAY_PUBLIC_DOMAIN}}';
const SITE_URL_FROM_CLIENT = 'https://${{RAILWAY_PUBLIC_DOMAIN}}';

export default defineRailway(() => {
  const db = postgres('Postgres');

  const server = service('server', {
    source: github(REPO, { branch: BRANCH }),
    build: {
      builder: 'DOCKERFILE',
      dockerfilePath: 'apps/server/Dockerfile',
      watchPatterns: ['apps/server/**', 'packages/shared/**', 'pnpm-lock.yaml', 'package.json'],
    },
    deploy: {
      // Runs in the freshly built image before traffic switches; a failing
      // migration stops the deploy and the previous version keeps serving.
      preDeployCommand: ['node_modules/.bin/prisma migrate deploy'],
      healthcheckPath: '/v1/health',
      healthcheckTimeout: 120,
      restartPolicyType: 'ON_FAILURE',
      restartPolicyMaxRetries: 10,
      // Keep ONE replica: rate limits are in-memory per process.
      numReplicas: 1,
    },
    env: {
      NODE_ENV: 'production',
      PORT: '8000',
      DATABASE_URL: db.env.DATABASE_URL,
      // Same-origin proxy: the browser reaches /api/auth via the storefront.
      BETTER_AUTH_URL: SITE_URL_FROM_SERVER,
      CLIENT_URL: SITE_URL_FROM_SERVER,
      BETTER_AUTH_SECRET: preserve(),
      // The Owner: the pinned Admin who alone adds/removes Admins (docs/adr/0006).
      OWNER_EMAIL: preserve(),
      TRUST_PROXY: '1',
      EMAIL_PROVIDER: 'smtp',
      SMTP_HOST: preserve(),
      SMTP_PORT: preserve(),
      SMTP_SECURE: preserve(),
      SMTP_USER: preserve(),
      SMTP_PASSWORD: preserve(),
      EMAIL_FROM: preserve(),
      ADMIN_NOTIFY_EMAIL: preserve(),
      STORAGE_PROVIDER: 's3',
      S3_ENDPOINT: preserve(),
      S3_PUBLIC_URL: preserve(),
      S3_PUBLIC_URL_INCLUDES_BUCKET: preserve(),
      S3_REGION: preserve(),
      S3_BUCKET: preserve(),
      S3_ACCESS_KEY: preserve(),
      S3_SECRET_KEY: preserve(),
      PAYMENT_PROVIDER: preserve(),
      // false until a real provider is integrated: checkout shows "payments coming soon" (docs/adr/0008).
      PAYMENTS_ENABLED: preserve(),
      // Optional error reporting; empty = off.
      SENTRY_DSN: preserve(),
    },
  });

  const client = service('client', {
    source: github(REPO, { branch: BRANCH }),
    build: {
      builder: 'DOCKERFILE',
      dockerfilePath: 'apps/client/Dockerfile',
      watchPatterns: ['apps/client/**', 'packages/shared/**', 'pnpm-lock.yaml', 'package.json'],
    },
    deploy: {
      healthcheckPath: '/robots.txt',
      healthcheckTimeout: 120,
      restartPolicyType: 'ON_FAILURE',
      restartPolicyMaxRetries: 10,
    },
    env: {
      PORT: '3000',
      // Build-time (Dockerfile ARGs) and runtime.
      NEXT_PUBLIC_SITE_URL: SITE_URL_FROM_CLIENT,
      NEXT_PUBLIC_API_URL: '/v1',
      API_INTERNAL_URL: 'http://${{server.RAILWAY_PRIVATE_DOMAIN}}:8000',
      IMAGE_REMOTE_PATTERNS: preserve(),
      NEXT_PUBLIC_CONTACT_EMAIL: preserve(),
      // Optional error reporting; empty = off. Build-time: redeploy after changing.
      NEXT_PUBLIC_SENTRY_DSN: preserve(),
    },
  });

  return project('baia', { resources: [db, server, client] });
});
