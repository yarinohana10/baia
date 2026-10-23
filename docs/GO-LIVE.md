# Go-live guide (for the shop owner, no coding needed)

This guide takes you from "the code is on GitHub" to "the shop is live on your own domain". Follow the
steps in order. Every step says what to click and what you should see afterwards.

Words you will meet: **secret** = a password-like value that must never be pasted in chat, email or
GitHub; paste it only into the box it belongs to. **Variable** = a named setting (like `OWNER_EMAIL`)
that you type into Railway. The full list of variables is in step 6; the technical reference is
[`railway-env.md`](./railway-env.md), the engineer's runbook is [`DEPLOYMENT.md`](./DEPLOYMENT.md).

> **How sure are the click paths?** Railway, Cloudflare and Resend change their screens now and then.
> The steps below follow their current documentation (checked October 2026). Items marked
> **(unverified)** could not be confirmed from official docs: if a button is named differently, look for
> the closest match or ask your developer.

Throughout, `baia.co.il` stands for **your** domain. Replace it everywhere with the real one.

## What it will cost (approximately, check current prices)

| Service | Free tier or price | Note |
|---|---|---|
| Railway | paid plan, from about 5 USD/month plus usage **(unverified, check railway.com/pricing)** | runs the shop, database and backups job |
| Cloudflare (DNS + R2 images) | free DNS; R2 has a free monthly allowance (10 GB stored) **(unverified)** | R2 may ask for a payment card even if you stay in the free allowance **(unverified)** |
| Resend (email) | free: 3,000 emails/month and **100/day**, 3 domains (resend.com/pricing, checked) | upgrade if you expect more than ~30 orders a day |
| Domain | yearly fee, `.co.il` from an Israeli registrar | |
| Sentry (optional) | free tier | only if you want error alerts |

## Step 1: Create your accounts

1. **GitHub** — you already have it (the code lives at `yarinohana10/baia`).
2. **Railway:** go to railway.com → **Login** → **Login with GitHub**. Add a payment method and choose a
   paid plan when asked (the free trial is not meant for a live shop).
3. **Cloudflare:** cloudflare.com → **Sign up**. Use the business mailbox `baiaswimwear0@gmail.com`
   so the account is not tied to a person. Turn on two-step verification (Profile → Authentication).
4. **Resend:** resend.com → **Sign up** with the same mailbox.
5. **Sentry (optional):** sentry.io → sign up (free). You can do this later.

Write the logins down in a password manager. Turn on two-step verification on all of them.

## Step 2: Domain, and moving its DNS to Cloudflare

You need a domain you control. **DNS** is the phone book that says which server a name points to; we
want Cloudflare to hold it because it also serves your images and shows the exact records you must add.

1. If you do not own a domain yet, buy one at an Israeli registrar (for `.co.il`, a registrar approved
   by ISOC-IL). Cloudflare's own registrar does not sell `.co.il` **(unverified)**; a `.com` can be bought
   directly in Cloudflare (Domain Registration → Register Domains).
2. Cloudflare dashboard → **Add a domain** (or **Onboard a domain**) → type `baia.co.il` → choose the
   **Free** plan → continue. Cloudflare scans for existing records; keep them if you have an old site,
   or delete them if it was empty.
3. Cloudflare shows **two nameservers** (like `xxx.ns.cloudflare.com`). Log in to the registrar where
   you bought the domain and replace the nameservers with these two. Save.
4. Wait. It can take minutes to a few hours. Cloudflare emails you when the domain is **Active**.
   Do not continue to step 3 before it says Active (the R2 custom domain needs it).

## Step 3: The image bucket (Cloudflare R2)

R2 stores the product photos. Anyone on the internet can look at a photo, so **only photos** go here.

1. Cloudflare dashboard → **R2 object storage** (left menu) → follow the prompts to enable R2 (a payment
   card may be requested).
