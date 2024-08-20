import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { stringArray } from '@modules/charges/types.js';
import { sql } from '@pgtyped/runtime';
import type {
  IDeleteBusinessTripExpenseMatchParams,
  IDeleteBusinessTripExpenseMatchQuery,
  IDeleteBusinessTripExpenseParams,
  IDeleteBusinessTripExpenseQuery,
  IDeleteSpecificBusinessTripExpenseMatchParams,
  IDeleteSpecificBusinessTripExpenseMatchQuery,
  IGetAllBusinessTripsExpensesQuery,
  IGetBusinessTripsExpenseMatchesByExpenseIdsQuery,
  IGetBusinessTripsExpenseMatchesByTransactionIdsQuery,
  IGetBusinessTripsExpensesByBusinessTripIdsQuery,
  IGetBusinessTripsExpensesByChargeIdsQuery,
  IGetBusinessTripsExpensesByIdsQuery,
  IGetTransactionsByBusinessTripIdParams,
  IGetTransactionsByBusinessTripIdQuery,
  IGetUncategorizedTransactionsByBusinessTripIdParams,
  IGetUncategorizedTransactionsByBusinessTripIdQuery,
  IInsertBusinessTripExpenseMatchParams,
  IInsertBusinessTripExpenseMatchQuery,
  IInsertBusinessTripExpenseParams,
  IInsertBusinessTripExpenseQuery,
  IUpdateBusinessTripExpenseParams,
  IUpdateBusinessTripExpenseQuery,
} from '../types.js';
import { BusinessTripAccommodationsExpensesProvider } from './business-trips-expenses-accommodations.provider.js';
import { BusinessTripFlightsExpensesProvider } from './business-trips-expenses-flights.provider.js';
import { BusinessTripOtherExpensesProvider } from './business-trips-expenses-other.provider.js';
import { BusinessTripTravelAndSubsistenceExpensesProvider } from './business-trips-expenses-travel-and-subsistence.provider.js';

const getAllBusinessTripsExpenses = sql<IGetAllBusinessTripsExpensesQuery>`
  SELECT *
  FROM accounter_schema.extended_business_trip_transactions`;

const getBusinessTripsExpensesByChargeIds = sql<IGetBusinessTripsExpensesByChargeIdsQuery>`
  SELECT *
  FROM accounter_schema.extended_business_trip_transactions btt
  WHERE ($isChargeIds = 0 OR btt.charge_ids && $chargeIds);`;

const getBusinessTripsExpensesByBusinessTripIds = sql<IGetBusinessTripsExpensesByBusinessTripIdsQuery>`
  SELECT *
  FROM accounter_schema.extended_business_trip_transactions
  WHERE ($isBusinessTripIds = 0 OR business_trip_id IN $$businessTripIds);`;

const getBusinessTripsExpenseMatchesByTransactionIds = sql<IGetBusinessTripsExpenseMatchesByTransactionIdsQuery>`
  SELECT *
  FROM accounter_schema.business_trips_transactions_match
  WHERE transaction_id in $$transactionIds;`;

const getBusinessTripsExpenseMatchesByExpenseIds = sql<IGetBusinessTripsExpenseMatchesByExpenseIdsQuery>`
  SELECT *
  FROM accounter_schema.business_trips_transactions_match
  WHERE business_trip_transaction_id in $$expenseIds;`;

const getBusinessTripsExpensesByIds = sql<IGetBusinessTripsExpensesByIdsQuery>`
  SELECT *
  FROM accounter_schema.extended_business_trip_transactions
  WHERE ($isIds = 0 OR id IN $$expenseIds);`;

const updateBusinessTripExpense = sql<IUpdateBusinessTripExpenseQuery>`
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
    id = $businessTripExpenseId
  RETURNING *;
`;

const insertBusinessTripExpense = sql<IInsertBusinessTripExpenseQuery>`
  INSERT INTO accounter_schema.business_trips_transactions (business_trip_id, category)
  VALUES($businessTripId, $category)
  RETURNING *;`;

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

