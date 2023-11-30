import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IGetAllBusinessTripsFlightsTransactionsQuery,
  IGetBusinessTripsFlightsTransactionsByChargeIdsQuery,
  IInsertBusinessTripFlightTransactionParams,
  IInsertBusinessTripFlightTransactionQuery,
  IUpdateBusinessTripFlightTransactionParams,
  IUpdateBusinessTripFlightTransactionQuery,
} from '../types.js';

const getAllBusinessTripsFlightsTransactions = sql<IGetAllBusinessTripsFlightsTransactionsQuery>`
  SELECT f.*, t.business_trip_id, t.category, t.date, t.amount, t.currency, t.employee_business_id, t.transaction_id
  FROM accounter_schema.business_trips_transactions_flights f
  LEFT JOIN accounter_schema.business_trips_transactions t
    ON f.id = t.id`;

const getBusinessTripsFlightsTransactionsByChargeIds = sql<IGetBusinessTripsFlightsTransactionsByChargeIdsQuery>`
  SELECT btc.charge_id, f.*, t.business_trip_id, t.category, t.date, t.amount, t.currency, t.employee_business_id, t.transaction_id
  FROM accounter_schema.business_trips_transactions_flights f
  LEFT JOIN accounter_schema.business_trips_transactions t
    ON f.id = t.id
  LEFT JOIN accounter_schema.business_trip_charges btc
    ON t.business_trip_id = btc.business_trip_id
  WHERE ($isChargeIds = 0 OR btc.charge_id IN $$chargeIds);`;

const updateBusinessTripFlightTransaction = sql<IUpdateBusinessTripFlightTransactionQuery>`
  UPDATE accounter_schema.business_trips_transactions_flights
  SET
  payed_by_employee = COALESCE(
    $payedByEmployee,
    payed_by_employee
  ),
  origin = COALESCE(
    $origin,
    origin
  ),
  destination = COALESCE(
    $destination,
    destination
  ),
  class = COALESCE(
    $class,
    class
  )
  WHERE
    id = $businessTripTransactionId
  RETURNING *;
`;

const insertBusinessTripFlightTransaction = sql<IInsertBusinessTripFlightTransactionQuery>`
  INSERT INTO accounter_schema.business_trips_transactions_flights (id, payed_by_employee, origin, destination, class)
  VALUES($id, $payedByEmployee, $origin, $destination, $class)
  RETURNING *;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class BusinessTripFlightsTransactionsProvider {
  constructor(private dbProvider: DBProvider) {}

  public getAllBusinessTripsFlightsTransactions() {
    return getAllBusinessTripsFlightsTransactions.run(undefined, this.dbProvider);
  }

  private async batchBusinessTripsFlightsTransactionsByChargeIds(chargeIds: readonly string[]) {
    const businessTripsFlightsTransactions =
      await getBusinessTripsFlightsTransactionsByChargeIds.run(
        {
          isChargeIds: chargeIds.length > 0 ? 1 : 0,
          chargeIds,
        },
        this.dbProvider,
      );
    return chargeIds.map(id =>
      businessTripsFlightsTransactions.find(record => record.charge_id === id),
    );
  }

  public getBusinessTripsFlightsTransactionsByChargeIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsFlightsTransactionsByChargeIds(ids),
    {
      cache: false,
    },
  );

  public updateBusinessTripFlightTransaction(params: IUpdateBusinessTripFlightTransactionParams) {
    return updateBusinessTripFlightTransaction.run(params, this.dbProvider);
  }

  public insertBusinessTripFlightTransaction(params: IInsertBusinessTripFlightTransactionParams) {
    return insertBusinessTripFlightTransaction.run(params, this.dbProvider);
  }
}
