import type { Config } from 'jest';

/**
 * DB-backed end-to-end tests (real Postgres, real better-auth sessions).
 * Run with `pnpm --filter @baia/server test:e2e`. Uses TEST_DATABASE_URL
 * (default postgresql://baia:baia@localhost:5433/baia_test) and refuses to
 * touch a database whose name does not end in `_test`.
 *
 * better-auth is ESM-only; the script sets --experimental-vm-modules so Jest
 * can require() it (needs Node >= 22.12).
 */
const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '../..',
  testRegex: 'test/e2e/.*\\.e2e-spec\\.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  transformIgnorePatterns: ['/node_modules/', '/src/generated/'],
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/test/e2e/setup-env.ts'],
  globalSetup: '<rootDir>/test/e2e/global-setup.ts',
  // One shared database: run files serially.
  maxWorkers: 1,
  testTimeout: 30_000,
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
};

export default config;
