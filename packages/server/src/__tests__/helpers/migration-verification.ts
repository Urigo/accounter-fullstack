import { type Client, Pool, type PoolClient } from 'pg';
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
  let client: PoolClient | Client | undefined;
  let shouldRelease = false;

  try {
    if (clientOrPool instanceof Pool) {
      // Inside the try: a pool that cannot connect is a failed check to report, like a failed
      // query. Thrown from here it would escape a vitest global setup and stop the whole run.
      client = await clientOrPool.connect();
      shouldRelease = true;
    } else {
      // It's already a Client or PoolClient
      client = clientOrPool;
    }

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
    // A refused connection to `localhost` is an AggregateError with an empty message; its code
    // still says what happened.
    const reason =
      error instanceof Error && error.message !== ''
        ? error.message
        : ((error as { code?: unknown } | null)?.code ?? String(error));
    return {
      isLatest: false,
      latestMigrationName: LATEST_MIGRATION_NAME,
      errorMessage: `Failed to check migrations: ${reason}`,
    };
  } finally {
    if (shouldRelease && client && 'release' in client) {
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
        `Migration check failed for ${result.latestMigrationName}. Run: yarn workspace @accounter-helper/migrations migration:run`,
    );
  }
}
