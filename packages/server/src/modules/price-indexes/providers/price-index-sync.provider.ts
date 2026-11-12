import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { CbsPriceIndexClient } from '../../app-providers/cbs-price-index-client.js';
import { DBProvider } from '../../app-providers/db.provider.js';
import { addMonths, CPI_INDEX_CODE, periodToYearMonth } from '../helpers/price-index.helper.js';
import {
  assertChainsMatchKnownBases,
  buildSyncRows,
  computeChainFactors,
  isNextIndexDue,
  todayInIsrael,
} from '../helpers/sync-price-indexes.helper.js';
import type {
  IGetLatestPriceIndexPeriodQuery,
  IGetPriceIndexBasesForSyncQuery,
  ITryLockPriceIndexSyncQuery,
  IUpsertPriceIndexBasesQuery,
  IUpsertPriceIndexValuesQuery,
} from '../types.js';

const tryLockPriceIndexSync = sql<ITryLockPriceIndexSyncQuery>`
  SELECT pg_try_advisory_xact_lock(hashtext('accounter.price_index_sync')) AS locked;
`;

const getLatestPriceIndexPeriod = sql<IGetLatestPriceIndexPeriodQuery>`
  SELECT max(period) AS latest_period
  FROM accounter_schema.price_index_values
  WHERE index_code = $indexCode!;
`;

const getPriceIndexBasesForSync = sql<IGetPriceIndexBasesForSyncQuery>`
  SELECT base_label, first_period, chain_coefficient, chained_factor
  FROM accounter_schema.price_index_bases
  WHERE index_code = $indexCode!;
`;

const upsertPriceIndexBases = sql<IUpsertPriceIndexBasesQuery>`
  INSERT INTO accounter_schema.price_index_bases
    (index_code, base_label, first_period, chain_coefficient, chained_factor)
  VALUES $$bases(indexCode, baseLabel, firstPeriod, chainCoefficient, chainedFactor)
  ON CONFLICT (index_code, base_label) DO UPDATE SET
    first_period = LEAST(price_index_bases.first_period, EXCLUDED.first_period),
    chain_coefficient = EXCLUDED.chain_coefficient,
    chained_factor = EXCLUDED.chained_factor
  WHERE price_index_bases.first_period > EXCLUDED.first_period
    OR price_index_bases.chain_coefficient IS DISTINCT FROM EXCLUDED.chain_coefficient
    OR price_index_bases.chained_factor <> EXCLUDED.chained_factor
  RETURNING base_label, (xmax = 0) AS inserted;
`;

// published_on is never overwritten: a manually corrected publication date must survive re-syncs
const upsertPriceIndexValues = sql<IUpsertPriceIndexValuesQuery>`
  INSERT INTO accounter_schema.price_index_values
    (index_code, period, value, base_label, chained_value, monthly_change_pct, yearly_change_pct, published_on)
  VALUES $$values(indexCode, period, value, baseLabel, chainedValue, monthlyChangePct, yearlyChangePct, publishedOn)
  ON CONFLICT (index_code, period) DO UPDATE SET
    value = EXCLUDED.value,
    base_label = EXCLUDED.base_label,
    chained_value = EXCLUDED.chained_value,
    monthly_change_pct = EXCLUDED.monthly_change_pct,
    yearly_change_pct = EXCLUDED.yearly_change_pct,
    updated_at = now()
  WHERE price_index_values.value <> EXCLUDED.value
    OR price_index_values.base_label <> EXCLUDED.base_label
    OR price_index_values.chained_value <> EXCLUDED.chained_value
    OR price_index_values.monthly_change_pct IS DISTINCT FROM EXCLUDED.monthly_change_pct
    OR price_index_values.yearly_change_pct IS DISTINCT FROM EXCLUDED.yearly_change_pct
  RETURNING period, (xmax = 0) AS inserted;
`;

export type PriceIndexSyncResult = {
  indexCode: number;
  inserted: number;
  updated: number;
  basesUpserted: number;
  /** True when CBS was not called (no new index expected yet) or another instance holds the sync lock */
  skipped: boolean;
};

