import { Pool } from 'pg';
import { ALLOW_DEMO_SEED_ENV } from '../packages/migrations/src/local-db-guard.js';
import { checkLatestMigration } from '../packages/server/src/__tests__/helpers/migration-verification.js';
import {
  assertTestDatabaseIsLocal,
  testDbConfig,
  testDbSchema,
} from '../packages/server/src/__tests__/helpers/test-db-config.js';

/**
 * Global setup of the `demo-seed` vitest project, run after `vitest-global-setup.ts`.
 *
 * The demo seed assumes the schema is at the latest migration. When it is not, the seed fails
 * somewhere in the middle with a constraint or column error that says nothing about the cause.
 * This checks first and leaves a flag for `seed-and-validate.test.ts`, which then fails with
 * the command to run instead of starting the seed.
 *
 * The flag is an environment variable because this runs in the main vitest process and the
 * test runs in a worker, which inherits the environment.
 *
 * Whatever goes wrong here must not be thrown: vitest treats a global setup that throws as
 * fatal for the whole run, the projects that need no database included. So nothing is opened
 * when the suite is going to be skipped, and a database that cannot be reached is reported
 * through the same flag as a stale one.
 */
export async function setup() {
  // This opens its own pool, so it checks its own target rather than relying on the setup
  // that ran before it.
  assertTestDatabaseIsLocal();

  // Without the opt-in the suite is skipped (see seed-and-validate.test.ts): there is nothing
  // to check, and a run with no database up must not fail here.
  if (process.env[ALLOW_DEMO_SEED_ENV] !== '1') {
    return;
  }

  const pool = new Pool(testDbConfig);

  try {
    const result = await checkLatestMigration(pool, testDbSchema);

    if (!result.isLatest) {
      console.warn(`WARNING: ${result.errorMessage}`);
      console.warn(
        `  Run migrations before demo-seed tests: yarn workspace @accounter-helper/migrations migration:run`,
      );
      console.warn(`  Demo-seed tests will fail.`);

      // Store flag to fail tests gracefully
      process.env.SKIP_DEMO_SEED_STALE_MIGRATIONS = '1';
    }
  } finally {
    await pool.end();
  }
}