2. **Create bucket** → name `baia-assets` → location: **Automatic** or a European hint → **Create**.
3. Open the bucket → **Settings** → **Custom Domains** → **Add** → type `images.baia.co.il` →
   **Continue** → **Connect Domain**. Wait until the status says **Active** (a few minutes; if stuck,
   use the "…" menu → **Retry connection**). Do **not** use the `r2.dev` address in production: it is
   rate-limited and meant for testing.
4. **Account ID:** R2 overview page, right side, "Account ID" → copy it. Your endpoint is
   `https://<account-id>.r2.cloudflarestorage.com` (this is `S3_ENDPOINT`).
5. **API token (the key the shop uses to upload):** R2 overview → **Manage API Tokens** (or
   **API → Manage**) → **Create API token** → permission **Object Read & Write** → **Specify bucket(s)**
   → `baia-assets` → **Create**. The screen shows an **Access Key ID** and a **Secret Access Key**
   **only once**. Copy both into your password manager now. They become `S3_ACCESS_KEY` and `S3_SECRET_KEY`.
6. **CORS:** not needed, because photos are uploaded through the shop's server, not from the browser.
   Optional: open the bucket → **Settings** → **CORS Policy** → **Add CORS policy** → paste
   `[{"AllowedOrigins":["https://baia.co.il","https://www.baia.co.il"],"AllowedMethods":["GET"]}]` → **Save**.
7. **A second, private bucket for backups:** **Create bucket** → name `baia-backups` → **Create**. Do
   **not** add a custom domain or public access to it. Create a second API token (step 5 again) with
   **Object Read & Write** on `baia-backups` only. These keys become `BACKUP_S3_ACCESS_KEY` and
   `BACKUP_S3_SECRET_KEY`.

## Step 4: Email (Resend)

The shop sends order confirmations, password resets and alerts from an address on your domain, for
example `orders@baia.co.il`. Replies go to your Gmail.

1. Resend → **Domains** → **Add Domain** → enter `baia.co.il` (Resend recommends a subdomain such as
   `updates.baia.co.il` to protect the main domain's reputation; either works. If you choose the
   subdomain, the sender becomes `orders@updates.baia.co.il`).
2. Resend lists DNS records to add (SPF, DKIM, and usually an MX/return-path record). In Cloudflare →
   your domain → **DNS** → **Records** → **Add record**, and copy each one **exactly**: Type, Name,
   Content/Value. For TXT records paste the value without extra quotes. Set the proxy to **DNS only**
   (grey cloud) for any CNAME that Resend gives you.
3. Add a **DMARC** record too (it tells inbox providers you are legitimate): Type `TXT`, Name `_dmarc`,
   Content `v=DMARC1; p=none; rua=mailto:baiaswimwear0@gmail.com`.
4. Back in Resend → **Verify DNS Records**. It can take from minutes to a day. Wait for **Verified**.
5. **API key:** Resend → **API Keys** → **Create API Key** → name `baia-production` → permission
   **Sending access** (restrict it to your domain if offered) → **Add**. Copy the key (starts with `re_`)
   **now**, it is shown once. This is `SMTP_PASSWORD`.
6. **Revoke the old test key:** on the same page, find the key you used for testing (the one that was ever
   pasted in a chat, file or ticket) → **…** → **Delete**. Do this **after** the live site sends its
   first email successfully (step 10), so you are never without a working key. Never reuse the test
   key in production.

The SMTP settings Resend documents: host `smtp.resend.com`, port `465` (secure) or `587`, user `resend`,
password = the API key.

## Step 5: Create the project on Railway

1. Railway → **New Project** → **Deploy PostgreSQL**. Rename the database service to `Postgres`
   (exactly; click the service → Settings → name).
2. In the project: **+ New** → **GitHub Repo** → authorize Railway to read `yarinohana10/baia` if
   asked → select it → rename the new service to **`server`** (exactly).
3. **+ New** → **GitHub Repo** → the same repo again → rename it **`client`** (exactly).
   The names matter because settings below refer to `${{server...}}` and `${{client...}}`.
