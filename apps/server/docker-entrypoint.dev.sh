#!/bin/sh
set -e

echo "==> Generating Prisma client for container platform..."
npx prisma generate

echo "==> Pushing schema to database..."
npx prisma db push --skip-generate

echo "==> Seeding database (idempotent)..."
pnpm run prisma:seed

echo "==> Starting NestJS in debug mode..."
exec pnpm run dev:debug
