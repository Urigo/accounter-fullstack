import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '../../../shared/helpers/index.js';
import { DBProvider } from '../../app-providers/db.provider.js';
import { stringArray } from '../../charges/types.js';
import type {
  IDeleteBusinessTripExpenseMatchParams,
  IDeleteBusinessTripExpenseMatchQuery,
  IDeleteSpecificBusinessTripExpenseMatchParams,
  IDeleteSpecificBusinessTripExpenseMatchQuery,
  IGetBusinessTripsExpenseMatchesByExpenseIdsQuery,
  IGetBusinessTripsExpenseMatchesByTransactionIdsQuery,
  IInsertBusinessTripExpenseMatchParams,
  IInsertBusinessTripExpenseMatchQuery,
} from '../types.js';

const getBusinessTripsExpenseMatchesByTransactionIds = sql<IGetBusinessTripsExpenseMatchesByTransactionIdsQuery>`
  SELECT *
  FROM accounter_schema.business_trips_transactions_match
  WHERE transaction_id in $$transactionIds;`;

const getBusinessTripsExpenseMatchesByExpenseIds = sql<IGetBusinessTripsExpenseMatchesByExpenseIdsQuery>`
  SELECT *
  FROM accounter_schema.business_trips_transactions_match
  WHERE business_trip_transaction_id in $$expenseIds;`;

const insertBusinessTripExpenseMatch = sql<IInsertBusinessTripExpenseMatchQuery>`
  INSERT INTO accounter_schema.business_trips_transactions_match (business_trip_transaction_id, transaction_id, amount)
  VALUES($businessTripExpenseId, $transactionId, $amount)
  RETURNING *;`;

const deleteBusinessTripExpenseMatch = sql<IDeleteBusinessTripExpenseMatchQuery>`
  DELETE FROM accounter_schema.business_trips_transactions_match
  WHERE business_trip_transaction_id = $businessTripExpenseId
  RETURNING *;`;

const deleteSpecificBusinessTripExpenseMatch = sql<IDeleteSpecificBusinessTripExpenseMatchQuery>`
  DELETE FROM accounter_schema.business_trips_transactions_match
  WHERE business_trip_transaction_id = $businessTripExpenseId
    AND transaction_id = $transactionId
  RETURNING *;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class BusinessTripExpensesTransactionsMatchProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  private async batchBusinessTripsExpenseMatchesByTransactionIds(
    transactionIds: readonly string[],
  ) {
    const businessTrips = await getBusinessTripsExpenseMatchesByTransactionIds.run(
      {
        transactionIds: transactionIds as stringArray,
      },
      this.dbProvider,
    );
    return transactionIds.map(id => businessTrips.filter(record => record.transaction_id === id));
  }

  public getBusinessTripsExpenseMatchesByTransactionIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsExpenseMatchesByTransactionIds(ids),
    {
      cacheKeyFn: key => `business-trip-expense-match-transaction-${key}`,
      cacheMap: this.cache,
    },
  );

  private async batchBusinessTripsExpenseMatchesByExpenseIds(expenseIds: readonly string[]) {
    const businessTrips = await getBusinessTripsExpenseMatchesByExpenseIds.run(
      {
        expenseIds: expenseIds as stringArray,
      },
      this.dbProvider,
    );
    return expenseIds.map(id =>
      businessTrips.filter(record => record.business_trip_transaction_id === id),
    );
  }

  public getBusinessTripsExpenseMatchesByExpenseIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsExpenseMatchesByExpenseIds(ids),
    {
      cacheKeyFn: key => `business-trip-expense-${key}-match`,
      cacheMap: this.cache,
    },
  );

  public insertBusinessTripExpenseMatch(params: IInsertBusinessTripExpenseMatchParams) {
    if (params.businessTripExpenseId) {
      this.cache.delete(`business-trip-expense-${params.businessTripExpenseId}-match`);
    }
    if (params.transactionId) {
      this.cache.delete(`business-trip-expense-match-transaction-${params.transactionId}`);
    }
    return insertBusinessTripExpenseMatch.run(params, this.dbProvider);
  }

  public async deleteBusinessTripExpenseMatch(params: IDeleteBusinessTripExpenseMatchParams) {
    if (params.businessTripExpenseId) {
      const expenses = await this.getBusinessTripsExpenseMatchesByExpenseIdLoader.load(
        params.businessTripExpenseId,
      );
      expenses.map(expense => {
        this.cache.delete(`business-trip-expense-match-transaction-${expense.transaction_id}`);
      });
      this.cache.delete(`business-trip-expense-${params.businessTripExpenseId}-match`);
    }

    return deleteBusinessTripExpenseMatch.run(params, this.dbProvider);
  }

  public deleteSpecificBusinessTripExpenseMatch(
    params: IDeleteSpecificBusinessTripExpenseMatchParams,
  ) {
    if (params.businessTripExpenseId) {
      this.cache.delete(`business-trip-expense-${params.businessTripExpenseId}-match`);
    }
    if (params.transactionId) {
      this.cache.delete(`business-trip-expense-match-transaction-${params.transactionId}`);
    }
    return deleteSpecificBusinessTripExpenseMatch.run(params, this.dbProvider);
  }

  public clearCache() {
    this.cache.clear();
  }
}
