import { createPool as createSlonikPool, type DatabasePool } from 'slonik';
import { testDbConfig, testDbSchema } from './test-db-config.js';
import { runPGMigrations, LATEST_MIGRATION_NAME } from '../../../../migrations/src/run-pg-migrations.js';
import { debugLog, emitMetrics } from './diagnostics.js';
import { TestDbMigrationError } from './errors.js';
import type { Pool } from 'pg';

export { LATEST_MIGRATION_NAME } from '../../../../migrations/src/run-pg-migrations.js';

export async function runMigrationsIfNeeded(pgPool: Pool): Promise<void> {
  let needToRun = false;
  const client = await pgPool.connect();
  try {
    const existsRes = await client.query(
      `SELECT to_regclass($1) as reg` as any,
      [`${testDbSchema}.migration`],
    );
    const tableExists = Boolean(existsRes.rows?.[0]?.reg);
    if (!tableExists) {
      needToRun = true;
    } else if (LATEST_MIGRATION_NAME) {
      const latestExists = await client.query(
        `SELECT 1 FROM ${testDbSchema}.migration WHERE name = $1 LIMIT 1`,
        [LATEST_MIGRATION_NAME],
      );
      needToRun = latestExists.rowCount === 0;
    }
  } catch (err) {
    needToRun = true;
    debugLog('Migration state check failed, will attempt to run migrations');
  } finally {
    client.release();
  }

  if (!needToRun) {
    debugLog('Migrations appear up-to-date; skipping run');
    return;
  }

  const slonikPool: DatabasePool = await createSlonikPool(
    `postgres://${testDbConfig.user}:${testDbConfig.password}@${testDbConfig.host}:${testDbConfig.port}/${testDbConfig.database}`,
    { statementTimeout: 10 * 60 * 1000 },
  );

  try {
    await runPGMigrations({ slonik: slonikPool });
    emitMetrics('migrations-ran', pgPool);
  } catch (err) {
    throw new TestDbMigrationError('Failed to run migrations', err);
  } finally {
    await slonikPool.end();
  }
}
