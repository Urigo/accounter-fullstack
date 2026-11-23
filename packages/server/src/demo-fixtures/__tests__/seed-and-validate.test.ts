import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { ALLOW_DEMO_SEED_ENV } from '../../../../migrations/src/local-db-guard.js';
import { resolveDemoSeedTestEnv } from '../../__tests__/helpers/demo-seed-test-env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Integration test: Seed demo data and validate
 *
 * This test runs the full seed + validate pipeline to ensure:
 * 1. Seed script completes successfully (exit code 0)
 * 2. Validation script passes all checks (exit code 0)
 * 3. End-to-end data integrity from seed to validation
 *
 * Prerequisites:
 * - A LOCAL database connection (this test resets the database it is pointed at)
 * - ALLOW_DEMO_SEED=1 environment variable set by whoever runs it
 * - Migrations applied
 *
 * Note: This is a slow test (~10-30 seconds) and should be run separately
 * or marked as integration test in CI/CD pipelines.
 *
 * The seed TRUNCATEs every domain table, so this test must never grant itself permission to run
 * it. It used to pass `ALLOW_DEMO_SEED: '1'` to the seed process unconditionally, which made a
 * plain `yarn vitest` (every project) or an IDE test run enough to wipe whatever database the
 * root .env pointed at -- production, on 2026-11-23. Now the caller's own `ALLOW_DEMO_SEED=1`
 * is required: without it the suite is skipped.
 *
 * It belongs to the `demo-seed` vitest project only (`scripts/__tests__/vitest-collection.test.ts`
 * holds that), and it checks its target itself before it starts anything: the database the
 * seed would reach has to be local, and nothing overrides that. See `resolveDemoSeedTestEnv`.
 */
const demoSeedAllowed = process.env.ALLOW_DEMO_SEED === '1';

// A skip is silent: if the CI job that runs this project ever stops setting ALLOW_DEMO_SEED,
// the suite would quietly stop running and the job would stay green. Fail instead.
//
// Only an affirmative CI value counts: GitHub Actions sets `true`, some setups use `1`, and
// `CI=false` / `CI=0` are common ways to switch CI behaviour off locally -- those should skip.
const inCI = process.env.CI === 'true' || process.env.CI === '1';
if (inCI && !demoSeedAllowed) {
  throw new Error(
    `The demo-seed E2E was selected in CI without ${ALLOW_DEMO_SEED_ENV}=1, so it would be ` +
      'skipped. Set it on the CI step that runs `--project demo-seed`.',
  );
}

describe.skipIf(!demoSeedAllowed)('Seed and Validate Integration', () => {
  // Increase timeout for this integration test (30 seconds)
  it(
    'seeds demo data and passes validation',
    async () => {
      // Set by scripts/vitest-demo-seed-setup.ts, the project's global setup, when the latest
      // migration is not in the database (or could not be looked up).
      if (process.env.SKIP_DEMO_SEED_STALE_MIGRATIONS === '1') {
        throw new Error(
          'Demo-seed test failed: migrations are stale. Run: yarn workspace @accounter-helper/migrations migration:run',
        );
      }

      const workspaceRoot = resolve(__dirname, '../../../../../');
      const seedScriptPath = resolve(workspaceRoot, 'scripts/seed-demo-data.ts');
      const validateScriptPath = resolve(
        workspaceRoot,
        'packages/server/src/demo-fixtures/validate-demo-data.ts',
      );
      const registerEsmPath = resolve(workspaceRoot, 'scripts/register-esm.js');

      // The environment the seed and validate processes run with: the caller's, minus the
      // remote-database opt-in. This test has no reason to reach a deployed database, so the
      // seed's own guard -- the code that actually connects -- is left with no way to allow
      // one, whatever the caller exported.
      //
      // Before that, and before anything is started, this throws unless the database the
      // children would reach is local. Both children get exactly the environment that was
      // checked.
      const childEnv = resolveDemoSeedTestEnv(workspaceRoot);

      // Step 1: Run seed script
      const seedExitCode = await new Promise<number>((resolve, reject) => {
        const seedProcess = spawn(
          'node',
          ['--import', registerEsmPath, seedScriptPath],
          {
            cwd: workspaceRoot,
            // ALLOW_DEMO_SEED must come from the caller; ALLOW_REMOTE_DB is stripped (above).
            env: childEnv,
            stdio: 'inherit', // Show output for debugging
          },
        );

        seedProcess.on('close', code => {
          resolve(code ?? 1);
        });

        seedProcess.on('error', err => {
          reject(err);
        });
      });

      expect(seedExitCode).toBe(0);

      // Step 2: Run validation script
      const validateExitCode = await new Promise<number>((resolve, reject) => {
        const validateProcess = spawn(
          'node',
          ['--import', registerEsmPath, validateScriptPath],
          {
            cwd: workspaceRoot,
            env: childEnv,
            stdio: 'inherit',
          },
        );

        validateProcess.on('close', code => {
          resolve(code ?? 1);
        });

        validateProcess.on('error', err => {
          reject(err);
        });
      });

      expect(validateExitCode).toBe(0);
    },
    30000,
  ); // 30 second timeout
});
