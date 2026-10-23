# Payments are held behind PAYMENTS_ENABLED, with the mock provider in production

Production runs with `PAYMENT_PROVIDER=mock` and `PAYMENTS_ENABLED=false`: the shop is browsable and the checkout page says "Payments coming soon", and the server refuses to create orders. The flag is a runtime environment variable, so enabling payments after a real provider is integrated is a configuration change plus redeploy, not a code release.

Rejected: not deploying until a provider exists (blocks catalogue entry, testing and SEO indexing), and leaving the mock enabled (it confirms orders without charging anyone). The server still requires `PAYMENT_PROVIDER` at boot and warns when `mock` is used in production, so the held state is deliberate and visible. The local railway simulation sets `PAYMENTS_ENABLED=true` to exercise the full mock flow.
