# Transactional email

Every email the store sends (account, order, contact, store-inbox alerts) goes
through `EmailService` in this folder.

## How sending works

```
caller ──► emailService.dispatch('order-shipped', { to, locale, data, meta: { orderId } })
              │
              ├─ branding()      SiteConfig business details for the footer (cached 60s,
              │                  falls back to defaults if the DB is unreachable)
              ├─ renderTemplate  pure function: templates/*.ts → { subject, html, text }
              ├─ Reply-To        store contactEmail on customer emails (callers may override,
              │                  e.g. contact-notification replies go to the shopper)
              ├─ transport.send  retried on transient errors: EMAIL_RETRY_DELAYS_MS (default 0,2000,8000)
              └─ EmailLog row    SENT (with attempts) or FAILED (with the trimmed error)
```

- `dispatch()` never throws and is meant to be fire-and-forget (`void this.email.dispatch(...)`).
  `deliver()` returns `{ status, attempts, error }`; `sendTemplate()` throws on failure.
- Templates are pure functions of `(data, locale, ctx)`. They describe content with
  `LayoutParts` (intro paragraphs + blocks: `facts`, `items`, `totals`, `info`,
  `callout`, `details`, `quote`, main `cta`, secondary `links`, `footnote`).
  `templates/layout.ts` owns all markup: table-based, inline CSS, RTL for Hebrew,
  LTR for English, max-width 600px, stacks on phones, dark-mode overrides.
  Every string is escaped and every link is checked (http(s)/mailto/tel only),
  so templates can pass user input (names, notes, product names) as-is.
- The plain-text part is rendered from the same parts, so the two never drift.
- Footer: business name, address, phone, email, ח.פ. (shows "יעודכן בקרוב" while it is
  the `000000000` placeholder), WhatsApp, terms/privacy links and why the
  recipient got the email (`TEMPLATE_REASONS`: order / contact / account / internal).
- Hebrew is the default locale; unknown locales fall back to it. Store-inbox
  alerts (`admin-*`, `contact-notification`) are Hebrew only.
- Non-Nest callers (better-auth in `auth/auth.ts`, CLI scripts) use the same
  `emailService` singleton. `EmailModule` points it at the app's `PrismaService`
  on start-up; outside Nest it opens its own Prisma connection on first send.

Adding an email: add its data type and renderer in `templates/` (see the comment
in `templates/index.ts`), add it to `TEMPLATE_REASONS`, call `dispatch`, and add
an admin label in `apps/client/messages/*/orders.json` (`admin.orderEmails.templates`)
if it is about an order.

## Logs

- **Database**: table `email_logs` (Prisma model `EmailLog`): template, to, subject,
  locale, orderId, status `SENT`/`FAILED`, attempts, error, createdAt. The HTML
  body is never stored (it can contain one-time links).
- **Admin**: order panel → "מיילים שנשלחו" (`GET /v1/admin/orders/:id/emails`), with
  "שליחה חוזרת של אישור הזמנה" (`POST /v1/admin/orders/:id/resend-confirmation`, paid orders only).
- **Server log**: failures print `[email] failed to send "<template>" via <transport> after N attempt(s): <error>`.
- **Dev**: Mailpit catches everything sent to `localhost:1025` - UI at http://localhost:8025.

## Configuration

| Variable | Meaning |
| --- | --- |
| `EMAIL_PROVIDER` | `smtp` (any SMTP provider) or `console` (logs recipient + subject only; the default when `SMTP_HOST` is unset; a warning is printed in production) |
| `SMTP_HOST`, `SMTP_PORT` | Server and port (587 = STARTTLS, 465 = implicit TLS) |
| `SMTP_SECURE` | `true` for port 465, `false` otherwise |
| `SMTP_USER`, `SMTP_PASSWORD` | Credentials (empty for Mailpit) |
| `EMAIL_FROM` | Sender, e.g. `"BAIA Swimwear <orders@baiaswimwear.com>"` |
| `EMAIL_RETRY_DELAYS_MS` | Optional, e.g. `0,2000,8000` (wait before each attempt; its length = max attempts) |
| `CLIENT_URL` | Storefront origin used in links (first entry if comma-separated) |
| `ADMIN_NOTIFY_EMAIL` | Store inbox fallback when SiteConfig has no contact email |
| `TRACKING_URL_TEMPLATE`, `TRACKING_CARRIER_NAME` | Carrier tracking link (`{tracking}` placeholder) and name for the shipped email |

Business details (name, ח.פ., address, phone, contact email, WhatsApp) come from
the admin settings (SiteConfig), not env vars.

Tests never send real mail: `test/e2e/setup-env.ts` forces `EMAIL_PROVIDER=console`
(silent under `NODE_ENV=test`) and specs that assert on emails swap in
`MemoryEmailTransport` (`test/e2e/mail.ts`).

## Switching to a real provider

Any SMTP provider works with no code changes - set the env vars and restart.

| Provider | Settings |
| --- | --- |
| **Resend** | `SMTP_HOST=smtp.resend.com SMTP_PORT=465 SMTP_SECURE=true SMTP_USER=resend SMTP_PASSWORD=<API key>` |
| **Postmark** | `SMTP_HOST=smtp.postmarkapp.com SMTP_PORT=587 SMTP_SECURE=false SMTP_USER=<server token> SMTP_PASSWORD=<server token>` |
| **Amazon SES** | `SMTP_HOST=email-smtp.<region>.amazonaws.com SMTP_PORT=587 SMTP_SECURE=false SMTP_USER/SMTP_PASSWORD=<SES SMTP credentials>` (not your AWS keys; leave the SES sandbox first) |
| **Google Workspace** | `SMTP_HOST=smtp.gmail.com SMTP_PORT=465 SMTP_SECURE=true SMTP_USER=<mailbox> SMTP_PASSWORD=<app password>` (daily sending limits apply; fine for low volume) |

Always set `EMAIL_PROVIDER=smtp` and `EMAIL_FROM` on an address of the verified domain.

To use a provider's HTTP API instead of SMTP, implement `EmailTransport`
(`email.types.ts`, one `send()` method) and return it from
`createEmailTransportFromEnv`. Throw errors with `responseCode` (SMTP-style) or a
`code` so retries can tell transient from permanent failures
(`isTransientEmailError`).

## Deliverability checklist

- [ ] Send from your **own domain** (not gmail.com / the provider's shared domain).
- [ ] **SPF**: TXT record on the domain including the provider (e.g. `include:amazonses.com`).
- [ ] **DKIM**: add the provider's DKIM CNAME/TXT records and confirm they verify.
- [ ] **DMARC**: start with `_dmarc` TXT `v=DMARC1; p=none; rua=mailto:dmarc@<domain>`, move to `quarantine` once reports are clean.
- [ ] `EMAIL_FROM` = `orders@<domain>` (a real address on the verified domain, not `no-reply@` on another domain).
- [ ] **Reply-To** = a monitored inbox: set the contact email in the admin settings (customers reply to order emails).
- [ ] Use a sending subdomain (e.g. `mail.<domain>`) if the provider recommends it, and warm up volume gradually.
- [ ] Transactional emails (these) need no unsubscribe link. **Marketing** emails must add a `List-Unsubscribe`
      header + visible unsubscribe link and start the subject with "פרסומת" (חוק התקשורת, סעיף 30א) - and only
      go to people who opted in (`marketingConsent` / newsletter).
- [ ] Watch bounces/complaints in the provider dashboard and the `FAILED` rows in `email_logs`.
- [ ] Test with mail-tester.com or Gmail "Show original" (SPF/DKIM/DMARC = PASS).
