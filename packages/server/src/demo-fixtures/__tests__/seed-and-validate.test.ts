import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
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
 * It belongs to the `demo-seed` vitest project only. A copy of this file inside a nested git
 * worktree used to be collected by the `unit` project during a plain `yarn test`, and the test
 * set ALLOW_DEMO_SEED=1 for the seed script itself, so the script truncated whatever database
 * the root `.env` pointed at. Two things in this file are there so it cannot do that, whatever
 * collects it: it refuses any target that is not local, and it no longer sets
 * ALLOW_DEMO_SEED. See `resolveDemoSeedTestEnv`.
 */
describe('Seed and Validate Integration', () => {
  // Increase timeout for this integration test (30 seconds)
  it(
    'seeds demo data and passes validation',
    async () => {
      // Check for stale migrations before running the test
      if (process.env.SKIP_DEMO_SEED_STALE_MIGRATIONS === '1') {
        throw new Error(
          'Demo-seed test failed: migrations are stale. Run: yarn workspace @accounter/migrations migration:run',
        );
      }

      const workspaceRoot = resolve(__dirname, '../../../../../');
      const seedScriptPath = resolve(workspaceRoot, 'scripts/seed-demo-data.ts');
      const validateScriptPath = resolve(
        workspaceRoot,
        'packages/server/src/demo-fixtures/validate-demo-data.ts',
      );
      const registerEsmPath = resolve(workspaceRoot, 'scripts/register-esm.js');

      // Before anything is started: throws unless the database the children would reach is
      // local and ALLOW_DEMO_SEED=1 came from the caller. Both children get exactly the
      // environment that was checked.
      const childEnv = resolveDemoSeedTestEnv(workspaceRoot);

      // Step 1: Run seed script
      const seedExitCode = await new Promise<number>((resolve, reject) => {
        const seedProcess = spawn(
          'node',
          ['--import', registerEsmPath, seedScriptPath],
          {
            cwd: workspaceRoot,
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
