import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IDeleteBusinessTripOtherTransactionParams,
  IDeleteBusinessTripOtherTransactionQuery,
  IGetAllBusinessTripsOtherTransactionsQuery,
  IGetBusinessTripsOtherTransactionsByBusinessTripIdsQuery,
  IGetBusinessTripsOtherTransactionsByChargeIdsQuery,
  IGetBusinessTripsOtherTransactionsByIdsQuery,
  IInsertBusinessTripOtherTransactionParams,
  IInsertBusinessTripOtherTransactionQuery,
  IUpdateBusinessTripOtherTransactionParams,
  IUpdateBusinessTripOtherTransactionQuery,
} from '../types.js';

const getAllBusinessTripsOtherTransactions = sql<IGetAllBusinessTripsOtherTransactionsQuery>`
  SELECT*
  FROM accounter_schema.business_trips_transactions_other a
  LEFT JOIN accounter_schema.extended_business_trip_transactions t
    USING (id);`;

const getBusinessTripsOtherTransactionsByChargeIds = sql<IGetBusinessTripsOtherTransactionsByChargeIdsQuery>`
  SELECT btc.charge_id, a.*, t.business_trip_id, t.category, t.date, t.value_date, t.amount, t.currency, t.employee_business_id, t.payed_by_employee, t.transaction_ids
  FROM accounter_schema.business_trips_transactions_other a
  LEFT JOIN accounter_schema.extended_business_trip_transactions t
    USING (id)
  LEFT JOIN accounter_schema.business_trip_charges btc
    ON t.business_trip_id = btc.business_trip_id
  WHERE ($isChargeIds = 0 OR btc.charge_id IN $$chargeIds);`;

const getBusinessTripsOtherTransactionsByBusinessTripIds = sql<IGetBusinessTripsOtherTransactionsByBusinessTripIdsQuery>`
  SELECT *
  FROM accounter_schema.business_trips_transactions_other a
  LEFT JOIN accounter_schema.extended_business_trip_transactions t
    USING (id)
  WHERE ($isBusinessTripIds = 0 OR t.business_trip_id IN $$businessTripIds);`;

const getBusinessTripsOtherTransactionsByIds = sql<IGetBusinessTripsOtherTransactionsByIdsQuery>`
  SELECT *
  FROM accounter_schema.business_trips_transactions_other a
  LEFT JOIN accounter_schema.extended_business_trip_transactions t
    USING (id)
  WHERE ($isIds = 0 OR t.id IN $$transactionIds);`;

const updateBusinessTripOtherTransaction = sql<IUpdateBusinessTripOtherTransactionQuery>`
  UPDATE accounter_schema.business_trips_transactions_other
  SET
  deductible_expense = COALESCE(
    $deductibleExpense,
    deductible_expense
  ),
  description = COALESCE(
    $description,
    description
  )
  WHERE
    id = $businessTripTransactionId
  RETURNING *;
`;

const insertBusinessTripOtherTransaction = sql<IInsertBusinessTripOtherTransactionQuery>`
  INSERT INTO accounter_schema.business_trips_transactions_other (id, deductible_expense, description)
  VALUES($id, $deductibleExpense, $description)
  RETURNING *;`;

const deleteBusinessTripOtherTransaction = sql<IDeleteBusinessTripOtherTransactionQuery>`
  DELETE FROM accounter_schema.business_trips_transactions_other
  WHERE id = $businessTripTransactionId
  RETURNING id;
`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class BusinessTripOtherTransactionsProvider {
  constructor(private dbProvider: DBProvider) {}

  public getAllBusinessTripsOtherTransactions() {
    return getAllBusinessTripsOtherTransactions.run(undefined, this.dbProvider);
  }

  private async batchBusinessTripsOtherTransactionsByChargeIds(chargeIds: readonly string[]) {
    const businessTripsOtherTransactions = await getBusinessTripsOtherTransactionsByChargeIds.run(
      {
        isChargeIds: chargeIds.length > 0 ? 1 : 0,
        chargeIds,
      },
      this.dbProvider,
    );
    return chargeIds.map(id =>
      businessTripsOtherTransactions.filter(record => record.charge_id === id),
    );
  }

  public getBusinessTripsOtherTransactionsByChargeIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsOtherTransactionsByChargeIds(ids),
    {
      cache: false,
    },
  );

  private async batchBusinessTripsOtherTransactionsByBusinessTripIds(
    businessTripIds: readonly string[],
  ) {
    const businessTripsOtherTransactions =
      await getBusinessTripsOtherTransactionsByBusinessTripIds.run(
        {
          isBusinessTripIds: businessTripIds.length > 0 ? 1 : 0,
          businessTripIds,
        },
        this.dbProvider,
      );
    return businessTripIds.map(id =>
      businessTripsOtherTransactions.filter(record => record.business_trip_id === id),
    );
  }

  public getBusinessTripsOtherTransactionsByBusinessTripIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsOtherTransactionsByBusinessTripIds(ids),
    {
      cache: false,
    },
  );

  private async batchBusinessTripsOtherTransactionsByIds(transactionIds: readonly string[]) {
    const businessTripsOtherTransactions = await getBusinessTripsOtherTransactionsByIds.run(
      {
        isIds: transactionIds.length > 0 ? 1 : 0,
        transactionIds,
      },
      this.dbProvider,
    );
    return transactionIds.map(id =>
      businessTripsOtherTransactions.filter(record => record.id === id),
    );
  }

  public getBusinessTripsOtherTransactionsByIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsOtherTransactionsByIds(ids),
    {
      cache: false,
    },
  );

  public updateBusinessTripOtherTransaction(params: IUpdateBusinessTripOtherTransactionParams) {
    return updateBusinessTripOtherTransaction.run(params, this.dbProvider);
  }

  public insertBusinessTripOtherTransaction(params: IInsertBusinessTripOtherTransactionParams) {
    return insertBusinessTripOtherTransaction.run(params, this.dbProvider);
  }

  public deleteBusinessTripOtherTransaction(params: IDeleteBusinessTripOtherTransactionParams) {
    return deleteBusinessTripOtherTransaction.run(params, this.dbProvider);
  }
}
