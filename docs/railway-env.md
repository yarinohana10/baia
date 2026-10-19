# Environment variables

Every variable BAIA reads, which service it belongs to, and what production needs.
Both apps validate their environment:

- **server** (`apps/server/src/config/env.ts`): parsed once at boot. With `NODE_ENV=production`
  the API refuses to start and prints **one list of every missing/invalid variable**.
- **client** (`apps/client/src/lib/env.ts`): checked by `next build`. A production build fails
  with the full list. `NEXT_PUBLIC_*`, `API_INTERNAL_URL` and `IMAGE_REMOTE_PATTERNS` are read
  **at build time**, so on Railway changing them needs a **redeploy** (a rebuild), not a restart.

Railway reference syntax: `${{Postgres.DATABASE_URL}}` (another service's variable),
`${{server.RAILWAY_PRIVATE_DOMAIN}}`, `${{RAILWAY_PUBLIC_DOMAIN}}` (this service's own domain),
`${{shared.NAME}}` (project shared variable). Never paste secrets into files in the repo.

Legend: **R** = required in production, **R\*** = required in some setups (see notes), O = optional.

## Topology (decides several values)

| Setup | Browser talks to | Session cookie |
|---|---|---|
| **A. Same-origin proxy (default on Railway)** | only the storefront: `https://<client>.up.railway.app` (later `https://baia.co.il`); Next forwards `/v1/*` and `/api/auth/*` to the API on the private network | first-party, host-only on the storefront |
| B. Custom domains, direct | storefront `https://baia.co.il` + API `https://api.baia.co.il` | shared via `AUTH_COOKIE_DOMAIN=.baia.co.il` |

Railway's `*.up.railway.app` is on the Public Suffix List, so two Railway subdomains can never share a
cookie. That is why A is the default. A keeps working after you add a custom domain. B is optional.

## server (NestJS API)

| Variable | Req | Example / Railway value | Description |
|---|---|---|---|
| `NODE_ENV` | R | `production` | Turns on the production checks, secure cookies and HSTS. |
| `PORT` | O | `8000` | Listen port. The proxy target and healthcheck use it. Railway injects `PORT` if you don't set it. Pin it to `8000` so `API_INTERNAL_URL` matches. |
| `DATABASE_URL` | R | `${{Postgres.DATABASE_URL}}` | Postgres connection string (private network). |
| `TRUST_PROXY` | O | `1` | Express `trust proxy` (proxy hops in front of the API), so `req.ip` and the rate limits see the shopper's IP. Defaults to `1` in production. The storefront proxy passes Railway's `X-Forwarded-For` through unchanged, so `1` is right for both A and B. |
| `BODY_LIMIT` | O | `1mb` | Max JSON/form body. Uploads have their own 10 MB limit. |
| `CLIENT_URL` | R | A: `https://${{client.RAILWAY_PUBLIC_DOMAIN}}` · later `https://baia.co.il,https://www.baia.co.il` | Storefront origin(s), comma separated, https only. Used for CORS, the auth trusted origins and links in emails (the first entry). |
| `TRUSTED_ORIGINS` | O | | Extra browser origins for CORS/auth. |
| `BETTER_AUTH_URL` | R | A: same as the storefront origin · B: `https://api.baia.co.il` | The public origin the **browser** uses for `/api/auth` (OAuth callbacks, email links). |
| `BETTER_AUTH_SECRET` | R | *(secret)* `openssl rand -base64 32` | Signs sessions and email tokens. Must be at least 32 characters. Placeholders are rejected. Changing it logs everyone out. |
| `AUTH_COOKIE_PREFIX` | O | `baia` | Cookie name prefix. It must match the client's `NEXT_PUBLIC_AUTH_COOKIE_PREFIX`. |
| `AUTH_COOKIE_DOMAIN` | R\* | B only: `.baia.co.il` | Shares the session between the storefront and API subdomains. A `*.up.railway.app` value is rejected. Leave it empty in setup A. |
| `AUTH_RATE_LIMIT` | O | `true` | better-auth rate limiting (default on). |
| `AUTH_TRUSTED_PROXIES` | O | | Proxy IPs/CIDRs better-auth may strip from a multi-hop `X-Forwarded-For`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | O | *(secret)* | Google sign-in. Set both or neither. Redirect URI: `<BETTER_AUTH_URL>/api/auth/callback/google`. |
| `EMAIL_PROVIDER` | R | `smtp` | `smtp`, or `console` (nothing is delivered; a warning is logged). |
| `SMTP_HOST` | R\* | `smtp.gmail.com` / `smtp.resend.com` | Required when `EMAIL_PROVIDER=smtp`. |
| `SMTP_PORT` | O | `465` | Default `587`. |
| `SMTP_SECURE` | O | `true` | `true` = implicit TLS (465). `false` = STARTTLS (587). |
| `SMTP_USER` | R\* | `baiaswimwear0@gmail.com` / `resend` | SMTP login. |
| `SMTP_PASSWORD` | R\* | *(secret)* Gmail App Password / Resend API key | Required when `SMTP_USER` is set. |
| `EMAIL_FROM` | R | `BAIA Swimwear <baiaswimwear0@gmail.com>` or `BAIA Swimwear <orders@baia.co.il>` | The sender. It must be a sender your provider allows (Gmail: the account itself). Placeholder domains are rejected. |
| `ADMIN_NOTIFY_EMAIL` | O | `baiaswimwear0@gmail.com` | Store inbox for new-order and cancellation alerts. **Admin › Settings › contact email** takes precedence, and customer emails use it as Reply-To. Set that field too. |
| `EMAIL_RETRY_DELAYS_MS` | O | `0,2000,8000` | Retry schedule for failed sends. |
| `STORAGE_PROVIDER` | R | `s3` | Must be `s3` in production (container disks are wiped on every deploy). |
| `S3_ENDPOINT` | R\* | R2: `https://<account-id>.r2.cloudflarestorage.com` | S3 API endpoint. Omit for AWS S3. |
| `S3_REGION` | O | R2: `auto` · AWS: `eu-central-1` | Default `us-east-1`. |
| `S3_BUCKET` | R | `baia-assets` | |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | R | *(secret)* | Bucket-scoped API token (read + write). |
| `S3_PUBLIC_URL` | R | R2 custom domain: `https://images.baia.co.il` | Public base URL the images are served from. Must be https. |
| `S3_PUBLIC_URL_INCLUDES_BUCKET` | O | `false` for R2 public domains / CDNs | `true` (default) gives `<public>/<bucket>/<key>`. `false` gives `<public>/<key>`. |
| `S3_FORCE_PATH_STYLE` | O | | Path-style S3 requests. Detected automatically for localhost. Set `true` for MinIO-like endpoints. |
| `CDN_URL` | O | `https://cdn.baia.co.il` | Overrides `S3_PUBLIC_URL`. |
| `UPLOADS_DIR` | O | | Local storage only (development). |
| `PAYMENT_PROVIDER` | R | — | **There is no real payment provider yet.** `mock` confirms orders **without charging**. Use it only on a demo or staging site. The server logs a warning on every boot. |
| `PAYMENT_WEBHOOK_SECRET` | O | *(secret)* | HMAC secret for provider webhooks, once a real PSP exists. |
| `MOCK_PAYMENT_DELAY_MS` | O | `500` | Mock provider latency. |
| `PAYMENT_INSTALLMENTS_MIN_TOTAL` | O | `300` | Minimum order total (₪) for installments. |
| `PENDING_ORDER_TTL_MINUTES` | O | `60` | Unpaid orders release their stock after this many minutes. `0` disables the sweeper. |
| `ORDER_ACCESS_TOKEN_TTL_DAYS` | O | `30` | Lifetime of guest order-access links. |
| `TRACKING_URL_TEMPLATE` | O | `https://carrier.example/track?n={tracking}` | Carrier link in "shipped" emails. Must contain `{tracking}`. |
| `TRACKING_CARRIER_NAME` | O | | The carrier's display name. |
| `SERVER_URL` | O | | Origin for relative image paths in emails. Defaults to `BETTER_AUTH_URL`. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | O | *(one-off)* | Read only by the admin bootstrap CLI. Do not leave them set on the service. |

## client (Next.js storefront)

| Variable | When | Req | Example / Railway value | Description |
|---|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | build | R | `https://${{RAILWAY_PUBLIC_DOMAIN}}` → later `https://baia.co.il` | Canonical URLs, sitemap, robots, OG tags. In proxy mode it is also the auth origin. |
| `NEXT_PUBLIC_API_URL` | build | R | A: `/v1` · B: `https://api.baia.co.il/v1` | Base URL for browser API calls. `/v1` turns on proxy mode. |
| `NEXT_PUBLIC_AUTH_URL` | build | R\* | A: *(empty, defaults to SITE_URL)* · B: `https://api.baia.co.il` | better-auth client origin. |
| `API_INTERNAL_URL` | build + runtime | R\* (A) | `http://${{server.RAILWAY_PRIVATE_DOMAIN}}:8000` | Proxy target for `/v1/*`, `/api/auth/*` and `/uploads/*`, and the base for server-side fetches (catalogue, admin session check). |
| `API_URL` / `AUTH_URL` | runtime | O | | Overrides for server-side fetches. Normally derived from `API_INTERNAL_URL`. |
| `IMAGE_REMOTE_PATTERNS` | build | O (warning if empty) | `https://images.baia.co.il` | Comma-separated image hosts that `next/image` may optimise. Use the same host as `S3_PUBLIC_URL`. |
| `NEXT_PUBLIC_AUTH_COOKIE_PREFIX` | build | O | `baia` | Must match the server's `AUTH_COOKIE_PREFIX`. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | build | O | `baiaswimwear0@gmail.com` | Fallback contact email when the API is unreachable. |
| `NEXT_PUBLIC_TRACKING_URL_TEMPLATE` | build | O | | Tracking link on order pages. |
| `PORT` | runtime | O | `3000` | |

## Postgres (Railway plugin)

Railway provisions `DATABASE_URL`, `DATABASE_PUBLIC_URL`, `PGHOST`, and the other connection variables.
Reference `${{Postgres.DATABASE_URL}}` from the server.
`DATABASE_PUBLIC_URL` uses the TCP proxy. Use it only for one-off local tools (`pg_dump`), never for the app.

## Copy-paste: Railway, setup A (before the custom domain)

**server**
```
NODE_ENV=production
PORT=8000
DATABASE_URL=${{Postgres.DATABASE_URL}}
CLIENT_URL=https://${{client.RAILWAY_PUBLIC_DOMAIN}}
BETTER_AUTH_URL=https://${{client.RAILWAY_PUBLIC_DOMAIN}}
BETTER_AUTH_SECRET=<openssl rand -base64 32>
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=baiaswimwear0@gmail.com
SMTP_PASSWORD=<16-char Gmail App Password>
EMAIL_FROM=BAIA Swimwear <baiaswimwear0@gmail.com>
ADMIN_NOTIFY_EMAIL=baiaswimwear0@gmail.com
STORAGE_PROVIDER=s3
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=baia-assets
S3_ACCESS_KEY=<R2 token access key>
S3_SECRET_KEY=<R2 token secret>
S3_PUBLIC_URL=https://images.baia.co.il
S3_PUBLIC_URL_INCLUDES_BUCKET=false
PAYMENT_PROVIDER=<decide: see DEPLOYMENT.md "Payments">
```

**client**
```
PORT=3000
NEXT_PUBLIC_SITE_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}
NEXT_PUBLIC_API_URL=/v1
API_INTERNAL_URL=http://${{server.RAILWAY_PRIVATE_DOMAIN}}:8000
IMAGE_REMOTE_PATTERNS=https://images.baia.co.il
NEXT_PUBLIC_CONTACT_EMAIL=baiaswimwear0@gmail.com
```

When `baia.co.il` is attached to the **client** service, replace both `https://${{...RAILWAY_PUBLIC_DOMAIN}}`
values with `https://baia.co.il`. If you also serve `www`, set `CLIENT_URL=https://baia.co.il,https://www.baia.co.il`.
Then redeploy both services.
