# syntax=docker/dockerfile:1
# Production image for the NestJS API (Railway / any Docker host).
# Build context: repository root.   docker build -f apps/server/Dockerfile .
#
# Node 24 LTS matches CI (Jest needs native require(esm) for better-auth).
ARG NODE_IMAGE=node:24-alpine

FROM ${NODE_IMAGE} AS base
# openssl: Prisma engines need libssl on Alpine.
RUN apk add --no-cache openssl \
  && corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app
ENV PNPM_HOME=/pnpm CI=true

# ── Build: full install, prisma generate, nest build, shared -> CJS ─────────────
FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile --filter @baia/server...
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server
WORKDIR /app/apps/server
# dist/ requires ../generated/prisma: ship the real generated client (with its
# native query engine + schema) instead of swc's partial transpile of it.
RUN pnpm exec prisma generate \
  && pnpm run build \
  && rm -rf dist/generated && cp -r src/generated dist/generated
# @baia/shared is consumed as TypeScript source in dev; compile it to CommonJS
# so `require('@baia/shared')` works in plain Node at runtime.
WORKDIR /app/packages/shared
RUN pnpm exec tsc -p tsconfig.json --module commonjs --moduleResolution node --declaration false --outDir dist \
  && node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.main='./dist/index.js';fs.writeFileSync('package.json',JSON.stringify(p,null,2))"

# ── Production dependencies only ────────────────────────────────────────────────
FROM base AS prod-deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile --prod --filter @baia/server...

# ── Runtime ─────────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS runner
RUN apk add --no-cache openssl tini
WORKDIR /app
ENV NODE_ENV=production PORT=8000

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=prod-deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/server/package.json ./apps/server/package.json
COPY --from=build /app/apps/server/prisma ./apps/server/prisma
COPY --from=build /app/apps/server/dist ./apps/server/dist

WORKDIR /app/apps/server
# Only used by STORAGE_PROVIDER=local (development); production must use S3.
RUN mkdir -p uploads && chown -R node:node uploads
USER node

EXPOSE 8000
# tini forwards SIGTERM so Nest's shutdown hooks run on redeploy.
ENTRYPOINT ["/sbin/tini", "--"]
# Migrations are NOT run on start: Railway runs `prisma migrate deploy` as the
# pre-deploy command (see .railway/railway.ts and docs/DEPLOYMENT.md).
CMD ["node", "dist/main.js"]
