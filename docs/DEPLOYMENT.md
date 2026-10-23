# Deploying BAIA to Railway

A runbook for a first production deploy, and for every deploy after it. The environment variable
reference is in [`railway-env.md`](./railway-env.md). Read the **Launch checklist** at the end
before sending real customers to the site.

```
                        Railway project "baia"
 browser ──https──▶ client (Next.js, public domain)   ─┐  /v1/*, /api/auth/*, /uploads/*
                     • SSR + ISR pages                 │  rewritten over the PRIVATE network
                     • same-origin proxy to the API    ▼
                                                     server (NestJS, no public domain)
                                                      • /v1/health  (healthcheck, checks DB)
                                                      • pre-deploy: prisma migrate deploy
                                                      • pending-order sweeper (in-process)
                                                       │            │             │
                                                   Postgres     S3 bucket       SMTP
                                                   (plugin)  (Cloudflare R2)  (Resend/Gmail)
                                                       ▲
                                              backup (Cron service, nightly pg_dump -> private R2 bucket)
```

Why a proxy: Railway's default domains (`*.up.railway.app`) are on the Public Suffix List, so a
cookie set by `server.up.railway.app` can never be read on `client.up.railway.app`. The Next.js
middleware and the admin layout need the session cookie. With the proxy, the browser only talks to
the storefront origin, so the cookie is first-party and host-only. This also works unchanged on
`baia.co.il`.

---

## 0. Prerequisites

- Owner access to the GitHub repo `yarinohana10/baia` and a Railway account on the Hobby or Pro plan.
  Pro adds Postgres backups and more resources.
- An S3-compatible bucket for product images. Cloudflare R2 is recommended (no egress fees, free
  custom domain). Railway Buckets are **private only** (presigned URLs). They can't serve public
  product photos without an extra proxy service, so don't use them for images.
- An email sender (§7).
- A decision on payments (§9). Today **only a mock provider exists**.

## 1. Create the project and database

1. Railway → **New Project** → **Deploy PostgreSQL**. Name the service `Postgres`.
2. **+ New** → **GitHub Repo** → `yarinohana10/baia` → name the service **`server`**.
3. **+ New** → **GitHub Repo** → the same repo → name it **`client`**.
   The names matter, because variables reference `${{server.…}}` and `${{client.…}}`.

### Service settings (dashboard)

Railway's Infrastructure-as-Code file [`.railway/railway.ts`](../.railway/railway.ts) describes the
same settings. You can apply it with `npx -y @railway/cli@latest config plan` and then
`config apply`. `railway.json` / `railway.toml` are deprecated: Railway stops reading them on
2026-12-01 and new services can't opt in, so this repo doesn't use them. If you prefer the
dashboard, set:

| Setting | server | client |
|---|---|---|
| Source → Root directory | *(empty: repo root; the Dockerfiles need `packages/shared`)* | *(empty)* |
| Build → Builder | Dockerfile | Dockerfile |
| Build → Dockerfile path (or variable `RAILWAY_DOCKERFILE_PATH`) | `apps/server/Dockerfile` | `apps/client/Dockerfile` |
| Build → Watch paths | `apps/server/**`, `packages/shared/**`, `pnpm-lock.yaml`, `package.json` | `apps/client/**`, `packages/shared/**`, `pnpm-lock.yaml`, `package.json` |
| Deploy → Pre-deploy command | `node_modules/.bin/prisma migrate deploy` | — |
| Deploy → Healthcheck path | `/v1/health` | `/robots.txt` |
| Deploy → Healthcheck timeout | 120 s | 120 s |
| Deploy → Restart policy | On failure, 10 retries | On failure, 10 retries |
| Deploy → Replicas | **1** (see §10) | 1+ |
| Networking → Public domain | **none** (private only) | Generate domain, target port **3000** |

The server image's working directory is `/app/apps/server`, so the pre-deploy command runs from there.

## 2. Variables

