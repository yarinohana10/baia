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
