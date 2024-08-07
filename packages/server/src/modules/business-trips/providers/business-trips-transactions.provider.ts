import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { stringArray } from '@modules/charges/types.js';
import { sql } from '@pgtyped/runtime';
import type {
  IDeleteBusinessTripTransactionParams,
  IDeleteBusinessTripTransactionQuery,
  IGetAllBusinessTripsTransactionsQuery,
  IGetBusinessTripsTransactionsByBusinessTripIdsQuery,
  IGetBusinessTripsTransactionsByChargeIdsQuery,
  IGetBusinessTripsTransactionsByIdsQuery,
  IGetBusinessTripsTransactionsByTransactionIdsQuery,
  IGetUncategorizedTransactionsByBusinessTripIdParams,
  IGetUncategorizedTransactionsByBusinessTripIdQuery,
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
  FROM accounter_schema.extended_business_trip_transactions`;

const getBusinessTripsTransactionsByChargeIds = sql<IGetBusinessTripsTransactionsByChargeIdsQuery>`
  SELECT *
  FROM accounter_schema.extended_business_trip_transactions btt
  WHERE ($isChargeIds = 0 OR btt.charge_ids && $chargeIds);`;

const getBusinessTripsTransactionsByBusinessTripIds = sql<IGetBusinessTripsTransactionsByBusinessTripIdsQuery>`
  SELECT *
  FROM accounter_schema.extended_business_trip_transactions
  WHERE ($isBusinessTripIds = 0 OR business_trip_id IN $$businessTripIds);`;

const getBusinessTripsTransactionsByTransactionIds = sql<IGetBusinessTripsTransactionsByTransactionIdsQuery>`
  SELECT *
  FROM accounter_schema.extended_business_trip_transactions
  WHERE ($isTransactionIds = 0 OR transaction_ids && $transactionIds);`;

const getBusinessTripsTransactionsByIds = sql<IGetBusinessTripsTransactionsByIdsQuery>`
  SELECT *
  FROM accounter_schema.extended_business_trip_transactions
  WHERE ($isIds = 0 OR id IN $$transactionIds);`;

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
  )
  WHERE
    id = $businessTripTransactionId
  RETURNING *;
`;

const insertBusinessTripTransaction = sql<IInsertBusinessTripTransactionQuery>`
  INSERT INTO accounter_schema.business_trips_transactions (business_trip_id, category, transaction_id)
  VALUES($businessTripId, $category, $transactionId)
  RETURNING *;`;

const deleteBusinessTripTransaction = sql<IDeleteBusinessTripTransactionQuery>`
  DELETE FROM accounter_schema.business_trips_transactions
  WHERE id = $businessTripTransactionId
  RETURNING id;
`;

const getUncategorizedTransactionsByBusinessTripId = sql<IGetUncategorizedTransactionsByBusinessTripIdQuery>`
  SELECT t.*
  FROM accounter_schema.extended_transactions t
  LEFT JOIN accounter_schema.business_trip_charges btc
    ON t.charge_id = btc.charge_id
      AND btc.business_trip_id = $businessTripId
  LEFT JOIN accounter_schema.extended_business_trip_transactions btt
    ON t.id = ANY(btt.transaction_ids)
    AND btt.business_trip_id = $businessTripId 
  WHERE btc.business_trip_id IS NOT NULL
    AND btt.id IS NULL;`;

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
        chargeIds: chargeIds as stringArray,
      },
      this.dbProvider,
    );
    return chargeIds.map(id => businessTrips.filter(record => record.charge_ids?.includes(id)));
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

  private async batchBusinessTripsTransactionsByTransactionIds(transactionIds: readonly string[]) {
    const businessTrips = await getBusinessTripsTransactionsByTransactionIds.run(
      {
        isTransactionIds: transactionIds.length > 0 ? 1 : 0,
        transactionIds: transactionIds as stringArray,
      },
      this.dbProvider,
    );
    return transactionIds.map(id =>
      businessTrips.filter(record => record.transaction_ids?.includes(id)),
    );
  }

  public getBusinessTripsTransactionsByTransactionIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsTransactionsByTransactionIds(ids),
    {
      cache: false,
    },
  );

  private async batchBusinessTripsTransactionsByIds(transactionIds: readonly string[]) {
    const businessTripsTransactions = await getBusinessTripsTransactionsByIds.run(
      {
        isIds: transactionIds.length > 0 ? 1 : 0,
        transactionIds,
      },
      this.dbProvider,
    );
    return transactionIds.map(id => businessTripsTransactions.filter(record => record.id === id));
  }

  public getBusinessTripsTransactionsByIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsTransactionsByIds(ids),
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
      this.accommodationsTransactionsProvider.getBusinessTripsAccommodationsTransactionsByChargeIdLoader.load(
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
      nonExtendedTransactions: allTransactions?.filter(t => !extendedIds.has(t.id!)),
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
      this.accommodationsTransactionsProvider.getBusinessTripsAccommodationsTransactionsByBusinessTripIdLoader.load(
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
      nonExtendedTransactions: allTransactions?.filter(t => !extendedIds.has(t.id!)),
      flightTransactions,
      accommodationsTransactions,
      travelAndSubsistenceTransactions,
      otherTransactions,
    };
  }

  public getUncategorizedTransactionsByBusinessTripId(
    params: IGetUncategorizedTransactionsByBusinessTripIdParams,
  ) {
    return getUncategorizedTransactionsByBusinessTripId.run(params, this.dbProvider);
  }

  public deleteBusinessTripTransaction(params: IDeleteBusinessTripTransactionParams) {
    return deleteBusinessTripTransaction.run(params, this.dbProvider);
  }
}