const deleteBusinessTripExpense = sql<IDeleteBusinessTripExpenseQuery>`
  DELETE FROM accounter_schema.business_trips_transactions
  WHERE id = $businessTripExpenseId
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

const getTransactionsByBusinessTripId = sql<IGetTransactionsByBusinessTripIdQuery>`
  SELECT t.*
  FROM accounter_schema.extended_transactions t
  LEFT JOIN accounter_schema.business_trip_charges btc
    ON t.charge_id = btc.charge_id
      AND btc.business_trip_id = $businessTripId
  WHERE btc.business_trip_id IS NOT NULL;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class BusinessTripExpensesProvider {
  constructor(
    private dbProvider: DBProvider,
    private flightExpensesProvider: BusinessTripFlightsExpensesProvider,
    private accommodationsExpensesProvider: BusinessTripAccommodationsExpensesProvider,
    private travelAndSubsistenceExpensesProvider: BusinessTripTravelAndSubsistenceExpensesProvider,
    private otherExpensesProvider: BusinessTripOtherExpensesProvider,
  ) {}

  public getAllBusinessTripsExpenses() {
    return getAllBusinessTripsExpenses.run(undefined, this.dbProvider);
  }

  private async batchBusinessTripsExpensesByChargeIds(chargeIds: readonly string[]) {
    const businessTrips = await getBusinessTripsExpensesByChargeIds.run(
      {
        isChargeIds: chargeIds.length > 0 ? 1 : 0,
        chargeIds: chargeIds as stringArray,
      },
      this.dbProvider,
    );
    return chargeIds.map(id => businessTrips.filter(record => record.charge_ids?.includes(id)));
  }

  public getBusinessTripsExpensesByChargeIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsExpensesByChargeIds(ids),
    {
      cache: false,
    },
  );

  private async batchBusinessTripsExpensesByBusinessTripIds(businessTripIds: readonly string[]) {
    const businessTrips = await getBusinessTripsExpensesByBusinessTripIds.run(
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

  public getBusinessTripsExpensesByBusinessTripIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsExpensesByBusinessTripIds(ids),
    {
      cache: false,
    },
  );

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
      cache: false,
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
      cache: false,
    },
  );

  private async batchBusinessTripsExpenseMatchesByIds(expenseIds: readonly string[]) {
    const businessTripsExpenses = await getBusinessTripsExpensesByIds.run(
      {
        isIds: expenseIds.length > 0 ? 1 : 0,
        expenseIds,
      },
      this.dbProvider,
    );
    return expenseIds.map(id => businessTripsExpenses.find(record => record.id === id));
  }

  public getBusinessTripsExpensesByIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsExpenseMatchesByIds(ids),
    {
      cache: false,
    },
  );

  public updateBusinessTripExpense(params: IUpdateBusinessTripExpenseParams) {
    return updateBusinessTripExpense.run(params, this.dbProvider);
  }

  public insertBusinessTripExpense(params: IInsertBusinessTripExpenseParams) {
    return insertBusinessTripExpense.run(params, this.dbProvider);
  }

  public insertBusinessTripExpenseMatch(params: IInsertBusinessTripExpenseMatchParams) {
    return insertBusinessTripExpenseMatch.run(params, this.dbProvider);
  }

  public async getBusinessTripExtendedExpensesByChargeId(chargeId: string) {
    const [
      allExpenses,
      flightExpenses,
      accommodationsExpenses,
      travelAndSubsistenceExpenses,
      otherExpenses,
    ] = await Promise.all([
      this.getBusinessTripsExpensesByChargeIdLoader.load(chargeId),
      this.flightExpensesProvider.getBusinessTripsFlightsExpensesByChargeIdLoader.load(chargeId),
      this.accommodationsExpensesProvider.getBusinessTripsAccommodationsExpensesByChargeIdLoader.load(
        chargeId,
      ),
      this.travelAndSubsistenceExpensesProvider.getBusinessTripsTravelAndSubsistenceExpensesByChargeIdLoader.load(
        chargeId,
      ),
      this.otherExpensesProvider.getBusinessTripsOtherExpensesByChargeIdLoader.load(chargeId),
    ]);

    const extendedIds = new Set<string>(
      [
        ...flightExpenses,
        ...accommodationsExpenses,
        ...travelAndSubsistenceExpenses,
        ...otherExpenses,
      ].map(t => t.id),
    );

    return {
      nonExtendedExpenses: allExpenses?.filter(t => !extendedIds.has(t.id!)),
      flightExpenses,
      accommodationsExpenses,
      travelAndSubsistenceExpenses,
      otherExpenses,
    };
  }

  public async getBusinessTripExtendedExpensesByBusinessTripId(businessTripId: string) {
    const [
      allExpenses,
      flightExpenses,
      accommodationsExpenses,
      travelAndSubsistenceExpenses,
      otherExpenses,
    ] = await Promise.all([
      this.getBusinessTripsExpensesByBusinessTripIdLoader.load(businessTripId),
      this.flightExpensesProvider.getBusinessTripsFlightsExpensesByBusinessTripIdLoader.load(
        businessTripId,
      ),
      this.accommodationsExpensesProvider.getBusinessTripsAccommodationsExpensesByBusinessTripIdLoader.load(
        businessTripId,
      ),
      this.travelAndSubsistenceExpensesProvider.getBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIdLoader.load(
        businessTripId,
      ),
      this.otherExpensesProvider.getBusinessTripsOtherExpensesByBusinessTripIdLoader.load(
        businessTripId,
      ),
    ]);

    const extendedIds = new Set<string>(
      [
        ...flightExpenses,
        ...accommodationsExpenses,
        ...travelAndSubsistenceExpenses,
        ...otherExpenses,
      ].map(t => t.id),
    );

    return {
      nonExtendedExpenses: allExpenses?.filter(t => !extendedIds.has(t.id!)),
      flightExpenses,
      accommodationsExpenses,
      travelAndSubsistenceExpenses,
      otherExpenses,
    };
  }

  public getUncategorizedTransactionsByBusinessTripId(
    params: IGetUncategorizedTransactionsByBusinessTripIdParams,
  ) {
    return getUncategorizedTransactionsByBusinessTripId.run(params, this.dbProvider);
  }

  public getTransactionsByBusinessTripId(params: IGetTransactionsByBusinessTripIdParams) {
    return getTransactionsByBusinessTripId.run(params, this.dbProvider);
  }

  public deleteBusinessTripExpense(params: IDeleteBusinessTripExpenseParams) {
    return deleteBusinessTripExpense.run(params, this.dbProvider);
  }

  public deleteBusinessTripExpenseMatch(params: IDeleteBusinessTripExpenseMatchParams) {
    return deleteBusinessTripExpenseMatch.run(params, this.dbProvider);
  }

  public deleteSpecificBusinessTripExpenseMatch(
    params: IDeleteSpecificBusinessTripExpenseMatchParams,
  ) {
    return deleteSpecificBusinessTripExpenseMatch.run(params, this.dbProvider);
  }
}
