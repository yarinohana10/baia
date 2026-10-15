export const DEFAULT_TEST_DATABASE_URL = 'postgresql://baia:baia@localhost:5433/baia_test?schema=public';

export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL || DEFAULT_TEST_DATABASE_URL;
  const dbName = new URL(url).pathname.replace(/^\//, '');
  if (!dbName.endsWith('_test')) {
    throw new Error(`Refusing to run e2e tests against "${dbName}": database name must end with _test`);
  }
  return url;
}
