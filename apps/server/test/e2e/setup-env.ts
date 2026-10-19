import { testDatabaseUrl } from './test-db-url';

// Must run before any app module is imported: auth.ts builds its own
// PrismaClient and reads its config at import time.
process.env.DATABASE_URL = testDatabaseUrl();
process.env.NODE_ENV = 'test';
process.env.CLIENT_URL = 'http://localhost:3999';
process.env.BETTER_AUTH_URL = 'http://localhost:8999';
process.env.BETTER_AUTH_SECRET = 'e2e-test-secret-e2e-test-secret-0123456789';
process.env.AUTH_COOKIE_PREFIX = 'baia';
process.env.STORAGE_PROVIDER = 'local';
process.env.MOCK_PAYMENT_DELAY_MS = '0';
delete process.env.PAYMENT_PROVIDER;
delete process.env.PAYMENT_WEBHOOK_SECRET;
// Never talk to a real mail server from tests (even when the shell exports
// SMTP_* for the dev stack): the quiet console transport drops everything.
// Specs that assert on emails swap in MemoryEmailTransport (see mail.ts).
process.env.EMAIL_PROVIDER = 'console';
delete process.env.SMTP_HOST;
delete process.env.SMTP_USER;
delete process.env.SMTP_PASSWORD;
process.env.EMAIL_RETRY_DELAYS_MS = '0,0,0';
