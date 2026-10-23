# Product images live in a public Cloudflare R2 bucket, not Railway Buckets

Images are stored in Cloudflare R2 and served through a public custom domain (`images.<domain>`). The server talks to it through the S3-compatible API (`S3_ENDPOINT`, `S3_PUBLIC_URL`, `S3_PUBLIC_URL_INCLUDES_BUCKET=false`), so the storage layer from ADR-0004 is unchanged.

Railway Buckets were rejected because they are private-only: every image would need a presigned URL or a proxy through the API, which breaks `next/image` caching and puts image bandwidth on the API. R2 has no egress fees, a free public custom domain behind Cloudflare's CDN, and is not tied to the app host.

Consequences: everything in the image bucket is world-readable, so it must hold only catalogue images. Database backups go to a **separate private bucket** (`BACKUP_S3_BUCKET`), and `scripts/backup-db.sh` refuses to use the image bucket. The image host must also be listed in the storefront's `IMAGE_REMOTE_PATTERNS` (build-time).
