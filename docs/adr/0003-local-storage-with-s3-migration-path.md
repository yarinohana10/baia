# ADR-0003: Local Storage with S3 Migration Path

## Status

Accepted

## Context

Product images need to be stored and served to customers. The Brain project uses AWS S3 + CloudFront, but Baia Swimwear is a personal project where cost must be minimized. S3 storage and CloudFront bandwidth have ongoing costs that aren't justified until the store has meaningful traffic.

### Alternatives considered

1. **S3 + CloudFront from day one** — proven pattern from Brain, globally fast via CDN. But costs money from the start with potentially zero customers.

2. **Next.js public/ folder** — zero-cost static hosting. But images can't be uploaded dynamically via admin panel; requires redeployment for every new product.

3. **Local filesystem with abstraction** — images stored on the VPS disk, served via NestJS static file route. A `StorageService` interface allows swapping to S3 without code changes when traffic justifies the cost.

4. **Cloudinary / Uploadthing** — managed service with free tier. Adds external dependency and potential vendor lock-in for a simple use case.

## Decision

Use a **StorageService abstraction** with `LocalStorageService` as the initial implementation:

```typescript
interface StorageService {
  upload(file: Buffer, key: string): Promise<string>;
  delete(key: string): Promise<void>;
  getUrl(key: string): string;
}
```

Files are stored in an `/uploads/` directory on the server, persisted via a Docker volume. NestJS serves them via a static file route (e.g., `/uploads/products/{productId}/{color}/{filename}`).

When traffic justifies it, implement `S3StorageService` and switch via environment variable (`STORAGE_PROVIDER=local|s3`).

## Consequences

- Zero additional cost for image hosting at launch.
- Admin can upload images dynamically — no redeployment needed.
- Docker volume ensures images persist across container restarts.
- Image serving performance is limited to the VPS bandwidth (no CDN). Acceptable for low traffic.
- Migration to S3 requires implementing one interface + running a one-time migration script to move existing files.
- Backup strategy for uploads volume must be considered (VPS snapshots or periodic sync to cloud storage).
