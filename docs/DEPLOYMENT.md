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
                                                   (plugin)  (Cloudflare R2)  (Gmail/Resend)
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
Secrets (`BETTER_AUTH_SECRET`, `SMTP_PASSWORD`, `S3_SECRET_KEY`) go in **Variables** in the
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

1. Push to `main` (or click **Deploy**). Watch the server's deploy log: you should see the
   pre-deploy migration, then `Baia API listening on port 8000 (production)`.
2. Open `https://<client-domain>/v1/health`. It should return `{"status":"ok",…,"checks":{"database":"ok"}}`.
3. **Create the first admin** inside the running server container. The production image has no
   `pnpm`/`tsx`; the CLI is compiled.
   ```bash
   npx -y @railway/cli@latest link            # select project + environment
   npx -y @railway/cli@latest ssh --service server
   # inside the container (cwd /app/apps/server):
   read -s ADMIN_PASSWORD && export ADMIN_PASSWORD   # type the password, nothing is echoed
   node dist/cli/create-admin.js --email baiaswimwear0@gmail.com --name "BAIA"
   unset ADMIN_PASSWORD; exit
   ```
   This creates a verified ADMIN, or promotes an existing account. It never deletes users.
   Alternative: sign up on the site, then run `node dist/cli/create-admin.js --email <that email>`
   to promote yourself without setting a password.
4. **Seed policy:** do **not** run `prisma:seed` against production. It creates demo categories and
   products, and it isn't in the production image. Create the real catalogue in **/he/admin**.
5. In **Admin › Settings**, fill in the business details: legal name, ח.פ./ע.מ., address, phone, and
   **contact email** (`baiaswimwear0@gmail.com`). The contact email receives new-order alerts and
   is the Reply-To on customer emails. Until it's set, alerts go to the schema default address.

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

### (b) Recommended: your own domain with Resend or Postmark

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

Test: sign up with a real address and place a test order on staging. Then check the Gmail headers
(“Show original”) for `SPF: PASS`, `DKIM: PASS` and `DMARC: PASS`.

## 8. Product images: S3 bucket (Cloudflare R2)

1. Cloudflare → R2 → **Create bucket** `baia-assets`, with a location hint near Europe.
2. Bucket → Settings → **Public access** → **Connect custom domain** `images.baia.co.il`. Cloudflare
   creates the DNS record and TLS certificate. The `r2.dev` URL is rate-limited and meant for
   development only.
3. R2 → **Manage API tokens** → create a token with **Object Read & Write** on this bucket only.
   Put its keys in `S3_ACCESS_KEY` / `S3_SECRET_KEY`.
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

Uploads go to S3 **only**. `STORAGE_PROVIDER=local` is rejected in production because Railway
containers are rebuilt on every deploy and the files would be lost.

## 9. Payments: decide before launch

Only `MockPaymentProvider` exists. With `PAYMENT_PROVIDER=mock`, every "payment" succeeds
**without charging anything**, and the server logs a warning at boot. Use it for a private
staging or demo deploy only. Without `PAYMENT_PROVIDER` the API refuses to start in production.

To take real money, integrate an Israeli payment provider (e.g. Cardcom, Tranzila, Meshulam/Grow,
PayPlus, Hyp): implement `PaymentProvider` and a webhook verifier (see `docs/adr/0002`), register
the provider in `payment-provider.factory.ts`, then set `PAYMENT_PROVIDER=<name>` and
`PAYMENT_WEBHOOK_SECRET`. Until that's done, **don't open the shop to the public**.

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

- **Railway Postgres → Backups:** enable scheduled backups (daily, with weekly retention) and take
  a manual backup before risky migrations. Availability depends on your plan; check the Postgres
  service's *Backups* tab. Restore into a *new* service first and check it before switching.
- **Off-platform copy, recommended:** a weekly `pg_dump` to storage outside Railway, for example
  from your machine:
  ```bash
  # DATABASE_PUBLIC_URL: Postgres service → Variables (uses the TCP proxy)
  pg_dump --format=custom --no-owner "$DATABASE_PUBLIC_URL" > baia-$(date +%F).dump
  ```
  Or run it as a Railway cron service (`postgres:16-alpine` image, cron `0 3 * * 0`) that uploads
  to a *separate* bucket. Test a restore (`pg_restore -d <scratch db> baia-YYYY-MM-DD.dump`) at
  least once.