Set the variables from the copy-paste block in [`railway-env.md`](./railway-env.md#copy-paste-railway-setup-a-before-the-custom-domain).
Secrets (`BETTER_AUTH_SECRET`, `SMTP_PASSWORD`, `S3_SECRET_KEY`, `BACKUP_S3_SECRET_KEY`) go in **Variables** in the
dashboard and nowhere else. Generate the auth secret locally:

```bash
openssl rand -base64 32
```

Railway passes service variables to Docker builds as build args. The client Dockerfile declares
`NEXT_PUBLIC_*`, `API_INTERNAL_URL` and `IMAGE_REMOTE_PATTERNS` as `ARG`s, so they're baked in at
build time. **After changing any of them, redeploy the client** (a restart is not enough).

Both services validate their environment. If a variable is missing:
- **server:** the deploy fails its healthcheck. The deploy log starts with
  `[config] Invalid environment configuration (N problems):` followed by the full list.
- **client:** the build fails with `Invalid storefront environment (N problems):`.

## 3. Private networking

- The client reaches the API at `http://${{server.RAILWAY_PRIVATE_DOMAIN}}:8000`
  (`API_INTERNAL_URL`). Nest listens on `::`, which covers IPv4 and IPv6, as Railway's private
  network needs.
- Give the server **no public domain**. Everything goes through the storefront. If you want a
  public API for debugging, generate one temporarily and remove it afterwards.
- Client IPs: Railway's edge sets `X-Forwarded-For`. The storefront proxy passes it through
  unchanged and forwards it on server-side session checks. The API trusts one proxy hop
  (`TRUST_PROXY=1`), so per-IP rate limits apply to the real shopper.

## 4. Database migrations

The schema is managed by **Prisma Migrate** (`apps/server/prisma/migrations`). The first migration,
`20261020000000_init`, is a baseline of the full schema.

- **Production:** the pre-deploy command runs `prisma migrate deploy` on every deploy, before
  traffic switches over. If a migration fails, the deploy stops and the old version keeps serving.
- **New schema change (developers):**
  ```bash
  pnpm --filter @baia/server prisma:migrate:dev --name add_something   # creates + applies a migration
  ```
  Commit the generated folder. CI fails if `schema.prisma` and the migrations drift apart.
  Tests still use `prisma db push` on throwaway `_test` databases.
- **Existing databases created with `db push`** (your local `baia`, `baia_review`, …) must be
  *baselined* once, or `migrate deploy` / `migrate dev` will refuse (P3005: schema not empty):
  ```bash
  cd apps/server
  export DATABASE_URL='postgresql://baia:baia@localhost:5433/baia?schema=public'
  # 1) Must print "No difference detected." (if not, run `pnpm prisma:push` first)
  pnpm exec prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma
  # 2) Mark the baseline as already applied (writes one row to _prisma_migrations; no DDL)
  pnpm exec prisma migrate resolve --applied 20261020000000_init
  pnpm exec prisma migrate status
  ```
  A fresh production database needs nothing: `migrate deploy` creates everything.
- Write migrations that **expand, then contract**: add columns as nullable or with a default, and
  drop them in a later release. That way a rollback (§13) can still run the previous code
  against the new schema.

## 5. First deploy, first admin, seed policy

1. Push to `main` (or click **Deploy**). For the full non-developer walkthrough, see [`GO-LIVE.md`](./GO-LIVE.md). Watch the server's deploy log: you should see the
   pre-deploy migration, then `Baia API listening on port 8000 (production)`.
2. Open `https://<client-domain>/v1/health`. It should return `{"status":"ok",…,"checks":{"database":"ok"}}`.
3. **Owner bootstrap.** There is no seeded or default admin. Set `OWNER_EMAIL` (the owner's own
   address) on the server, then open the live site, **register that exact address** and click the
   verification link in the email. The account becomes Admin automatically (on verification, and again
   on every boot). From **Admin › Admins** the Owner adds the other people (for example
   `baiaswimwear0@gmail.com`): an existing account is promoted at once, an address without an account
   gets an *Admin Invitation* that takes effect when that person registers and verifies the same email.
   Only the Owner can add or remove Admins, and deploys never demote anyone (ADR-0006).
   *Emergency only* (for example the Owner lost the mailbox): the compiled CLI can still promote or
   create an account from a shell inside the server container:
   ```bash
   npx -y @railway/cli@latest link
   npx -y @railway/cli@latest ssh --service server
   read -s ADMIN_PASSWORD && export ADMIN_PASSWORD
   node dist/cli/create-admin.js --email <address> --name "BAIA"; unset ADMIN_PASSWORD; exit
   ```
4. **Seed policy:** do **not** run `prisma:seed` against production. It creates demo categories and
   products, and it isn't in the production image. Create the real catalogue in **/he/admin**.
5. In **Admin › Settings**, fill in the business details: legal name, ח.פ./ע.מ., address, phone, and
   **contact email** (`baiaswimwear0@gmail.com`). The contact email receives new-order alerts and
   is the Reply-To on customer emails. Until it's set, the schema default address
   (`baiaswimwear0@gmail.com`) is shown. Every placeholder to replace is listed in
   [`GO-LIVE.md`](./GO-LIVE.md#step-9-replace-every-placeholder-in-admin-settings).

## 6. Custom domain (`baia.co.il`) and DNS

1. Client service → Settings → Networking → **Custom Domain** → `baia.co.il` (and `www.baia.co.il`).
2. At your DNS provider, add the records Railway shows: a CNAME, or ALIAS/flattened CNAME for the
   apex, plus the `_railway-verify` TXT record if asked. Railway issues TLS automatically.
3. Update the variables (see the end of `railway-env.md`): `NEXT_PUBLIC_SITE_URL`, `CLIENT_URL` and
   `BETTER_AUTH_URL` become `https://baia.co.il`. Redeploy **both** services.
4. Redirect `www` → apex, or apex → `www`, with your DNS/CDN redirect rule, so there's one canonical host.
5. If you use Google sign-in, add `https://baia.co.il/api/auth/callback/google` to the OAuth client.

**Alternative (setup B): a separate API subdomain.** Give the server a custom domain
`api.baia.co.il` and set:
- server: `BETTER_AUTH_URL=https://api.baia.co.il`, `AUTH_COOKIE_DOMAIN=.baia.co.il`
- client: `NEXT_PUBLIC_API_URL=https://api.baia.co.il/v1`, `NEXT_PUBLIC_AUTH_URL=https://api.baia.co.il`,
  and remove `API_INTERNAL_URL`, or keep it so SSR uses the private network.

This only works with your own domain, never with `*.up.railway.app`. The proxy setup (A) is simpler
and has no CORS. Prefer it unless you need a public API.

## 7. Email

The API sends transactional email over SMTP: welcome and verification, password reset, order
confirmation, shipping updates, cancellations and admin alerts. Choose one option.

### (a) Quick start: Gmail SMTP with an App Password

1. On the Google account `baiaswimwear0@gmail.com`, turn on **2-Step Verification**. App passwords
   require it.
2. Google Account → Security → **App passwords** → create one named "BAIA Railway". Copy the
   16-character password **straight into Railway's `SMTP_PASSWORD`**. Never put it in a file or chat.
3. Server variables:
   ```
   EMAIL_PROVIDER=smtp
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=baiaswimwear0@gmail.com
   SMTP_PASSWORD=<app password>
   EMAIL_FROM=BAIA Swimwear <baiaswimwear0@gmail.com>
   ```
Limits: about **500 recipients per day**. `From` **must be the Gmail address** (Gmail rewrites
anything else). Gmail senders get lower inbox placement than a domain with SPF/DKIM. This is fine
for launch week, but don't plan to stay on it.

### (b) Recommended for production: your own domain with Resend (or Postmark)

1. Buy or use `baia.co.il`. In Resend or Postmark, add the domain and create the DNS records they
   show you:
   - **SPF:** a TXT record on the sending (sub)domain, e.g. `v=spf1 include:<provider> ~all`. Use
     only one SPF record per name.
   - **DKIM:** the TXT/CNAME records from the provider.
   - **DMARC:** TXT `_dmarc.baia.co.il` → `v=DMARC1; p=none; rua=mailto:baiaswimwear0@gmail.com`.
     After a few clean weeks, tighten it to `p=quarantine`.
   - Return-Path/bounce CNAME, if the provider offers one.
2. Server variables, Resend example (Postmark: `smtp.postmarkapp.com`, user and password = server token):
   ```
   SMTP_HOST=smtp.resend.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=resend
   SMTP_PASSWORD=<Resend API key>
   EMAIL_FROM=BAIA Swimwear <orders@baia.co.il>
   ```
3. Replies: customer emails carry **Reply-To = Admin › Settings › contact email**. Set it to
   `baiaswimwear0@gmail.com` so replies to `orders@` land in the Gmail inbox.

Resend's free plan allows **100 emails/day and 3,000/month** (checked on resend.com/pricing). One
order sends a customer email and an admin alert, plus welcome/verification emails, so a very busy
day can hit the daily cap: upgrade before a campaign. The click-by-click setup is in
[`GO-LIVE.md`](./GO-LIVE.md). Resend shows delivery status in its dashboard, not in SMTP logs.

Test: sign up with a real address and place a test order on staging. Then check the Gmail headers
(“Show original”) for `SPF: PASS`, `DKIM: PASS` and `DMARC: PASS`.

## 8. Product images: S3 bucket (Cloudflare R2)

1. Cloudflare → R2 → **Create bucket** `baia-assets`, with a location hint near Europe.
2. Bucket → Settings → **Public access** → **Connect custom domain** `images.baia.co.il`. Cloudflare
   creates the DNS record and TLS certificate. The `r2.dev` URL is rate-limited and meant for
   development only.
3. R2 → **Manage API tokens** → create a token with **Object Read & Write** on this bucket only.
   Put its keys in `S3_ACCESS_KEY` / `S3_SECRET_KEY`. The server never creates buckets in production
   and a failing bucket check at boot only logs an error (it does not block the deploy); a wrong
   bucket or key shows up as a failed upload in Admin.
4. Server: `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`, `S3_REGION=auto`,
   `S3_BUCKET=baia-assets`, `S3_PUBLIC_URL=https://images.baia.co.il`,
   `S3_PUBLIC_URL_INCLUDES_BUCKET=false`. Client: `IMAGE_REMOTE_PATTERNS=https://images.baia.co.il`.
5. **CORS:** not needed. Uploads go browser → storefront → API → bucket, all server-side. Images
   are loaded through `next/image` and `<img>`, which don't use CORS. Add a GET-only CORS rule for
   your site origin only if you later upload straight from the browser with presigned URLs.
6. **Public read policy (AWS S3 instead of R2):** turn off "Block public access" for the bucket
   (or front it with CloudFront and an OAC, then set `CDN_URL`). Add a bucket policy allowing
   `s3:GetObject` on `arn:aws:s3:::baia-assets/*` for `"Principal": "*"`. Grant the app's IAM user
   only `s3:PutObject`, `s3:DeleteObject`, `s3:GetObject` and `s3:ListBucket` on that bucket.

**Every object in this bucket is public.** Keep database backups in a separate private bucket (§11).
Uploads are checked by their real content (magic bytes: jpeg, png, webp, avif, gif), not only the
browser's declared type. **`IMAGE_REMOTE_PATTERNS` must contain the exact host of `S3_PUBLIC_URL`**
(or `CDN_URL`), for example `https://images.baia.co.il`; otherwise `next/image` refuses the photos.
It is a build-time variable, so redeploy the client after changing it.

Uploads go to S3 **only**. `STORAGE_PROVIDER=local` is rejected in production because Railway
containers are rebuilt on every deploy and the files would be lost.

## 9. Payments: held until a provider exists

Only `MockPaymentProvider` exists. With `PAYMENT_PROVIDER=mock`, every "payment" succeeds
**without charging anything**. Production therefore runs with `PAYMENT_PROVIDER=mock` and
**`PAYMENTS_ENABLED=false`** (ADR-0008): the shop is browsable, the checkout says "Payments coming
soon", and the API refuses to create orders or payments (HTTP 403 `PAYMENTS_DISABLED`). The server logs
a warning at boot while `mock` is used in production.

To take real money, integrate an Israeli payment provider (e.g. Cardcom, Tranzila, Meshulam/Grow,
PayPlus, Hyp): implement `PaymentProvider` (`charge()` / `refund()`) and a `WebhookVerifier` (see
`docs/adr/0002`), register the provider in `payment-provider.factory.ts`, then set
`PAYMENT_PROVIDER=<name>`, `PAYMENT_WEBHOOK_SECRET` and finally `PAYMENTS_ENABLED=true`. Refunds are
manual until then (Refund Pending, ADR-0007). **Never set `PAYMENTS_ENABLED=true` together with
`PAYMENT_PROVIDER=mock` on the public site.**

## 10. Background work and scaling

- The **pending-order sweeper** runs inside the API process every 5 minutes. It cancels orders
  unpaid for `PENDING_ORDER_TTL_MINUTES` (default 60) and returns their stock. Each order is claimed
  with a conditional update, so two instances can't release the same order twice.
- **Keep the server at 1 replica.** Rate limits (sign-in, coupons, contact, payment) are counted in
  memory per process: with N replicas the effective limits are N times higher. Move the counters
  to Redis before scaling out. The client (Next.js) is stateless apart from its ISR cache, and can
  run more replicas, but each replica keeps its own page cache.
- Graceful shutdown: on redeploy Railway sends SIGTERM. `tini` forwards it, and Nest's shutdown
  hooks stop the sweeper and close the Prisma connections.

## 11. Backups

Use **both** of the first two options, and test a restore once.

**Option A: Railway's built-in volume backups (Postgres service → Backups tab).** Schedules are
daily (kept 6 days), weekly (kept 27 days) and monthly (kept 89 days), plus manual backups. Restore
puts the data on a new volume that you review and **Deploy**; it works only inside the same project
and environment, and wiping the volume deletes its backups (docs.railway.com/reference/backups,
checked 2026-10). Which Railway plans include backups was not stated there: verify on your plan.

**Option B: off-platform nightly dump (`scripts/backup-db.sh`).** `pg_dump` (custom format) → gzip →
a **private** R2 bucket under `backups/`, then prunes to 14 daily + 8 weekly copies. It exits non-zero
on any failure (dump unreadable, upload or size mismatch, wrong bucket), so Railway shows the run as
failed. **Use a separate private bucket (`BACKUP_S3_BUCKET`)**: the image bucket is public, and the
script refuses to run against it. Setup as a Railway Cron service:

1. In the project: **+ New → GitHub Repo** → same repo → name it `backup`.
2. Settings → Build: Builder Dockerfile, Dockerfile path `scripts/backup/Dockerfile`, root directory
   empty, watch paths `scripts/backup/**`, `scripts/backup-db.sh`. If your Postgres is not version 17,
   add the build variable `PG_VERSION` (must be at least the server's major version).
3. Settings → **Cron Schedule**: `0 1 * * *` (daily at 01:00 UTC; Railway cron is UTC, minimum
   every 5 minutes, and the process must exit when done: it does). Remove any public domain.
4. Variables: see the `backup` table in `railway-env.md`. Run once manually and read the log (it should end with
   `done`). `BACKUP_DRY_RUN=true` checks the dump without uploading.

The cron service is not in `.railway/railway.ts` (whether the IaC supports a cron schedule could
not be confirmed), so create it in the dashboard.

**Restore procedure** (tested locally against Postgres 16 and an S3 endpoint):

```bash
# 1. Download the newest dump (R2 dashboard → bucket → backups/ → Download), or with the AWS CLI:
aws --endpoint-url https://<account-id>.r2.cloudflarestorage.com s3 cp \
  s3://baia-backups/backups/baia-YYYYMMDDTHHMMSSZ.dump.gz .
gunzip baia-YYYYMMDDTHHMMSSZ.dump.gz
# 2. Restore into a NEW scratch database first and look at it:
createdb -h <host> -U <user> baia_restore
pg_restore --no-owner --no-privileges --exit-on-error -h <host> -U <user> -d baia_restore baia-YYYYMMDDTHHMMSSZ.dump
psql -h <host> -U <user> -d baia_restore -c 'select count(*) from orders'
# 3. Real disaster only: restore into an empty production database. Point `DATABASE_URL` of a
#    one-off at the Postgres TCP proxy (DATABASE_PUBLIC_URL), run the same pg_restore, then
#    `prisma migrate status` (should be up to date), and redeploy the server.
```

Never restore over a live database that still has data. A schema-only error in `pg_restore` with
`--exit-on-error` means the target was not empty.

**Option C: manual dump from your computer:** `pg_dump --format=custom --no-owner "$DATABASE_PUBLIC_URL" > baia-$(date +%F).dump`.

Product images live in R2. Turn on R2 object versioning or a lifecycle rule if you want undelete.

## 12. Monitoring and logs

- **Logs:** Railway → service → *Deployments* / *Observability*. The API logs config warnings at
  boot (e.g. mock payments), email send failures (also recorded in **Admin › Orders › Emails**) and
  sweeper activity.
- **Healthchecks:** `/v1/health` returns 503 when Postgres is unreachable. Railway only uses
  healthchecks during deploys, so add an external **uptime monitor** (UptimeRobot, Better Stack)
  on `https://baia.co.il/v1/health` and `https://baia.co.il/he`, with alerts to your phone or email.
- **Error tracking (Sentry, free tier, optional):** create two Sentry projects (Node.js for the API,
  Next.js/browser for the storefront), put their DSNs into `SENTRY_DSN` (server) and
  `NEXT_PUBLIC_SENTRY_DSN` (client, build-time: redeploy). Without the variables nothing runs. The API
  reports 5xx responses and crashes; the storefront reports render errors and uncaught browser
  errors. Events are scrubbed of emails, phone numbers, addresses, names, cookies, authorization
  headers, tokens and URL query strings before leaving the server/browser, and carry the Railway
  commit SHA as the release. It is a small built-in reporter (no Sentry SDK, no source-map upload),
  so stack traces show built file names. Reports are rate-limited (20/minute, repeats dropped).
  A crash that kills the process may not be delivered; Railway logs remain the source of truth.
- Usage alerts: Railway → Settings → Usage → set a spending limit or alert.

## 13. Rollback

- **Code:** Railway → service → Deployments → pick the last good deployment → **Redeploy**
  (or ⋮ → Rollback). It redeploys that image as it was built.
- **Database:** migrations only move forward. With expand/contract migrations (§4) the previous
  code still runs against the newer schema. If a migration itself broke data, restore the backup
  taken before the deploy (§11). Then mark the bad migration as rolled back with
  `prisma migrate resolve --rolled-back <name>`, from `railway ssh`, before redeploying a fix.
- **Config:** a bad variable fails validation, so the deploy fails while the old one keeps running.
  Fix the variable and redeploy.

## 14. Local production simulation

`docker-compose.railway-sim.yml` runs the **same images** in the same topology: the storefront
proxies to an unpublished API; Postgres and LocalStack S3 (public-read bucket created by
`scripts/localstack-init.sh`) run in the project, and email goes to the dev Mailpit by default.

```bash
cp .env.railsim.example .env.railsim        # git-ignored; edit OWNER_EMAIL etc.
R="docker compose -p baia-railsim --env-file .env.railsim -f docker-compose.railway-sim.yml"
$R up -d --build postgres s3
$R run --rm migrate       # = pre-deploy
$R up -d server client
open http://localhost:3070        # register OWNER_EMAIL, verify via Mailpit http://localhost:8025
$R down -v                 # removes only this project
```

**Real email in the simulation (Resend):** uncomment the Resend block in `.env.railsim`
(`SMTP_HOST=smtp.resend.com`, port 465, secure, user `resend`, `RESEND_API_KEY=...`, and an
`EMAIL_FROM` on your verified domain). The key lives only in that git-ignored file; use a
throwaway key. Delete `.env.railsim` or comment the block to return to Mailpit.

It uses `PAYMENT_PROVIDER=mock` with `PAYMENTS_ENABLED=true` so the mock checkout flow can be tested
(production keeps it `false`). `SENTRY_DSN` is unset. There is no Railway edge locally, so
requests have no `X-Forwarded-For`. better-auth then logs a one-time warning and rate-limits all
anonymous auth calls in one shared bucket. On Railway the edge provides the header.

---

## Launch checklist

**Deploy and infrastructure**
- [ ] Railway services `Postgres`, `server` (no public domain, 1 replica) and `client`, configured as in §1
- [ ] All variables set; both deploys green; `/v1/health` reports `database: ok`
- [ ] Pre-deploy migration ran (`prisma migrate status` shows `Database schema is up to date`)
- [ ] `OWNER_EMAIL` registered and verified on the live site; Admins added from Admin › Admins; demo seed **not** run; real catalogue, sizes and prices entered
- [ ] Admin › Settings: business name, ח.פ./ע.מ., address, phone, contact email
- [ ] Custom domain `baia.co.il` with TLS; `www` redirect; URL variables updated and both services redeployed
- [ ] R2 bucket on `images.baia.co.il`; an uploaded photo shows on the product page
- [ ] Email: sender chosen (Gmail App Password or own domain with SPF/DKIM/DMARC); a test order's
      emails arrive in Gmail's inbox, not spam
- [ ] Backups: Railway volume backups enabled, the `backup` cron service ran once (log ends with `done`) into a **private** bucket, and one restore tested (§11)
- [ ] Uptime monitor and alerts on `/v1/health` and the home page

**Still missing before a real public launch**
- [ ] **A real payment provider.** The mock can't take real money; until then `PAYMENTS_ENABLED=false` (§9). Add PSP webhook handling,
      refunds and an invoice/receipt flow (חשבונית מס/קבלה, e.g. through the PSP or Green Invoice/iCount)
- [ ] **Legal review** of the terms (תקנון), privacy policy, cancellation policy (חוק הגנת הצרכן,
      the 14-day cancellation right) and the accessibility statement (IS 5568 / WCAG AA), with a lawyer
- [ ] **Real business details** everywhere: company/VAT number (it currently shows "יעודכן בקרוב"),
      address, phone `050-0000000` placeholder, WhatsApp number, and the fallback contact email
      `baiaswimwear0@gmail.com`
- [ ] **Analytics and cookie consent:** choose analytics (GA4/Plausible/PostHog), wire it to the
      existing consent banner (essential-only by default), and update the privacy policy
- [ ] **Error monitoring:** optional Sentry DSNs set for the API and the storefront (§12)
- [ ] Courier chosen: `TRACKING_URL_TEMPLATE` / `TRACKING_CARRIER_NAME`; delivery methods and prices in Admin › Delivery
- [ ] Google sign-in (optional): OAuth client with the production redirect URI
- [ ] Load and perf smoke test on the production domain (Lighthouse, a few hundred concurrent requests)
- [ ] Rotate any credentials that were ever pasted into chats or tickets
