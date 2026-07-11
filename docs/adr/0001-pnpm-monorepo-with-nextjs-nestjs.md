# ADR-0001: pnpm Monorepo with Next.js + NestJS

## Status

Accepted

## Context

We are building a swimwear e-commerce platform (Baia Swimwear) from scratch. The system requires a web storefront with server-side rendering, an API backend with authentication and payment orchestration, and shared type definitions between the two.

The team has prior experience with this exact stack from the Rite Brain project, which uses a pnpm monorepo with Next.js (platform) and NestJS (brain-api), sharing Zod DTOs via a common library.

### Alternatives considered

1. **Separate repositories** — client and server as independent repos. Simpler CI but painful to keep shared types in sync. No atomic changes across frontend and backend.

2. **Full-stack Next.js (API Routes only)** — no separate backend. Simpler architecture but limited: no WebSocket support for real-time order notifications, harder to structure complex business logic (payment orchestration, inventory management), and couples deployment scaling.

3. **pnpm monorepo with Next.js + NestJS** — shared types, atomic PRs, familiar patterns from Brain. More initial setup but pays off immediately.

## Decision

Use a **pnpm workspace monorepo** with the structure:

```
gil-project/
├── apps/client/     (Next.js)
├── apps/server/     (NestJS)
├── packages/shared/ (Zod schemas + types)
```

Key technology choices locked to this decision:
- **Package manager:** pnpm (workspace protocol for local packages)
- **Frontend:** Next.js App Router, React, Tailwind v4, shadcn/ui, TanStack Query, Zustand, next-intl
- **Backend:** NestJS, Prisma ORM, PostgreSQL, better-auth, Zod validation
- **Deployment:** Docker Compose (multi-service)

## Consequences

- Shared Zod schemas ensure type safety across the API boundary without code generation.
- Single `docker-compose.yml` can orchestrate all services for local dev and production.
- Developers must understand pnpm workspace protocol and monorepo conventions.
- CI/CD must handle selective builds (only rebuild what changed).