- Product images live in R2. Turn on R2 object versioning or a lifecycle rule if you want undelete.

## 12. Monitoring and logs

- **Logs:** Railway → service → *Deployments* / *Observability*. The API logs config warnings at
  boot (e.g. mock payments), email send failures (also recorded in **Admin › Orders › Emails**) and
  sweeper activity.
- **Healthchecks:** `/v1/health` returns 503 when Postgres is unreachable. Railway only uses
  healthchecks during deploys, so add an external **uptime monitor** (UptimeRobot, Better Stack)
  on `https://baia.co.il/v1/health` and `https://baia.co.il/he`, with alerts to your phone or email.
- **Error tracking:** not integrated yet. Adding Sentry (`@sentry/nestjs` + `@sentry/nextjs`) is on
  the launch checklist.
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
proxies to an unpublished API; Postgres, LocalStack S3 and Mailpit come from the dev infra.

```bash
docker compose -p baia-railsim -f docker-compose.railway-sim.yml up -d --build postgres s3
docker compose -p baia-railsim -f docker-compose.railway-sim.yml run --rm migrate       # = pre-deploy
docker compose -p baia-railsim -f docker-compose.railway-sim.yml up -d server client
docker compose -p baia-railsim -f docker-compose.railway-sim.yml exec server \
  sh -c 'read -s ADMIN_PASSWORD && export ADMIN_PASSWORD && node dist/cli/create-admin.js --email admin@baia-railsim.test'
open http://localhost:3070        # emails: http://localhost:8025
docker compose -p baia-railsim -f docker-compose.railway-sim.yml down -v                 # removes only this project
```

It uses `PAYMENT_PROVIDER=mock` because it is a simulation. There is no Railway edge locally, so
requests have no `X-Forwarded-For`. better-auth then logs a one-time warning and rate-limits all
anonymous auth calls in one shared bucket. On Railway the edge provides the header.

---

## Launch checklist

**Deploy and infrastructure**
- [ ] Railway services `Postgres`, `server` (no public domain, 1 replica) and `client`, configured as in §1
- [ ] All variables set; both deploys green; `/v1/health` reports `database: ok`
- [ ] Pre-deploy migration ran (`prisma migrate status` shows `Database schema is up to date`)
- [ ] First admin created; demo seed **not** run; real catalogue, sizes and prices entered
- [ ] Admin › Settings: business name, ח.פ./ע.מ., address, phone, contact email
- [ ] Custom domain `baia.co.il` with TLS; `www` redirect; URL variables updated and both services redeployed
- [ ] R2 bucket on `images.baia.co.il`; an uploaded photo shows on the product page
- [ ] Email: sender chosen (Gmail App Password or own domain with SPF/DKIM/DMARC); a test order's
      emails arrive in Gmail's inbox, not spam
- [ ] Backups enabled and one restore tested; off-site `pg_dump` scheduled
- [ ] Uptime monitor and alerts on `/v1/health` and the home page

**Still missing before a real public launch**
- [ ] **A real payment provider.** The mock can't take real money (§9). Add PSP webhook handling,
      refunds and an invoice/receipt flow (חשבונית מס/קבלה, e.g. through the PSP or Green Invoice/iCount)
- [ ] **Legal review** of the terms (תקנון), privacy policy, cancellation policy (חוק הגנת הצרכן,
      the 14-day cancellation right) and the accessibility statement (IS 5568 / WCAG AA), with a lawyer
- [ ] **Real business details** everywhere: company/VAT number (it currently shows "יעודכן בקרוב"),
      address, phone `050-0000000` placeholder, WhatsApp number, and the fallback contact email
      `hello@baia-swimwear.co.il`
- [ ] **Analytics and cookie consent:** choose analytics (GA4/Plausible/PostHog), wire it to the
      existing consent banner (essential-only by default), and update the privacy policy
- [ ] **Error monitoring** (Sentry or similar) for the API and the storefront
- [ ] Courier chosen: `TRACKING_URL_TEMPLATE` / `TRACKING_CARRIER_NAME`; delivery methods and prices in Admin › Delivery
- [ ] Google sign-in (optional): OAuth client with the production redirect URI
- [ ] Load and perf smoke test on the production domain (Lighthouse, a few hundred concurrent requests)
- [ ] Rotate any credentials that were ever pasted into chats or tickets
