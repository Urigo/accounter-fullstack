import { Pool } from 'pg';
import { checkLatestMigration } from '../packages/server/src/__tests__/helpers/migration-verification.js';

const testDbSchema = process.env.POSTGRES_SCHEMA || 'accounter_schema';

export async function setup() {
  // Check if migrations are current before running demo-seed tests
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT) || 5432,
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    database: process.env.POSTGRES_DB || 'accounter_test',
    ssl: process.env.POSTGRES_SSL === '1' ? { rejectUnauthorized: false } : false,
  });

  try {
    const result = await checkLatestMigration(pool, testDbSchema);

    if (!result.isLatest) {
      console.warn(`WARNING: ${result.errorMessage}`);
      console.warn(
        `  Run migrations before demo-seed tests: yarn workspace @accounter/migrations migration:run`,
      );
      console.warn(`  Demo-seed tests will fail.`);

      // Store flag to fail tests gracefully
      process.env.SKIP_DEMO_SEED_STALE_MIGRATIONS = '1';
    }
  } finally {
    await pool.end();
  }
}
