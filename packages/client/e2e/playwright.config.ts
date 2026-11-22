import { defineConfig, devices } from '@playwright/test';
import {
  assertE2eDatabase,
  CLIENT_PORT,
  CLIENT_URL,
  E2E_USER_ID,
  GRAPHQL_URL,
  postgresEnv,
  SERVER_URL,
} from './env.js';

/**
 * Browser end-to-end tests: a real Postgres, the real server and a production build of the client.
 *
 * Playwright starts both servers. The server's command first recreates and seeds the e2e database
 * (`seed-database.ts`), so every run starts from the same data. Neither server is reused if its
 * port is already taken: a dev server there may be pointed at another database.
 *
 * Prerequisites (see `e2e/README.md`): a local Postgres, `yarn generate`, and the server built
 * (`yarn build:tools && yarn workspace @accounter/server build`).
 */

assertE2eDatabase();

const isCI = !!process.env.CI;

/**
 * Set for every server process, so nothing falls back to the root `.env`: the server reads
 * `TEST_ENV_FILE` instead of it when set, and dotenv never overrides a variable that is set, even
 * to an empty string.
 */
const isolatedEnv = {
  TEST_ENV_FILE: '/dev/null',
  AUTH0_DOMAIN: '',
  AUTH0_AUDIENCE: '',
  AUTH0_CLIENT_ID: '',
  AUTH0_CLIENT_SECRET: '',
  AUTH0_MANAGEMENT_AUDIENCE: '',
  HIVE_TOKEN: '',
  OTEL_ENABLED: '0',
};

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.e2e.ts',
  outputDir: '../test-results/e2e',
  // The tests share one database and one server. They read disjoint data, apart from the merge
  // test, which only writes its own charges; one worker keeps request counts and timing simple.
  workers: 1,
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: isCI
    ? [['list'], ['html', { outputFolder: '../playwright-report', open: 'never' }]]
    : [['list']],
  use: {
    baseURL: CLIENT_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      name: 'server',
      cwd: '../../server',
      command:
        'node --import ../../scripts/register-esm.js ../client/e2e/seed-database.ts && ' +
        'node dist/index.js',
      url: `${SERVER_URL}/graphql`,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: {
        ...isolatedEnv,
        ...postgresEnv(),
        ALLOW_DEV_AUTH: '1',
        CREDENTIALS_ENCRYPTION_KEY: '0'.repeat(64),
        PRICE_INDEX_SYNC_ENABLED: '0',
        POSTGRES_MONITOR_INTERVAL_MS: '0',
        SERVER_LOG_LEVEL: 'warn',
        NODE_ENV: 'production',
      },
    },
    {
      name: 'client',
      cwd: '..',
      // A production build, in its own folder so a regular `dist` (built against another API) is
      // never served. `E2E_SKIP_CLIENT_BUILD=1` reuses the last e2e build while iterating on tests.
      command:
        (process.env.E2E_SKIP_CLIENT_BUILD === '1' ? '' : 'yarn vite build --outDir dist-e2e && ') +
        `yarn vite preview --outDir dist-e2e --port ${CLIENT_PORT} --strictPort`,
      url: CLIENT_URL,
      reuseExistingServer: false,
      timeout: 240_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: {
        ...isolatedEnv,
        // Read by `build-env.ts` and inlined into the bundle.
        ALLOW_DEV_AUTH: '1',
        DEV_AUTH_USER_ID: E2E_USER_ID,
        GRAPHQL_URL,
        AUTH0_FRONTEND_CLIENT_ID: '',
      },
    },
  ],
});
