import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectTestDb } from '../../../__tests__/helpers/db-connection.js';
import { runMigrationsIfNeeded } from '../../../__tests__/helpers/db-migrations.js';
import type {
  CbsPriceIndexClient,
  CbsPriceIndexEntry,
} from '../../app-providers/cbs-price-index-client.js';
import { DBProvider } from '../../app-providers/db.provider.js';
import type { TimelessDateString } from '../../../shared/types/index.js';
import { PriceIndexSyncProvider } from '../providers/price-index-sync.provider.js';
import { PriceIndexesProvider } from '../providers/price-indexes.provider.js';

// A fake index code, so the test never touches the real (global) CPI rows
const TEST_INDEX_CODE = 999_001;

const OLD_BASE = 'Average 2022';
const NEW_BASE = 'Average 2024';

function entry(
  year: number,
  month: number,
  value: number,
  baseLabel: string,
  withChain = false,
): CbsPriceIndexEntry {
  return {
    indexCode: TEST_INDEX_CODE,
    year,
    month,
    value,
    baseLabel,
    monthlyChangePct: 0.1,
    yearlyChangePct: 1.2,
    previousBases:
      withChain && baseLabel === NEW_BASE ? [{ baseLabel: OLD_BASE, coefficient: 1.074 }] : [],
  };
}

// CBS returns newest first
const HISTORY = [entry(2024, 12, 108.4, OLD_BASE), entry(2024, 11, 108.7, OLD_BASE)];

function createClient(values: () => CbsPriceIndexEntry[], latestWithChain: CbsPriceIndexEntry) {
  return {
    fetchValues: vi.fn(async () => values()),
    fetchLatestWithChain: vi.fn(async () => latestWithChain),
  };
}

let pool: Pool;
let dbProvider: DBProvider;

async function clearTestRows() {
  await pool.query('DELETE FROM accounter_schema.price_index_values WHERE index_code = $1', [
    TEST_INDEX_CODE,
  ]);
  await pool.query('DELETE FROM accounter_schema.price_index_bases WHERE index_code = $1', [
    TEST_INDEX_CODE,
  ]);
}

async function countTestRows() {
  const { rows } = await pool.query(
    'SELECT count(*)::int AS count FROM accounter_schema.price_index_values WHERE index_code = $1',
    [TEST_INDEX_CODE],
  );
  return rows[0].count as number;
}

beforeAll(async () => {
  pool = await connectTestDb();
  await runMigrationsIfNeeded(pool);
  dbProvider = new DBProvider(pool);
});

beforeEach(clearTestRows);

afterAll(clearTestRows);

