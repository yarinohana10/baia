# ADR-0004: Upload Entity and LocalStack S3

## Status

Accepted

## Context

ADR-0003 established a `StorageService` abstraction with `LocalStorageService` as the initial implementation. The project now needs:

1. **S3 storage** for product and category images, usable in both development and production.
2. **An abstract Upload entity** that tracks every file stored in object storage, enabling referential integrity between files and the domain models that use them (products, categories, site config).
3. **LocalStack** as the development S3 provider, so developers can work with real S3 APIs without incurring AWS costs.
4. **Production flexibility** to deploy against any S3-compatible provider (AWS S3, Cloudflare R2, Backblaze B2, MinIO).

### Alternatives Considered

1. **Store S3 keys directly on ProductImage/Category** — simpler, but duplicates storage metadata across tables and makes it harder to track/audit uploads or support future file types (invoices, exports, etc.).

2. **Use a generic file service without a DB entity** — upload/delete via S3 only, no DB tracking. Loses the ability to query uploads, audit who uploaded what, or cascade-delete orphaned files.

3. **Abstract Upload entity as single source of truth** — a dedicated `Upload` table that all domain models reference via foreign key. Centralizes file metadata, enables audit trails, and supports any future file type without schema changes.

## Decision

Implement option 3: a dedicated `Upload` model in Prisma that serves as the single source of truth for all files stored in object storage.

### Upload Model

```prisma
model Upload {
  id         String   @id @default(cuid())
  s3Key      String   @unique
  s3Bucket   String
  mimeType   String
  sizeBytes  Int
  fileName   String
  uploadedBy String?
  createdAt  DateTime @default(now())
  @@map("uploads")
}
```

### S3 Key Structure

- Products: `products/{productId}/{uploadId}.{ext}`
- Categories: `categories/{categoryId}/{uploadId}.{ext}`
- Site assets: `site/{uploadId}.{ext}`

### References

- `ProductImage.uploadId` → `Upload.id` (nullable for backward compatibility with legacy seed data)
- `Category.imageUploadId` → `Upload.id`
- `SiteConfig.heroImageUploadId` → `Upload.id`

### Storage Provider Selection

The `STORAGE_PROVIDER` environment variable selects the implementation:
- `s3` → `S3StorageService` using `@aws-sdk/client-s3`
- `local` → `LocalStorageService` (legacy, filesystem)

### LocalStack for Development

LocalStack runs as a Docker service providing S3 at `localhost:4566`. An init script creates the `baia-assets` bucket on startup. The server connects to LocalStack using standard AWS SDK configuration with a custom endpoint.

### Production Deployment

In production, the same `S3StorageService` connects to any S3-compatible provider. Only environment variables change (endpoint, credentials, bucket name). No code changes required.

## Consequences

- All new file uploads create an `Upload` record and store the file in S3.
- Existing images (seeded from `public/` folder) need a one-time migration script to move into S3 and create corresponding `Upload` records.
- The `ProductImage.url` field is retained for backward compatibility but new images use `uploadId`.
- Image URLs are resolved at query time: if `uploadId` exists, the URL comes from `StorageService.getUrl(upload.s3Key)`; otherwise, the legacy `url` field is used.
- Adding new file types in the future (e.g., invoice PDFs, export CSVs) only requires adding a new relation to `Upload` — no storage layer changes needed.
- LocalStack adds ~200MB to the Docker dev environment but provides a realistic S3 experience.
- The `Upload` table enables future features: upload quotas, virus scanning hooks, CDN invalidation tracking.