4. Click **server** → **Settings** and set (leave "Root Directory" empty):
   - **Build → Builder:** Dockerfile; Dockerfile path `apps/server/Dockerfile`
   - **Deploy → Pre-deploy Command:** `node_modules/.bin/prisma migrate deploy` (this updates the
     database before each new version goes live)
   - **Deploy → Healthcheck Path:** `/v1/health`, timeout `120`
   - **Deploy → Restart Policy:** On failure, 10 retries
   - **Replicas:** `1` (keep it at one)
   - **Networking:** do **not** generate a public domain for `server`.
5. Click **client** → **Settings**:
   - **Build → Dockerfile path:** `apps/client/Dockerfile`
   - **Deploy → Healthcheck Path:** `/robots.txt`, timeout `120`
   - **Networking → Generate Domain**, target port `3000` (you get an address like
     `client-production-xxxx.up.railway.app`; we replace it with your domain in step 7).
6. If your developer prefers, all of this can be applied from the file `.railway/railway.ts` instead
   (see DEPLOYMENT.md §1). Do not do both.

Do not deploy yet: the services fail until the variables from step 6 exist, which is expected.

## Step 6: Variables (settings) for each service

In Railway click a service → **Variables** → **New Variable** (or **Raw Editor**, to paste many lines).
Values written like `${{Postgres.DATABASE_URL}}` are Railway references: type them exactly.

**Generate the two random secrets** on your Mac: open **Terminal** and run
`openssl rand -base64 32`. Run it once for each secret that says "generated" and copy the output.

### server

| Variable | Value | Where it comes from |
|---|---|---|
| `NODE_ENV` | `production` | fixed |
| `PORT` | `8000` | fixed |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Railway reference |
| `CLIENT_URL` | `https://${{client.RAILWAY_PUBLIC_DOMAIN}}` (becomes `https://baia.co.il,https://www.baia.co.il` in step 7) | Railway reference |
| `BETTER_AUTH_URL` | `https://${{client.RAILWAY_PUBLIC_DOMAIN}}` (becomes `https://baia.co.il` in step 7) | Railway reference |
| `BETTER_AUTH_SECRET` | generated | `openssl rand -base64 32` — **secret**. Changing it logs everyone out |
| `OWNER_EMAIL` | `yarinohana9@gmail.com` | the owner's own address |
| `EMAIL_PROVIDER` | `smtp` | fixed |
| `SMTP_HOST` | `smtp.resend.com` | Resend |
| `SMTP_PORT` | `465` | Resend |
| `SMTP_SECURE` | `true` | fixed |
| `SMTP_USER` | `resend` | Resend |
| `SMTP_PASSWORD` | the new `re_...` key | step 4 — **secret** |
| `EMAIL_FROM` | `BAIA Swimwear <orders@baia.co.il>` | an address on the verified domain |
| `ADMIN_NOTIFY_EMAIL` | `baiaswimwear0@gmail.com` | the business inbox for order alerts |
| `STORAGE_PROVIDER` | `s3` | fixed |
| `S3_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` | step 3.4 |
| `S3_REGION` | `auto` | fixed for R2 |
| `S3_BUCKET` | `baia-assets` | step 3 |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | token keys | step 3.5 — **secret** |
| `S3_PUBLIC_URL` | `https://images.baia.co.il` | step 3.3 |
| `S3_PUBLIC_URL_INCLUDES_BUCKET` | `false` | fixed for an R2 custom domain |
| `PAYMENT_PROVIDER` | `mock` | fixed until a real provider exists |
| `PAYMENTS_ENABLED` | `false` | fixed until a real provider exists (step 12) |
| `SENTRY_DSN` | *(optional)* | Sentry project → Settings → Client Keys (DSN) |

