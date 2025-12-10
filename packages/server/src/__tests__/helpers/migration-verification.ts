import { Client, Pool, PoolClient } from 'pg';
import { LATEST_MIGRATION_NAME } from '../../../../migrations/src/run-pg-migrations.js';

export { LATEST_MIGRATION_NAME };

interface MigrationCheckResult {
  isLatest: boolean;
  latestMigrationName: string | undefined;
  errorMessage?: string;
}

/**
 * Check if the latest migration has been applied to the database.
 * Returns result object with status - does not throw.
 */
export async function checkLatestMigration(
  clientOrPool: Pool | PoolClient | Client,
  schema = 'accounter_schema',
): Promise<MigrationCheckResult> {
  let client: PoolClient | Client;
  let shouldRelease = false;

  if (clientOrPool instanceof Pool) {
    const poolClient = await clientOrPool.connect();
    client = poolClient;
    shouldRelease = true;
  } else {
    // It's already a Client or PoolClient
    client = clientOrPool;
  }

  try {
    const result = await client.query(
      `SELECT 1 FROM ${schema}.migration WHERE name = $1 LIMIT 1`,
      [LATEST_MIGRATION_NAME],
    );

    const isLatest = result.rowCount === 1;
    return {
      isLatest,
      latestMigrationName: LATEST_MIGRATION_NAME,
      errorMessage: isLatest
        ? undefined
        : `Latest migration "${LATEST_MIGRATION_NAME}" not found in database`,
    };
  } catch (error) {
    return {
      isLatest: false,
      latestMigrationName: LATEST_MIGRATION_NAME,
      errorMessage: `Failed to check migrations: ${error instanceof Error ? error.message : String(error)}`,
    };
  } finally {
    if (shouldRelease && 'release' in client) {
      await client.release();
    }
  }
}

/**
 * Assert that the latest migration has been applied.
 * Throws an error with helpful message if not.
 */
export async function assertLatestMigrationApplied(
  clientOrPool: Pool | PoolClient | Client,
  schema = 'accounter_schema',
): Promise<void> {
  const result = await checkLatestMigration(clientOrPool, schema);
  if (!result.isLatest) {
    throw new Error(
      result.errorMessage ||
        `Migration check failed for ${result.latestMigrationName}. Run: yarn workspace @accounter/migrations migration:run`,
    );
  }
}