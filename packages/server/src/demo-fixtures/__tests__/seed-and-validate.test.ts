import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

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
 * - Database connection available
 * - ALLOW_DEMO_SEED=1 environment variable set
 * - Migrations applied
 *
 * Note: This is a slow test (~10-30 seconds) and should be run separately
 * or marked as integration test in CI/CD pipelines.
 */
describe('Seed and Validate Integration', () => {
  // Increase timeout for this integration test (30 seconds)
  it(
    'seeds demo data and passes validation',
    async () => {
      const workspaceRoot = resolve(__dirname, '../../../../../');
      const seedScriptPath = resolve(workspaceRoot, 'scripts/seed-demo-data.ts');
      const validateScriptPath = resolve(
        workspaceRoot,
        'packages/server/src/demo-fixtures/validate-demo-data.ts',
      );
      const registerEsmPath = resolve(workspaceRoot, 'scripts/register-esm.js');

      // Step 1: Run seed script
      const seedExitCode = await new Promise<number>((resolve, reject) => {
        const seedProcess = spawn(
          'node',
          ['--import', registerEsmPath, seedScriptPath],
          {
            cwd: workspaceRoot,
            env: {
              ...process.env,
              ALLOW_DEMO_SEED: '1',
            },
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
            env: process.env,
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
