import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type {
  IDeleteBalanceCancellationByBusinessIdQuery,
  IDeleteBalanceCancellationByChargeIdsQuery,
  IGetBalanceCancellationByChargesIdsQuery,
} from '../types.js';

const getBalanceCancellationByChargesIds = sql<IGetBalanceCancellationByChargesIdsQuery>`
    SELECT *
    FROM accounter_schema.charge_balance_cancellation
    WHERE charge_id IN $$chargeIds;`;

const deleteBalanceCancellationByBusinessId = sql<IDeleteBalanceCancellationByBusinessIdQuery>`
    DELETE FROM accounter_schema.charge_balance_cancellation
    WHERE business_id = $businessId;`;

const deleteBalanceCancellationByChargeIds = sql<IDeleteBalanceCancellationByChargeIdsQuery>`
    DELETE FROM accounter_schema.charge_balance_cancellation
    WHERE charge_id IN $$chargeIds;`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class BalanceCancellationProvider {
  constructor(private db: TenantAwareDBClient) {}

  private async batchBalanceCancellationByChargesIds(ids: readonly string[]) {
    const ballanceCancellations = await getBalanceCancellationByChargesIds.run(
      {
        chargeIds: ids,
      },
      this.db,
    );
    return ids.map(id => ballanceCancellations.filter(record => record.charge_id === id));
  }

  public getBalanceCancellationByChargesIdLoader = new DataLoader((keys: readonly string[]) =>
    this.batchBalanceCancellationByChargesIds(keys),
  );

  public deleteBalanceCancellationByBusinessId(businessId: string) {
    return deleteBalanceCancellationByBusinessId.run({ businessId }, this.db);
  }

  public deleteBalanceCancellationByChargeIds(chargeIds: readonly string[]) {
    chargeIds.map(id => this.getBalanceCancellationByChargesIdLoader.clear(id));
    return deleteBalanceCancellationByChargeIds.run({ chargeIds }, this.db);
  }

  public clearCache() {
    this.getBalanceCancellationByChargesIdLoader.clearAll();
  }
}
