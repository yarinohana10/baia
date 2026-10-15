import { execSync } from 'child_process';
import { join } from 'path';
import { testDatabaseUrl } from './test-db-url';

/** Creates the test database / syncs it to prisma/schema.prisma. Each suite truncates its own tables. */
export default function globalSetup() {
  const url = testDatabaseUrl();
  execSync('npx prisma db push --skip-generate', {
    cwd: join(__dirname, '../..'),
    env: { ...process.env, DATABASE_URL: url, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
    stdio: 'pipe',
  });
}