describe('PriceIndexSyncProvider', () => {
  it('backfills, then skips until the next index is due, then adds a new base', async () => {
    const values = { current: HISTORY };
    const client = createClient(() => values.current, entry(2024, 12, 108.4, OLD_BASE));
    const sync = new PriceIndexSyncProvider(dbProvider, client as unknown as CbsPriceIndexClient);

    // Full backfill on an empty table
    const [first] = await sync.sync({
      indexCodes: [TEST_INDEX_CODE],
      now: new Date('2025-01-20T12:00:00Z'),
    });
    expect(first).toMatchObject({ inserted: 2, updated: 0, basesUpserted: 1, skipped: false });
    expect(client.fetchValues).toHaveBeenCalledWith(TEST_INDEX_CODE);

    // January 2025 is not due before Feb 10th: CBS is not called
    client.fetchValues.mockClear();
    const [skipped] = await sync.sync({
      indexCodes: [TEST_INDEX_CODE],
      now: new Date('2025-02-05T12:00:00Z'),
    });
    expect(skipped.skipped).toBe(true);
    expect(client.fetchValues).not.toHaveBeenCalled();

    // January 2025 arrives in a new base, published early (seen on Feb 14th)
    values.current = [entry(2025, 1, 101.5, NEW_BASE, true), ...HISTORY];
    const [incremental] = await sync.sync({
      indexCodes: [TEST_INDEX_CODE],
      now: new Date('2025-02-14T17:00:00Z'),
    });
    expect(incremental).toMatchObject({ inserted: 1, updated: 0, skipped: false });
    expect(client.fetchValues).toHaveBeenCalledWith(TEST_INDEX_CODE, {
      startPeriod: '2024-10',
      withCoefficients: true,
    });

    const { rows: bases } = await pool.query(
      'SELECT base_label, first_period, chain_coefficient, chained_factor FROM accounter_schema.price_index_bases WHERE index_code = $1 ORDER BY first_period',
      [TEST_INDEX_CODE],
    );
    expect(bases).toEqual([
      { base_label: OLD_BASE, first_period: '2024-11-01', chain_coefficient: null, chained_factor: '1' },
      { base_label: NEW_BASE, first_period: '2025-01-01', chain_coefficient: '1.074', chained_factor: '1.074' },
    ]);

    // Reads go through the provider: the change across the base change is chained
    const provider = new PriceIndexesProvider(dbProvider);
    const jan = await provider.getIndexForPeriod('2025-01-01' as TimelessDateString, TEST_INDEX_CODE);
    expect(jan).toMatchObject({ value: 101.5, baseLabel: NEW_BASE, publishedOn: '2025-02-14' });
    const linkage = await provider.linkAmount(
      100,
      { date: '2025-01-10' as TimelessDateString },
      { date: '2025-02-15' as TimelessDateString },
      TEST_INDEX_CODE,
    );
    expect(linkage.fromIndex.period).toBe('2024-11-01');
    expect(linkage.toIndex.period).toBe('2025-01-01');
    expect(linkage.ratio).toBeCloseTo((101.5 * 1.074) / 108.7, 12);
  });

  it('is idempotent and never overwrites a corrected publication date', async () => {
    const client = createClient(() => HISTORY, entry(2024, 12, 108.4, OLD_BASE));
    const sync = new PriceIndexSyncProvider(dbProvider, client as unknown as CbsPriceIndexClient);
    const now = new Date('2025-01-20T12:00:00Z');

    await sync.sync({ indexCodes: [TEST_INDEX_CODE], now });
    await pool.query(
      `UPDATE accounter_schema.price_index_values SET published_on = '2025-01-14'
       WHERE index_code = $1 AND period = '2024-12-01'`,
      [TEST_INDEX_CODE],
    );

    const [again] = await sync.sync({ indexCodes: [TEST_INDEX_CODE], now, full: true });
    expect(again).toMatchObject({ inserted: 0, updated: 0, basesUpserted: 0, skipped: false });

    const { rows } = await pool.query(
      `SELECT published_on FROM accounter_schema.price_index_values
       WHERE index_code = $1 AND period = '2024-12-01'`,
      [TEST_INDEX_CODE],
    );
    expect(rows[0].published_on).toBe('2025-01-14');
  });

  it('refuses to write values on a different chain scale than stored bases', async () => {
    const values = { current: HISTORY };
    const client = createClient(() => values.current, entry(2024, 12, 108.4, OLD_BASE));
    const sync = new PriceIndexSyncProvider(dbProvider, client as unknown as CbsPriceIndexClient);
    // Backfill: "Average 2022" is the oldest stored base, with factor 1
    await sync.sync({ indexCodes: [TEST_INDEX_CODE], now: new Date('2025-01-20T12:00:00Z') });

    // CBS now returns a longer chain, anchored one base further back
    values.current = [
      entry(2025, 1, 101.5, NEW_BASE),
      {
        ...entry(2024, 12, 108.4, OLD_BASE),
        previousBases: [{ baseLabel: 'Average 2020', coefficient: 1.059 }],
      },
    ];

    await expect(
      sync.sync({ indexCodes: [TEST_INDEX_CODE], now: new Date('2025-02-14T17:00:00Z') }),
    ).rejects.toThrow(/Chain factor of base "Average 2022"/);
    expect(await countTestRows()).toBe(2);
  });

  it('skips while another instance holds the sync lock', async () => {
    const client = createClient(() => HISTORY, entry(2024, 12, 108.4, OLD_BASE));
    const sync = new PriceIndexSyncProvider(dbProvider, client as unknown as CbsPriceIndexClient);

    const holder = await pool.connect();
    try {
      await holder.query('BEGIN');
      await holder.query("SELECT pg_advisory_xact_lock(hashtext('accounter.price_index_sync'))");
      const [result] = await sync.sync({ indexCodes: [TEST_INDEX_CODE] });
      expect(result.skipped).toBe(true);
      expect(await countTestRows()).toBe(0);
    } finally {
      await holder.query('ROLLBACK');
      holder.release();
    }
  });
});
