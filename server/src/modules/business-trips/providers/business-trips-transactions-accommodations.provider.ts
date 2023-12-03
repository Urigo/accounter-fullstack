import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IGetAllBusinessTripsAccommodationsTransactionsQuery,
  IGetBusinessTripsAccommodationsTransactionsByBusinessTripIdsQuery,
  IGetBusinessTripsAccommodationsTransactionsByChargeIdsQuery,
  IGetBusinessTripsAccommodationsTransactionsByIdsQuery,
  IInsertBusinessTripAccommodationTransactionParams,
  IInsertBusinessTripAccommodationTransactionQuery,
  IUpdateBusinessTripAccommodationTransactionParams,
  IUpdateBusinessTripAccommodationTransactionQuery,
} from '../types.js';

const getAllBusinessTripsAccommodationsTransactions = sql<IGetAllBusinessTripsAccommodationsTransactionsQuery>`
  SELECT a.*, t.business_trip_id, t.category, t.date, t.amount, t.currency, t.employee_business_id, t.transaction_id
  FROM accounter_schema.business_trips_transactions_accommodations a
  LEFT JOIN accounter_schema.business_trips_transactions t
    ON a.id = t.id`;

const getBusinessTripsAccommodationsTransactionsByChargeIds = sql<IGetBusinessTripsAccommodationsTransactionsByChargeIdsQuery>`
  SELECT btc.charge_id, a.*, t.business_trip_id, t.category, t.date, t.amount, t.currency, t.employee_business_id, t.transaction_id
  FROM accounter_schema.business_trips_transactions_accommodations a
  LEFT JOIN accounter_schema.business_trips_transactions t
    ON a.id = t.id
  LEFT JOIN accounter_schema.business_trip_charges btc
    ON t.business_trip_id = btc.business_trip_id
  WHERE ($isChargeIds = 0 OR btc.charge_id IN $$chargeIds);`;

const getBusinessTripsAccommodationsTransactionsByBusinessTripIds = sql<IGetBusinessTripsAccommodationsTransactionsByBusinessTripIdsQuery>`
  SELECT a.*, t.business_trip_id, t.category, t.date, t.amount, t.currency, t.employee_business_id, t.transaction_id
  FROM accounter_schema.business_trips_transactions_accommodations a
  LEFT JOIN accounter_schema.business_trips_transactions t
    ON a.id = t.id
  WHERE ($isBusinessTripIds = 0 OR t.business_trip_id IN $$businessTripIds);`;

const getBusinessTripsAccommodationsTransactionsByIds = sql<IGetBusinessTripsAccommodationsTransactionsByIdsQuery>`
  SELECT a.*, t.business_trip_id, t.category, t.date, t.amount, t.currency, t.employee_business_id, t.transaction_id
  FROM accounter_schema.business_trips_transactions_accommodations a
  LEFT JOIN accounter_schema.business_trips_transactions t
    ON a.id = t.id
  WHERE ($isIds = 0 OR t.id IN $$transactionIds);`;

const updateBusinessTripAccommodationTransaction = sql<IUpdateBusinessTripAccommodationTransactionQuery>`
  UPDATE accounter_schema.business_trips_transactions_accommodations
  SET
  payed_by_employee = COALESCE(
    $payedByEmployee,
    payed_by_employee
  ),
  country = COALESCE(
    $country,
    country
  ),
  nights_count = COALESCE(
    $nightsCount,
    nights_count
  )
  WHERE
    id = $businessTripTransactionId
  RETURNING *;
`;

const insertBusinessTripAccommodationTransaction = sql<IInsertBusinessTripAccommodationTransactionQuery>`
  INSERT INTO accounter_schema.business_trips_transactions_accommodations (id, payed_by_employee, country, nights_count)
  VALUES($id, $payedByEmployee, $country, $nightsCount)
  RETURNING *;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class BusinessTripAccommodationsTransactionsProvider {
  constructor(private dbProvider: DBProvider) {}

  public getAllBusinessTripsAccommodationsTransactions() {
    return getAllBusinessTripsAccommodationsTransactions.run(undefined, this.dbProvider);
  }

  private async batchBusinessTripsAccommodationTransactionsByChargeIds(
    chargeIds: readonly string[],
  ) {
    const businessTripsAccommodationsTransactions =
      await getBusinessTripsAccommodationsTransactionsByChargeIds.run(
        {
          isChargeIds: chargeIds.length > 0 ? 1 : 0,
          chargeIds,
        },
        this.dbProvider,
      );
    return chargeIds.map(id =>
      businessTripsAccommodationsTransactions.filter(record => record.charge_id === id),
    );
  }

  public getBusinessTripsAccommodationTransactionsByChargeIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsAccommodationTransactionsByChargeIds(ids),
    {
      cache: false,
    },
  );

  private async batchBusinessTripsAccommodationTransactionsByBusinessTripIds(
    businessTripIds: readonly string[],
  ) {
    const businessTripsAccommodationsTransactions =
      await getBusinessTripsAccommodationsTransactionsByBusinessTripIds.run(
        {
          isBusinessTripIds: businessTripIds.length > 0 ? 1 : 0,
          businessTripIds,
        },
        this.dbProvider,
      );
    return businessTripIds.map(id =>
      businessTripsAccommodationsTransactions.filter(record => record.business_trip_id === id),
    );
  }

  public getBusinessTripsAccommodationTransactionsByBusinessTripIdLoader = new DataLoader(
    (ids: readonly string[]) =>
      this.batchBusinessTripsAccommodationTransactionsByBusinessTripIds(ids),
    {
      cache: false,
    },
  );

  private async batchBusinessTripsAccommodationTransactionsByIds(
    transactionIds: readonly string[],
  ) {
    const businessTripsAccommodationsTransactions =
      await getBusinessTripsAccommodationsTransactionsByIds.run(
        {
          isIds: transactionIds.length > 0 ? 1 : 0,
          transactionIds,
        },
        this.dbProvider,
      );
    return transactionIds.map(id =>
      businessTripsAccommodationsTransactions.filter(record => record.id === id),
    );
  }

  public getBusinessTripsAccommodationTransactionsByIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsAccommodationTransactionsByIds(ids),
    {
      cache: false,
    },
  );

  public updateBusinessTripAccommodationTransaction(
    params: IUpdateBusinessTripAccommodationTransactionParams,
  ) {
    return updateBusinessTripAccommodationTransaction.run(params, this.dbProvider);
  }

  public insertBusinessTripAccommodationTransaction(
    params: IInsertBusinessTripAccommodationTransactionParams,
  ) {
    return insertBusinessTripAccommodationTransaction.run(params, this.dbProvider);
  }
}