Optional later: `TRACKING_URL_TEMPLATE` (carrier link containing `{tracking}`), `TRACKING_CARRIER_NAME`,
`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (Google sign-in).

### client

| Variable | Value |
|---|---|
| `PORT` | `3000` |
| `NEXT_PUBLIC_SITE_URL` | `https://${{RAILWAY_PUBLIC_DOMAIN}}` (becomes `https://baia.co.il` in step 7) |
| `NEXT_PUBLIC_API_URL` | `/v1` |
| `API_INTERNAL_URL` | `http://${{server.RAILWAY_PRIVATE_DOMAIN}}:8000` |
| `IMAGE_REMOTE_PATTERNS` | `https://images.baia.co.il` (must be the same host as `S3_PUBLIC_URL`) |
| `NEXT_PUBLIC_CONTACT_EMAIL` | `baiaswimwear0@gmail.com` |
| `NEXT_PUBLIC_SENTRY_DSN` | *(optional)* a second Sentry project's DSN |

The client variables are baked in when the site is **built**: after changing one, click the service →
**Deployments** → **⋮** → **Redeploy**.

### backup (add after the first successful deploy, step 11)

See step 11.

Then deploy: each service → **Deployments** → **Deploy** (or just wait, Railway deploys when variables
change). The server log should show the migration and finally `Baia API listening on port 8000`.
If a deploy fails, open its log: the first lines list **every** missing or invalid variable by name.

## Step 7: Your own domain on the shop (www + apex, HTTPS)

1. Railway → **client** → **Settings → Networking → Custom Domain** → add `baia.co.il`, then add
   `www.baia.co.il` the same way. Railway shows the DNS record(s) to add (usually a CNAME target, and
   sometimes a verification TXT record).
