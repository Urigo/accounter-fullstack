import { Pool } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkLatestMigration, LATEST_MIGRATION_NAME } from './migration-verification.js';

/**
 * `checkLatestMigration` reports; it does not throw. A vitest global setup calls it
 * (`scripts/vitest-demo-seed-setup.ts`), and a global setup that throws stops the whole run,
 * the projects that need no database included.
 *
 * No database is involved: the pool points at a local port nothing listens on, and the client
 * is a stand-in.
 */
describe('checkLatestMigration', () => {
  const pools: Pool[] = [];

  afterEach(async () => {
    await Promise.all(pools.splice(0).map(pool => pool.end()));
  });

  it('reports a pool that cannot connect instead of throwing', async () => {
    const pool = new Pool({ host: '127.0.0.1', port: 1, connectionTimeoutMillis: 2000 });
    pools.push(pool);

    const result = await checkLatestMigration(pool);

    expect(result.isLatest).toBe(false);
    expect(result.latestMigrationName).toBe(LATEST_MIGRATION_NAME);
    expect(result.errorMessage).toMatch(/^Failed to check migrations: .*ECONNREFUSED/);
  });

  it('reports a failed lookup on a client it was handed, and leaves that client to its owner', async () => {
    const client = {
      query: vi.fn().mockRejectedValue(new Error('relation "nowhere.migration" does not exist')),
      release: vi.fn(),
    };

    const result = await checkLatestMigration(client as never, 'nowhere');

    expect(result).toMatchObject({
      isLatest: false,
      errorMessage: 'Failed to check migrations: relation "nowhere.migration" does not exist',
    });
    expect(client.release).not.toHaveBeenCalled();
  });

  it('says so when the latest migration is there, and when it is not', async () => {
    const found = { query: vi.fn().mockResolvedValue({ rowCount: 1 }) };
    const missing = { query: vi.fn().mockResolvedValue({ rowCount: 0 }) };

    await expect(checkLatestMigration(found as never)).resolves.toMatchObject({ isLatest: true });
    await expect(checkLatestMigration(missing as never)).resolves.toMatchObject({
      isLatest: false,
      errorMessage: `Latest migration "${LATEST_MIGRATION_NAME}" not found in database`,
    });
  });
});
