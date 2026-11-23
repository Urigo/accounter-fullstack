import { Pool } from 'pg';
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
 */
export async function setup() {
  // This opens its own pool, so it checks its own target rather than relying on the setup
  // that ran before it.
  assertTestDatabaseIsLocal();

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
