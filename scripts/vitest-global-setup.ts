import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { seedCountries } from '../packages/server/src/modules/countries/helpers/seed-countries.helper.js';

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

  // Enforce latest migration by default for local runs
  if (!process.env.ENFORCE_LATEST_MIGRATION) {
    process.env.ENFORCE_LATEST_MIGRATION = '1';
    // eslint-disable-next-line no-console
    console.log('[test-setup] ENFORCE_LATEST_MIGRATION=1 (default)');
  }

  // Ensure core reference data exists outside per-test transactions
  // Specifically: countries table populated from CountryCode enum
  try {
    const { connectTestDb, closeTestDb } = await import(
      '../packages/server/src/__tests__/helpers/db-connection.js'
    );
    const pool = await connectTestDb();
    const client = await pool.connect();
    try {
      // Use the shared utility to seed all countries from CountryCode enum
      await seedCountries(client);
      // eslint-disable-next-line no-console
      console.log('[test-setup] Ensured all countries populated from enum');
    } finally {
      client.release();
      await closeTestDb();
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[test-setup] Failed to ensure countries reference data', e);
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