/**
 * Pulls CBS price indexes into the global `price_index_*` tables.
 *
 * Runs both inside GraphQL (super-admin mutation) and outside DI (the server's scheduled job),
 * so it depends only on `DBProvider` and the CBS client.
 */
@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class PriceIndexSyncProvider {
  constructor(
    private dbProvider: DBProvider,
    private cbsClient: CbsPriceIndexClient,
  ) {}

  public async sync(
    options: { indexCodes?: number[]; full?: boolean; now?: Date } = {},
  ): Promise<PriceIndexSyncResult[]> {
    const results: PriceIndexSyncResult[] = [];
    for (const indexCode of options.indexCodes ?? [CPI_INDEX_CODE]) {
      results.push(await this.syncIndex(indexCode, !!options.full, options.now ?? new Date()));
    }
    return results;
  }

  private async syncIndex(indexCode: number, full: boolean, now: Date) {
    const result: PriceIndexSyncResult = {
      indexCode,
      inserted: 0,
      updated: 0,
      basesUpserted: 0,
      skipped: false,
    };
    const today = todayInIsrael(now);

    // Decide and fetch outside any transaction: CBS calls can take a while, and a pooled
    // connection must not sit idle-in-transaction meanwhile. The upserts are idempotent, so the
    // advisory lock only needs to guard the write phase below.
    const [{ latest_period: latestPeriod } = { latest_period: null }] =
      await getLatestPriceIndexPeriod.run({ indexCode }, this.dbProvider);
    const isIncremental = !full && !!latestPeriod;
    if (isIncremental && !isNextIndexDue(latestPeriod, today)) {
      return { ...result, skipped: true };
    }

    // Incremental runs re-fetch a short overlap with coefficients, so a new base (each odd
    // January) arrives together with its chain. Full runs fetch the chain once and the
    // (much larger) history without per-row coefficients.
    const entries = isIncremental
      ? await this.cbsClient.fetchValues(indexCode, {
          startPeriod: periodToYearMonth(addMonths(latestPeriod, -2)),
          withCoefficients: true,
        })
      : await this.cbsClient.fetchValues(indexCode);
    const chainSource = isIncremental
      ? entries.find(entry => entry.previousBases.length > 0)
      : await this.cbsClient.fetchLatestWithChain(indexCode);
    const chains = chainSource ? computeChainFactors(chainSource) : new Map();

    const client = await this.dbProvider.pool.connect();
    try {
      await client.query('BEGIN');
      const [{ locked } = { locked: false }] = await tryLockPriceIndexSync.run(undefined, client);
      if (!locked) {
        await client.query('ROLLBACK');
        return { ...result, skipped: true };
      }

      // Read stored bases under the lock, so a concurrent writer's bases are taken into account
      const knownBases = (await getPriceIndexBasesForSync.run({ indexCode }, client)).map(base => ({
        baseLabel: base.base_label,
        firstPeriod: base.first_period,
        chainCoefficient: base.chain_coefficient == null ? null : Number(base.chain_coefficient),
        chainedFactor: Number(base.chained_factor),
      }));
      assertChainsMatchKnownBases(chains, knownBases, indexCode);

      const { bases, values } = buildSyncRows({ indexCode, entries, chains, knownBases, today });

      if (bases.length > 0) {
        const upsertedBases = await upsertPriceIndexBases.run(
          { bases: bases.map(base => ({ ...base, indexCode })) },
          client,
        );
        result.basesUpserted = upsertedBases.length;
      }
      if (values.length > 0) {
        const upserted = await upsertPriceIndexValues.run({ values }, client);
        for (const row of upserted) {
          if (row.inserted) {
            result.inserted++;
          } else {
            result.updated++;
          }
        }
        if (result.updated > 0 && latestPeriod) {
          // Published CBS price indexes are final; a changed value is worth a look
          console.warn(
            `[price-index-sync] ${result.updated} existing value(s) of index ${indexCode} changed upstream`,
            upserted.filter(row => !row.inserted).map(row => row.period),
          );
        }
      }

      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
}
