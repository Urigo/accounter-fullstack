import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type { IGetOldLedgerByChargeIdsQuery } from '../__generated__/temp.types';

const getOldLedgerByChargeIds = sql<IGetOldLedgerByChargeIdsQuery>`
    SELECT DISTINCT t.charge_id, l.*
FROM accounter_schema.ledger l
LEFT JOIN accounter_schema.all_transactions at
    ON l.original_id = at.id
LEFT JOIN (SELECT id,
    (COALESCE(poalim_ils_id::TEXT, poalim_eur_id::TEXT, poalim_gbp_id::TEXT, poalim_usd_id::TEXT, creditcard_id::TEXT, kraken_id, etana_id, etherscan_id::TEXT)) AS source_id
        FROM accounter_schema.transactions_raw_list) AS tr
    ON tr.source_id = at.original_id
LEFT JOIN accounter_schema.transactions t
    ON t.source_id = tr.id
WHERE t.charge_id IN $$chargeIds;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class TempProvider {
  cache = getCacheInstance();

  constructor(private dbProvider: DBProvider) {}

  private async batchOldLedgerByChargeIds(ids: readonly string[]) {
    const ledger = await getOldLedgerByChargeIds.run(
      {
        chargeIds: ids,
      },
      this.dbProvider,
    );
    return ids.map(id => ledger.filter(l => l.charge_id === id));
  }

  public getOldLedgerByChargeIdsLoader = new DataLoader(
    (keys: readonly string[]) => this.batchOldLedgerByChargeIds(keys),
    { cacheMap: this.cache },
  );
}
