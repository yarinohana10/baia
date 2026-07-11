FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @baia/server... --prod=false

# Build
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .
WORKDIR /app/apps/server
RUN npx prisma generate
RUN pnpm run build

# Production
FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs

COPY --from=build /app/apps/server/dist ./dist
COPY --from=build /app/apps/server/node_modules ./node_modules
COPY --from=build /app/apps/server/prisma ./prisma
COPY --from=build /app/apps/server/src/generated ./src/generated
COPY --from=build /app/apps/server/package.json ./

RUN mkdir -p /app/uploads && chown nestjs:nodejs /app/uploads
USER nestjs

EXPOSE 8000
ENV NODE_ENV=production
ENV PORT=8000

CMD ["node", "dist/main.js"]