2. Cloudflare → your domain → **DNS** → **Records** → add exactly what Railway shows. For the
   apex name `baia.co.il` Cloudflare accepts a CNAME (it "flattens" it). Set the proxy status to
   **DNS only** (grey cloud) at first, so Railway can issue the HTTPS certificate; you may try the
   orange cloud afterwards **(unverified: check Railway's custom-domain docs if the certificate does not appear)**.
3. In Railway wait until both domains show a green check. HTTPS certificates are issued automatically.
4. Make one address the main one: Cloudflare → **Rules → Redirect Rules** → redirect `www.baia.co.il`
   to `https://baia.co.il` (or the reverse). Pick one and stay with it.
5. Update the variables (see the table above), then redeploy **both** services:
   - server `CLIENT_URL` = `https://baia.co.il,https://www.baia.co.il`
   - server `BETTER_AUTH_URL` = `https://baia.co.il`
   - client `NEXT_PUBLIC_SITE_URL` = `https://baia.co.il`

## Step 8: First login, becoming the Owner

There is no pre-made admin and no default password on purpose.

1. Open `https://baia.co.il/he/register`. Register with **`yarinohana9@gmail.com`** (exactly the
   `OWNER_EMAIL`) and a strong password.
2. Open the verification email in that Gmail inbox (check spam) and click the link. If it does not
   arrive, see Troubleshooting.
3. Log in and open `https://baia.co.il/he/admin`. You are the **Owner**.
4. **Admin → Admins** → add `baiaswimwear0@gmail.com`. If that mailbox has no account yet, it becomes an
   **invitation**: that person must register on the site with that email and verify it, and then is an
   admin. Only the Owner can add or remove admins. A new deploy never removes anyone.

## Step 9: Replace every placeholder in Admin settings

Open **Admin → Settings**. The shop ships with fake values that customers can see. Replace **all** of these:

| Setting | Placeholder now | Replace with |
|---|---|---|
| Company number (ח.פ./ע.מ.) | `000000000` | the real number |
| Business address | `מושב גילת` | the registered address |
| Business phone | `050-0000000` | the real phone |
| Contact email | `baiaswimwear0@gmail.com` | `baiaswimwear0@gmail.com` (alerts arrive here, customers reply here) |
| WhatsApp number | `972500000000` | the real number, international format without `+` or spaces |
| Accessibility coordinator name | `יעודכן בקרוב` ("will be updated soon") | a real person |
| Accessibility coordinator phone | `050-0000000` | their real phone |
| Accessibility coordinator email | `baiaswimwear0@gmail.com` | their real email |

Also do, in the admin:

- **Delivery** (shipping prices, courier, pickup points), the free-shipping threshold and low-stock threshold.
- Create categories and real products with photos, sizes, stock and prices (the demo data is not loaded).
- The legal and information pages (terms, privacy, returns, shipping, accessibility, about) ship with
  **placeholder text** (they say so on the page). Have a lawyer review and replace them before opening
  to customers. Consumer-law points (14-day cancellation right) and the accessibility statement need a professional.
- If a placeholder still appears somewhere on the site after you saved settings, tell your developer: the code also
  has fallback copies (for example `baiaswimwear0@gmail.com` when the server cannot be reached, and
  the build variable `NEXT_PUBLIC_CONTACT_EMAIL`).

## Step 10: Smoke test after every first deploy

Do this on the live address. Tick each line.

- [ ] `https://baia.co.il/v1/health` shows `"status":"ok"` and `"database":"ok"`.
- [ ] The home page loads in Hebrew and English (`/he`, `/en`), with the logo and styles.
- [ ] A product page shows its photos (they come from `images.baia.co.il`).
- [ ] In Admin, upload a product photo: it appears on the product page. A file that is not really an
      image (for example a renamed `.txt`) is refused.
- [ ] Register a new test customer account: the verification email arrives (not in spam) and the link works.
      Open the email's "show original": SPF, DKIM and DMARC say **PASS**.
- [ ] "Forgot password" email arrives.
- [ ] Add a product to the cart and go to checkout: it says **"Payments coming soon"** and no order can be placed.
- [ ] `https://baia.co.il/robots.txt` lists `/order-status` and `/cancel-order` under Disallow.
- [ ] Contact form message reaches `baiaswimwear0@gmail.com`.
- [ ] Log in as Owner: Admin → Admins works; log in as the second admin: Admins section is not available.
- [ ] Railway → **client** and **server** → latest deployment is green; no red errors in the logs.
- [ ] Only now, delete the old Resend test key (step 4.6).
- [ ] Sentry (if enabled): the environment shows up after the first error; use Sentry's "send test event" for the project to check delivery.
- [ ] Set up an uptime monitor (UptimeRobot, free) on `https://baia.co.il/v1/health`.

## Step 11: Backups

Do both A and B.

**A. Railway's own backups:** Railway → **Postgres** service → **Backups** tab → turn on a **daily**
and a **weekly** schedule. Whether your plan includes backups: check the tab **(unverified)**.

**B. Nightly copy to your private R2 bucket** (survives even if the Railway project is lost):

1. Railway project → **+ New** → **GitHub Repo** → same repo → rename to `backup`.
2. **Settings → Build:** Dockerfile path `scripts/backup/Dockerfile`. Do not add a public domain.
3. **Settings → Cron Schedule:** `0 1 * * *` (every day 01:00 UTC; Railway uses UTC).
4. **Variables:** `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`, `BACKUP_S3_BUCKET` = `baia-backups`,
   `BACKUP_S3_ENDPOINT` = your R2 endpoint, `BACKUP_S3_ACCESS_KEY` / `BACKUP_S3_SECRET_KEY` = the
   backup token (step 3.7), `BACKUP_S3_REGION` = `auto`.
5. Let it run once (or **Deployments → Redeploy**) and read its log: it must end with `done`.
   In the R2 dashboard, the `baia-backups` bucket now contains `backups/baia-....dump.gz`. It keeps
   14 daily and 8 weekly copies and deletes older ones.
6. **Practise a restore once** (DEPLOYMENT.md §11) — a backup you have never restored is a hope, not a backup.

## Step 12: When a payment provider is ready (flip `PAYMENTS_ENABLED`)

Until a real card provider (Cardcom, Tranzila, PayPlus, ...) is integrated by your developer, leave
`PAYMENT_PROVIDER=mock` and `PAYMENTS_ENABLED=false`. **Never** set `PAYMENTS_ENABLED=true` with `mock`
on the live site: orders would be confirmed without taking money.

When the provider is integrated and tested on a private staging copy:

1. Set `PAYMENT_PROVIDER` to the provider's name and `PAYMENT_WEBHOOK_SECRET` (**secret**, from the provider).
2. Last, set `PAYMENTS_ENABLED=true` on the **server**. Railway restarts it.
3. Place one real small order and check: payment, confirmation email, Admin → Orders, and the refund flow
   (cancelled paid orders show **Refund Pending** until you refund in the provider's dashboard and confirm it in Admin).

## Troubleshooting

**Emails do not arrive.**
- Resend → **Emails**: is the message listed, and what status (delivered, bounced)? If it is not listed,
  the shop never sent it: check the server log for `email` errors and that `EMAIL_PROVIDER=smtp`,
  `SMTP_USER=resend`, `SMTP_PASSWORD` is the live key and `SMTP_PORT=465` with `SMTP_SECURE=true`.
- "Domain not verified" or sender rejected: `EMAIL_FROM` must be an address on the **verified** domain (or subdomain).
- Lands in spam: check SPF/DKIM/DMARC are all PASS (step 10); do not send from a Gmail address through Resend.
- Free plan limit: 100 emails per day. Resend says so in the dashboard when you hit it.
- Failed sends are also listed in Admin → Orders → Emails.

**Images do not load / broken pictures.**
- Open an image address directly (`https://images.baia.co.il/products/...`). If that fails, the R2 custom domain
  is not Active (step 3.3) or the file is not in the bucket.
- If the address works but the site shows broken pictures: `IMAGE_REMOTE_PATTERNS` on the client does not
  match `S3_PUBLIC_URL`'s host. Fix it and **redeploy the client**.
- Images appear as `images.baia.co.il/baia-assets/...` with 404: set `S3_PUBLIC_URL_INCLUDES_BUCKET=false`.
- Uploads fail in Admin: the server log shows the S3 error. Usually wrong `S3_ENDPOINT` (account id),
  or the token is not for this bucket. The server only logs a warning at startup for these; it does not stop.

**Emails arrive but the logo or product pictures are missing.**
- Email pictures are loaded by the reader's mail service (Gmail, Outlook) from the public internet, so they
  only work with public https addresses. In a local test they always break because the addresses point at
  `localhost`. On the live site the logo is `https://<your domain>/email/baia-logo.png` (taken from
  `CLIENT_URL`) and the product pictures come from `S3_PUBLIC_URL` (your `images.<domain>` address).
- Open the logo address and one product picture address in a private browser window. If either fails, fix
  `CLIENT_URL` or the R2 custom domain (step 3.3). Gmail may also hide pictures until the reader taps
  "Display images below"; that is normal for a new sender and improves as the domain builds a reputation.

**Cannot stay logged in / login loops / "invalid origin" errors (cookies, CORS).**
- `CLIENT_URL` and `BETTER_AUTH_URL` must be exactly the address in the browser (`https://baia.co.il`,
  no trailing path), and `NEXT_PUBLIC_SITE_URL` the same. If you use both `www` and the bare domain, list
  both in `CLIENT_URL` and redirect one to the other.
- After changing client variables, **redeploy the client** (they are built in).
- Do not open the Railway `*.up.railway.app` address after the domain is live; cookies are per address.

**A deploy fails.** Open the failed deployment's log. A line starting
`[config] Invalid environment configuration` names each missing variable (for example
`OWNER_EMAIL`, `ADMIN_NOTIFY_EMAIL`). Fix and redeploy. A failed migration keeps the old version running.

**I cannot see the Admin menu.** Your account must be verified and be the Owner or an invited admin
(step 8). If the Owner mailbox is lost, ask your developer for the emergency command (DEPLOYMENT.md §5).

**Site is down.** Railway → each service → Deployments. To go back to a good version: **⋮ → Redeploy**
on the last green one.

## Keep secrets safe

Secrets are `BETTER_AUTH_SECRET`, `SMTP_PASSWORD`, `S3_SECRET_KEY`, `BACKUP_S3_SECRET_KEY`,
`PAYMENT_WEBHOOK_SECRET`, Google/Sentry keys. Keep them only in Railway Variables and your password manager.
If one ever appears in a chat, email, screenshot or GitHub, create a new one and delete the old one right away.
