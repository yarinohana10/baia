# syntax=docker/dockerfile:1
# Production image for the Next.js storefront (standalone output).
# Build context: repository root.   docker build -f apps/client/Dockerfile .
ARG NODE_IMAGE=node:24-alpine

FROM ${NODE_IMAGE} AS base
RUN apk add --no-cache libc6-compat \
  && corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app
ENV PNPM_HOME=/pnpm CI=true NEXT_TELEMETRY_DISABLED=1

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/client/package.json apps/client/
COPY packages/shared/package.json packages/shared/
RUN \
  pnpm install --frozen-lockfile --filter @baia/client...
COPY packages/shared ./packages/shared
COPY apps/client ./apps/client

# Build-time configuration. NEXT_PUBLIC_* are inlined into the browser bundle
# and the API proxy rewrites (API_INTERNAL_URL) and image hosts are baked into
# the build manifest, so all of these must be present at build time. Railway
# passes service variables to Dockerfile ARGs automatically.
# `next build` validates them (src/lib/env.ts) and fails with a full list.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_AUTH_URL
ARG NEXT_PUBLIC_AUTH_COOKIE_PREFIX
ARG NEXT_PUBLIC_TRACKING_URL_TEMPLATE
ARG NEXT_PUBLIC_CONTACT_EMAIL
ARG API_INTERNAL_URL
ARG IMAGE_REMOTE_PATTERNS
# Logo in the assets bucket; also read at runtime, here so prerendered pages use it.
ARG LOGO_URL
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT
# Set by Railway; becomes the release name on error reports.
ARG RAILWAY_GIT_COMMIT_SHA
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
  NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
  NEXT_PUBLIC_AUTH_URL=$NEXT_PUBLIC_AUTH_URL \
  NEXT_PUBLIC_AUTH_COOKIE_PREFIX=$NEXT_PUBLIC_AUTH_COOKIE_PREFIX \
  NEXT_PUBLIC_TRACKING_URL_TEMPLATE=$NEXT_PUBLIC_TRACKING_URL_TEMPLATE \
  NEXT_PUBLIC_CONTACT_EMAIL=$NEXT_PUBLIC_CONTACT_EMAIL \
  API_INTERNAL_URL=$API_INTERNAL_URL \
  IMAGE_REMOTE_PATTERNS=$IMAGE_REMOTE_PATTERNS \
  LOGO_URL=$LOGO_URL \
  NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
  NEXT_PUBLIC_SENTRY_ENVIRONMENT=$NEXT_PUBLIC_SENTRY_ENVIRONMENT \
  RAILWAY_GIT_COMMIT_SHA=$RAILWAY_GIT_COMMIT_SHA

WORKDIR /app/apps/client
RUN pnpm run build

FROM ${NODE_IMAGE} AS runner
RUN apk add --no-cache tini
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1

COPY --from=build --chown=node:node /app/apps/client/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/client/.next/static ./apps/client/.next/static
COPY --from=build --chown=node:node /app/apps/client/public ./apps/client/public

USER node
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/client/server.js"]
