import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IGetAllBusinessTripsTransactionsQuery,
  IGetBusinessTripsTransactionsByBusinessTripIdsQuery,
  IGetBusinessTripsTransactionsByChargeIdsQuery,
  IInsertBusinessTripTransactionParams,
  IInsertBusinessTripTransactionQuery,
  IUpdateBusinessTripTransactionParams,
  IUpdateBusinessTripTransactionQuery,
} from '../types.js';
import { BusinessTripAccommodationsTransactionsProvider } from './business-trips-transactions-accommodations.provider.js';
import { BusinessTripFlightsTransactionsProvider } from './business-trips-transactions-flights.provider.js';
import { BusinessTripOtherTransactionsProvider } from './business-trips-transactions-other.provider.js';
import { BusinessTripTravelAndSubsistenceTransactionsProvider } from './business-trips-transactions-travel-and-subsistence.provider.js';

const getAllBusinessTripsTransactions = sql<IGetAllBusinessTripsTransactionsQuery>`
  SELECT *
  FROM accounter_schema.business_trips_transactions`;

const getBusinessTripsTransactionsByChargeIds = sql<IGetBusinessTripsTransactionsByChargeIdsQuery>`
  SELECT btc.charge_id, btt.*
  FROM accounter_schema.business_trips_transactions btt
  LEFT JOIN accounter_schema.business_trip_charges btc
    ON btt.business_trip_id = btc.business_trip_id
  WHERE ($isChargeIds = 0 OR btc.charge_id IN $$chargeIds);`;

const getBusinessTripsTransactionsByBusinessTripIds = sql<IGetBusinessTripsTransactionsByBusinessTripIdsQuery>`
  SELECT *
  FROM accounter_schema.business_trips_transactions
  WHERE ($isBusinessTripIds = 0 OR business_trip_id IN $$businessTripIds);`;

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
  constructor(
    private dbProvider: DBProvider,
    private flightTransactionsProvider: BusinessTripFlightsTransactionsProvider,
    private accommodationsTransactionsProvider: BusinessTripAccommodationsTransactionsProvider,
    private travelAndSubsistenceTransactionsProvider: BusinessTripTravelAndSubsistenceTransactionsProvider,
    private otherTransactionsProvider: BusinessTripOtherTransactionsProvider,
  ) {}

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
    return chargeIds.map(id => businessTrips.filter(record => record.charge_id === id));
  }

  public getBusinessTripsTransactionsByChargeIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsTransactionsByChargeIds(ids),
    {
      cache: false,
    },
  );

  private async batchBusinessTripsTransactionsByBusinessTripIds(
    businessTripIds: readonly string[],
  ) {
    const businessTrips = await getBusinessTripsTransactionsByBusinessTripIds.run(
      {
        isBusinessTripIds: businessTripIds.length > 0 ? 1 : 0,
        businessTripIds,
      },
      this.dbProvider,
    );
    return businessTripIds.map(id =>
      businessTrips.filter(record => record.business_trip_id === id),
    );
  }

  public getBusinessTripsTransactionsByBusinessTripIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsTransactionsByBusinessTripIds(ids),
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

  public async getBusinessTripExtendedTransactionsByChargeId(chargeId: string) {
    const [
      allTransactions,
      flightTransactions,
      accommodationsTransactions,
      travelAndSubsistenceTransactions,
      otherTransactions,
    ] = await Promise.all([
      this.getBusinessTripsTransactionsByChargeIdLoader.load(chargeId),
      this.flightTransactionsProvider.getBusinessTripsFlightsTransactionsByChargeIdLoader.load(
        chargeId,
      ),
      this.accommodationsTransactionsProvider.getBusinessTripsAccommodationTransactionsByChargeIdLoader.load(
        chargeId,
      ),
      this.travelAndSubsistenceTransactionsProvider.getBusinessTripsTravelAndSubsistenceTransactionsByChargeIdLoader.load(
        chargeId,
      ),
      this.otherTransactionsProvider.getBusinessTripsOtherTransactionsByChargeIdLoader.load(
        chargeId,
      ),
    ]);

    const extendedIds = new Set<string>(
      [
        ...flightTransactions,
        ...accommodationsTransactions,
        ...travelAndSubsistenceTransactions,
        ...otherTransactions,
      ].map(t => t.id),
    );

    return {
      nonExtendedTransactions: allTransactions?.filter(t => !extendedIds.has(t.id)),
      flightTransactions,
      accommodationsTransactions,
      travelAndSubsistenceTransactions,
      otherTransactions,
    };
  }

  public async getBusinessTripExtendedTransactionsByBusinessTripId(businessTripId: string) {
    const [
      allTransactions,
      flightTransactions,
      accommodationsTransactions,
      travelAndSubsistenceTransactions,
      otherTransactions,
    ] = await Promise.all([
      this.getBusinessTripsTransactionsByBusinessTripIdLoader.load(businessTripId),
      this.flightTransactionsProvider.getBusinessTripsFlightsTransactionsByBusinessTripIdLoader.load(
        businessTripId,
      ),
      this.accommodationsTransactionsProvider.getBusinessTripsAccommodationTransactionsByBusinessTripIdLoader.load(
        businessTripId,
      ),
      this.travelAndSubsistenceTransactionsProvider.getBusinessTripsTravelAndSubsistenceTransactionsByBusinessTripIdLoader.load(
        businessTripId,
      ),
      this.otherTransactionsProvider.getBusinessTripsOtherTransactionsByBusinessTripIdLoader.load(
        businessTripId,
      ),
    ]);

    const extendedIds = new Set<string>(
      [
        ...flightTransactions,
        ...accommodationsTransactions,
        ...travelAndSubsistenceTransactions,
        ...otherTransactions,
      ].map(t => t.id),
    );

    return {
      nonExtendedTransactions: allTransactions?.filter(t => !extendedIds.has(t.id)),
      flightTransactions,
      accommodationsTransactions,
      travelAndSubsistenceTransactions,
      otherTransactions,
    };
  }
}
