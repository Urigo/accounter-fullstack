import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '../../../shared/helpers/index.js';
import { DBProvider } from '../../app-providers/db.provider.js';
import type {
  IDeleteBalanceCancellationByBusinessIdQuery,
  IGetBalanceCancellationByChargesIdsQuery,
} from '../types.js';

const getBalanceCancellationByChargesIds = sql<IGetBalanceCancellationByChargesIdsQuery>`
    SELECT *
    FROM accounter_schema.charge_balance_cancellation
    WHERE charge_id IN $$chargeIds;`;

const deleteBalanceCancellationByBusinessId = sql<IDeleteBalanceCancellationByBusinessIdQuery>`
    DELETE FROM accounter_schema.charge_balance_cancellation
    WHERE business_id = $businessId;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class BalanceCancellationProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  private async batchBalanceCancellationByChargesIds(ids: readonly string[]) {
    const ballanceCancellations = await getBalanceCancellationByChargesIds.run(
      {
        chargeIds: ids,
      },
      this.dbProvider,
    );
    return ids.map(id => ballanceCancellations.filter(record => record.charge_id === id));
  }

  public getBalanceCancellationByChargesIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchBalanceCancellationByChargesIds(keys),
    {
      cacheKeyFn: key => `balance-cancellation-charge-${key}`,
      cacheMap: this.cache,
    },
  );

  public deleteBalanceCancellationByBusinessId(businessId: string) {
    return deleteBalanceCancellationByBusinessId.run({ businessId }, this.dbProvider);
  }

  public clearCache() {
    this.cache.clear();
  }
}
