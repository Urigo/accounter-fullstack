import DataLoader from 'dataloader';
import { CONTEXT, Inject, Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { reassureOwnerIdExists } from '../../../shared/helpers/index.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
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
  INSERT INTO accounter_schema.business_trips_transactions_match (business_trip_transaction_id, transaction_id, amount, owner_id)
  VALUES($businessTripExpenseId, $transactionId, $amount, $ownerId)
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
  scope: Scope.Operation,
  global: true,
})
export class BusinessTripExpensesTransactionsMatchProvider {
  constructor(
    private db: TenantAwareDBClient,
    @Inject(CONTEXT) private context: GraphQLModules.GlobalContext,
  ) {}

  private async batchBusinessTripsExpenseMatchesByTransactionIds(
    transactionIds: readonly string[],
  ) {
    const businessTrips = await getBusinessTripsExpenseMatchesByTransactionIds.run(
      {
        transactionIds: transactionIds as stringArray,
      },
      this.db,
    );
    return transactionIds.map(id => businessTrips.filter(record => record.transaction_id === id));
  }

  public getBusinessTripsExpenseMatchesByTransactionIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsExpenseMatchesByTransactionIds(ids),
  );

  private async batchBusinessTripsExpenseMatchesByExpenseIds(expenseIds: readonly string[]) {
    const businessTrips = await getBusinessTripsExpenseMatchesByExpenseIds.run(
      {
        expenseIds: expenseIds as stringArray,
      },
      this.db,
    );
    return expenseIds.map(id =>
      businessTrips.filter(record => record.business_trip_transaction_id === id),
    );
  }

  public getBusinessTripsExpenseMatchesByExpenseIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsExpenseMatchesByExpenseIds(ids),
  );

  public insertBusinessTripExpenseMatch(params: IInsertBusinessTripExpenseMatchParams) {
    if (params.businessTripExpenseId) {
      this.getBusinessTripsExpenseMatchesByExpenseIdLoader.clear(params.businessTripExpenseId);
    }
    if (params.transactionId) {
      this.getBusinessTripsExpenseMatchesByTransactionIdLoader.clear(params.transactionId);
    }
    return insertBusinessTripExpenseMatch.run(reassureOwnerIdExists(params, this.context), this.db);
  }

  public async deleteBusinessTripExpenseMatch(params: IDeleteBusinessTripExpenseMatchParams) {
    if (params.businessTripExpenseId) {
      const expenses = await this.getBusinessTripsExpenseMatchesByExpenseIdLoader.load(
        params.businessTripExpenseId,
      );
      expenses.map(expense => {
        this.getBusinessTripsExpenseMatchesByTransactionIdLoader.clear(expense.transaction_id);
      });
      this.getBusinessTripsExpenseMatchesByExpenseIdLoader.clear(params.businessTripExpenseId);
    }

    return deleteBusinessTripExpenseMatch.run(params, this.db);
  }

  public deleteSpecificBusinessTripExpenseMatch(
    params: IDeleteSpecificBusinessTripExpenseMatchParams,
  ) {
    if (params.businessTripExpenseId) {
      this.getBusinessTripsExpenseMatchesByExpenseIdLoader.clear(params.businessTripExpenseId);
    }
    if (params.transactionId) {
      this.getBusinessTripsExpenseMatchesByTransactionIdLoader.clear(params.transactionId);
    }
    return deleteSpecificBusinessTripExpenseMatch.run(params, this.db);
  }

  public clearCache() {
    this.getBusinessTripsExpenseMatchesByTransactionIdLoader.clearAll();
    this.getBusinessTripsExpenseMatchesByExpenseIdLoader.clearAll();
  }
}
