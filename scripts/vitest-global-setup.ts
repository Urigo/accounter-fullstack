import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export default async function globalSetup() {
  // Create isolated env file for test runs (seedAdminCore writes here)
  try {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'accounter-test-env-'));
    const envFile = path.join(tempDir, '.env');
    fs.writeFileSync(envFile, '', 'utf8');
    process.env.TEST_ENV_FILE = envFile;
    // Lightweight log (not using debug flag to ensure visibility once)
    // eslint-disable-next-line no-console
    console.log(`[test-setup] Using isolated TEST_ENV_FILE: ${envFile}`);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[test-setup] Failed to establish isolated TEST_ENV_FILE', e);
  }

  // Return a global teardown to ensure the shared test DB pool is closed once.
  return async () => {
    try {
      const mod = await import('../packages/server/src/__tests__/helpers/db-setup.js');
      if (typeof mod.closeTestDb === 'function') {
        await mod.closeTestDb();
      }
    } catch {
      // Best-effort teardown; ignore resolution issues in non-server test runs
    }
  };
}
