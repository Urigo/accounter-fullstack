import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IDeleteBusinessTripAccommodationsTransactionParams,
  IDeleteBusinessTripAccommodationsTransactionQuery,
  IGetAllBusinessTripsAccommodationsTransactionsQuery,
  IGetBusinessTripsAccommodationsTransactionsByBusinessTripIdsQuery,
  IGetBusinessTripsAccommodationsTransactionsByChargeIdsQuery,
  IGetBusinessTripsAccommodationsTransactionsByIdsQuery,
  IInsertBusinessTripAccommodationsTransactionParams,
  IInsertBusinessTripAccommodationsTransactionQuery,
  IUpdateBusinessTripAccommodationsTransactionParams,
  IUpdateBusinessTripAccommodationsTransactionQuery,
} from '../types.js';

const getAllBusinessTripsAccommodationsTransactions = sql<IGetAllBusinessTripsAccommodationsTransactionsQuery>`
  SELECT *
  FROM accounter_schema.business_trips_transactions_accommodations a
  LEFT JOIN accounter_schema.extended_business_trip_transactions t
    USING (id);`;

const getBusinessTripsAccommodationsTransactionsByChargeIds = sql<IGetBusinessTripsAccommodationsTransactionsByChargeIdsQuery>`
  SELECT btc.charge_id, a.*, t.business_trip_id, t.category, t.date, t.value_date, t.amount, t.currency, t.employee_business_id, t.payed_by_employee, t.transaction_id
  FROM accounter_schema.business_trips_transactions_accommodations a
  LEFT JOIN accounter_schema.extended_business_trip_transactions t
    USING (id)
  LEFT JOIN accounter_schema.business_trip_charges btc
    ON t.business_trip_id = btc.business_trip_id
  WHERE ($isChargeIds = 0 OR btc.charge_id IN $$chargeIds);`;

const getBusinessTripsAccommodationsTransactionsByBusinessTripIds = sql<IGetBusinessTripsAccommodationsTransactionsByBusinessTripIdsQuery>`
  SELECT *
  FROM accounter_schema.business_trips_transactions_accommodations a
  LEFT JOIN accounter_schema.extended_business_trip_transactions t
    USING (id)
  WHERE ($isBusinessTripIds = 0 OR t.business_trip_id IN $$businessTripIds);`;

const getBusinessTripsAccommodationsTransactionsByIds = sql<IGetBusinessTripsAccommodationsTransactionsByIdsQuery>`
  SELECT *
  FROM accounter_schema.business_trips_transactions_accommodations a
  LEFT JOIN accounter_schema.extended_business_trip_transactions t
    USING (id)
  WHERE ($isIds = 0 OR t.id IN $$transactionIds);`;

const updateBusinessTripAccommodationsTransaction = sql<IUpdateBusinessTripAccommodationsTransactionQuery>`
  UPDATE accounter_schema.business_trips_transactions_accommodations
  SET
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

const insertBusinessTripAccommodationsTransaction = sql<IInsertBusinessTripAccommodationsTransactionQuery>`
  INSERT INTO accounter_schema.business_trips_transactions_accommodations (id, country, nights_count)
  VALUES($id, $country, $nightsCount)
  RETURNING *;`;

const deleteBusinessTripAccommodationsTransaction = sql<IDeleteBusinessTripAccommodationsTransactionQuery>`
  DELETE FROM accounter_schema.business_trips_transactions_accommodations
  WHERE id = $businessTripTransactionId
  RETURNING id;
`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class BusinessTripAccommodationsTransactionsProvider {
  constructor(private dbProvider: DBProvider) {}

  public getAllBusinessTripsAccommodationsTransactions() {
    return getAllBusinessTripsAccommodationsTransactions.run(undefined, this.dbProvider);
  }

  private async batchBusinessTripsAccommodationsTransactionsByChargeIds(
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

  public getBusinessTripsAccommodationsTransactionsByChargeIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsAccommodationsTransactionsByChargeIds(ids),
    {
      cache: false,
    },
  );

  private async batchBusinessTripsAccommodationsTransactionsByBusinessTripIds(
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

  public getBusinessTripsAccommodationsTransactionsByBusinessTripIdLoader = new DataLoader(
    (ids: readonly string[]) =>
      this.batchBusinessTripsAccommodationsTransactionsByBusinessTripIds(ids),
    {
      cache: false,
    },
  );

  private async batchBusinessTripsAccommodationsTransactionsByIds(
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

  public getBusinessTripsAccommodationsTransactionsByIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsAccommodationsTransactionsByIds(ids),
    {
      cache: false,
    },
  );

  public updateBusinessTripAccommodationsTransaction(
    params: IUpdateBusinessTripAccommodationsTransactionParams,
  ) {
    return updateBusinessTripAccommodationsTransaction.run(params, this.dbProvider);
  }

  public insertBusinessTripAccommodationsTransaction(
    params: IInsertBusinessTripAccommodationsTransactionParams,
  ) {
    return insertBusinessTripAccommodationsTransaction.run(params, this.dbProvider);
  }

  public deleteBusinessTripAccommodationsTransaction(
    params: IDeleteBusinessTripAccommodationsTransactionParams,
  ) {
    return deleteBusinessTripAccommodationsTransaction.run(params, this.dbProvider);
  }
}
