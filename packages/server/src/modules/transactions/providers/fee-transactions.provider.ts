import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IAddFeeTransactionParams,
  IAddFeeTransactionQuery,
  IDeleteFeeTransactionsByIdsParams,
  IDeleteFeeTransactionsByIdsQuery,
  IGetFeeTransactionsByIdsQuery,
  IUpdateFeeTransactionParams,
  IUpdateFeeTransactionQuery,
} from '../types.js';

const getFeeTransactionsByIds = sql<IGetFeeTransactionsByIdsQuery>`
    SELECT *
    FROM accounter_schema.transactions_fees
    WHERE id IN $$transactionIds;`;

const updateFeeTransaction = sql<IUpdateFeeTransactionQuery>`
  UPDATE accounter_schema.transactions_fees
  SET
  is_recurring = COALESCE(
      $isRecurring,
      is_recurring,
      NULL
    )
  WHERE
    id = $transactionId
  RETURNING *;
`;

const addFeeTransaction = sql<IAddFeeTransactionQuery>`
  INSERT INTO accounter_schema.transactions_fees (id, is_recurring)
  VALUES $$feeTransactions(id, isRecurring)
  ON CONFLICT DO NOTHING
  RETURNING *;`;

const deleteFeeTransactionsByIds = sql<IDeleteFeeTransactionsByIdsQuery>`
    DELETE FROM accounter_schema.transactions_fees
    WHERE id IN $$transactionIds;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class FeeTransactionsProvider {
  constructor(private dbProvider: DBProvider) {}

  private async batchFeeTransactionsByIds(ids: readonly string[]) {
    const transactions = await getFeeTransactionsByIds.run(
      {
        transactionIds: ids,
      },
      this.dbProvider,
    );
    return ids.map(id => transactions.find(charge => charge.id === id));
  }

  public getFeeTransactionByIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchFeeTransactionsByIds(keys),
    { cache: false },
  );

  public updateFeeTransaction(params: IUpdateFeeTransactionParams) {
    return updateFeeTransaction.run(params, this.dbProvider);
  }

  public addFeeTransaction(params: IAddFeeTransactionParams) {
    return addFeeTransaction.run(params, this.dbProvider);
  }

  public deleteFeeTransactionsByIds(params: IDeleteFeeTransactionsByIdsParams) {
    return deleteFeeTransactionsByIds.run(params, this.dbProvider);
  }
}
