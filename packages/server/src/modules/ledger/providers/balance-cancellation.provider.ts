import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type { IGetBalanceCancellationByChargesIdsQuery } from '../types.js';

const getBalanceCancellationByChargesIds = sql<IGetBalanceCancellationByChargesIdsQuery>`
    SELECT *
    FROM accounter_schema.charge_balance_cancellation
    WHERE charge_id IN $$chargeIds;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class BalanceCancellationProvider {
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
    { cache: false },
  );
}
