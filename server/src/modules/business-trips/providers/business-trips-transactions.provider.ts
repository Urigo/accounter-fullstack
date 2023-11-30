import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IGetAllBusinessTripsTransactionsQuery,
  IGetBusinessTripsTransactionsByChargeIdsQuery,
  IInsertBusinessTripTransactionParams,
  IInsertBusinessTripTransactionQuery,
  IUpdateBusinessTripTransactionParams,
  IUpdateBusinessTripTransactionQuery,
} from '../types.js';

const getAllBusinessTripsTransactions = sql<IGetAllBusinessTripsTransactionsQuery>`
  SELECT *
  FROM accounter_schema.business_trips_transactions`;

const getBusinessTripsTransactionsByChargeIds = sql<IGetBusinessTripsTransactionsByChargeIdsQuery>`
  SELECT btc.charge_id, btt.*
  FROM accounter_schema.business_trips_transactions btt
  LEFT JOIN accounter_schema.business_trip_charges btc
    ON btt.business_trip_id = btc.business_trip_id
  WHERE ($isChargeIds = 0 OR btc.charge_id IN $$chargeIds);`;

const updateBusinessTripTransaction = sql<IUpdateBusinessTripTransactionQuery>`
  UPDATE accounter_schema.business_trips_transactions
  SET
  business_trip_id = COALESCE(
    $businessTripId,
    business_trip_id
  ),
  category = COALESCE(
    $category,
    category
  ),
  date = COALESCE(
    $date,
    date
  ),
  amount = COALESCE(
    $amount,
    amount
  ),
  currency = COALESCE(
    $currency,
    currency
  ),
  employee_business_id = COALESCE(
    $employeeBusinessId,
    employee_business_id
  ),
  transaction_id = COALESCE(
    $transactionId,
    transaction_id
  )
  WHERE
    id = $businessTripTransactionId
  RETURNING *;
`;

const insertBusinessTripTransaction = sql<IInsertBusinessTripTransactionQuery>`
  INSERT INTO accounter_schema.business_trips_transactions (business_trip_id, category, date, amount, currency, employee_business_id, transaction_id)
  VALUES($business_trip_id, $category, $date, $amount, $currency, $employeeBusinessId, $transactionId)
  RETURNING *;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class BusinessTripTransactionsProvider {
  constructor(private dbProvider: DBProvider) {}

  public getAllBusinessTripsTransactions() {
    return getAllBusinessTripsTransactions.run(undefined, this.dbProvider);
  }

  private async batchBusinessTripsTransactionsByChargeIds(chargeIds: readonly string[]) {
    const businessTrips = await getBusinessTripsTransactionsByChargeIds.run(
      {
        isChargeIds: chargeIds.length > 0 ? 1 : 0,
        chargeIds,
      },
      this.dbProvider,
    );
    return chargeIds.map(id => businessTrips.find(record => record.charge_id === id));
  }

  public getBusinessTripsTransactionsByChargeIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsTransactionsByChargeIds(ids),
    {
      cache: false,
    },
  );

  public updateBusinessTripTransaction(params: IUpdateBusinessTripTransactionParams) {
    return updateBusinessTripTransaction.run(params, this.dbProvider);
  }

  public insertBusinessTripTransaction(params: IInsertBusinessTripTransactionParams) {
    return insertBusinessTripTransaction.run(params, this.dbProvider);
  }
}
