import DataLoader from 'dataloader';
import { GraphQLError } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { TransactionsProvider } from '@modules/transactions/providers/transactions.provider.js';
import { IGetTransactionsByChargeIdsResult } from '@modules/transactions/types.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type {
  IDeleteBusinessTripExpenseParams,
  IDeleteBusinessTripExpenseQuery,
  IGetBusinessTripsExpensesByBusinessTripIdsQuery,
  IGetBusinessTripsExpensesByIdsQuery,
  IGetUncategorizedTransactionsByBusinessTripIdParams,
  IGetUncategorizedTransactionsByBusinessTripIdQuery,
  IInsertBusinessTripExpenseParams,
  IInsertBusinessTripExpenseQuery,
  IUpdateBusinessTripExpenseParams,
  IUpdateBusinessTripExpenseQuery,
} from '../types.js';
import { BusinessTripAccommodationsExpensesProvider } from './business-trips-expenses-accommodations.provider.js';
import { BusinessTripCarRentalExpensesProvider } from './business-trips-expenses-car-rental.provider.js';
import { BusinessTripFlightsExpensesProvider } from './business-trips-expenses-flights.provider.js';
import { BusinessTripOtherExpensesProvider } from './business-trips-expenses-other.provider.js';
import { BusinessTripTravelAndSubsistenceExpensesProvider } from './business-trips-expenses-travel-and-subsistence.provider.js';
import { BusinessTripsProvider } from './business-trips.provider.js';

const getBusinessTripsExpensesByBusinessTripIds = sql<IGetBusinessTripsExpensesByBusinessTripIdsQuery>`
  SELECT *
  FROM accounter_schema.extended_business_trip_transactions
  WHERE business_trip_id IN $$businessTripIds;`;

const getBusinessTripsExpensesByIds = sql<IGetBusinessTripsExpensesByIdsQuery>`
  SELECT *
  FROM accounter_schema.extended_business_trip_transactions
  WHERE id IN $$expenseIds;`;

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

const deleteBusinessTripExpense = sql<IDeleteBusinessTripExpenseQuery>`
  DELETE FROM accounter_schema.business_trips_transactions
  WHERE id = $businessTripExpenseId
  RETURNING id;
`;

const getUncategorizedTransactionsByBusinessTripId = sql<IGetUncategorizedTransactionsByBusinessTripIdQuery>`
  SELECT t.id
  FROM accounter_schema.transactions t
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
export class BusinessTripExpensesProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(
    private dbProvider: DBProvider,
    private businessTripsProvider: BusinessTripsProvider,
    private flightExpensesProvider: BusinessTripFlightsExpensesProvider,
    private accommodationsExpensesProvider: BusinessTripAccommodationsExpensesProvider,
    private travelAndSubsistenceExpensesProvider: BusinessTripTravelAndSubsistenceExpensesProvider,
    private otherExpensesProvider: BusinessTripOtherExpensesProvider,
    private carRentalExpensesProvider: BusinessTripCarRentalExpensesProvider,
    private transactionsProvider: TransactionsProvider,
  ) {}

  private async batchBusinessTripsExpensesByBusinessTripIds(businessTripIds: readonly string[]) {
    const businessTrips = await getBusinessTripsExpensesByBusinessTripIds.run(
      {
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
      cacheKeyFn: key => `business-trip-expenses-trip-${key}`,
      cacheMap: this.cache,
    },
  );

  private async batchBusinessTripsExpenseMatchesByIds(expenseIds: readonly string[]) {
    const businessTripsExpenses = await getBusinessTripsExpensesByIds.run(
      {
        expenseIds,
      },
      this.dbProvider,
    );
    return expenseIds.map(id => businessTripsExpenses.find(record => record.id === id));
  }

  public getBusinessTripsExpensesByIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsExpenseMatchesByIds(ids),
    {
      cacheKeyFn: key => `business-trip-expense-${key}`,
      cacheMap: this.cache,
    },
  );

  public updateBusinessTripExpense(params: IUpdateBusinessTripExpenseParams) {
    return updateBusinessTripExpense.run(params, this.dbProvider);
  }

  public insertBusinessTripExpense(params: IInsertBusinessTripExpenseParams) {
    if (params.businessTripId) {
      this.invalidateByBusinessTripId(params.businessTripId);
    }
    return insertBusinessTripExpense.run(params, this.dbProvider);
  }

  public async getBusinessTripExtendedExpensesByChargeId(chargeId: string) {
    const businessTrip =
      await this.businessTripsProvider.getBusinessTripsByChargeIdLoader.load(chargeId);
    if (!businessTrip) {
      throw new GraphQLError(`Business trip not found for charge id ${chargeId}`);
    }
    const [
      allExpenses,
      flightExpenses,
      accommodationsExpenses,
      travelAndSubsistenceExpenses,
      otherExpenses,
      carRentalExpenses,
    ] = await Promise.all([
      this.getBusinessTripsExpensesByBusinessTripIdLoader.load(businessTrip.id),
      this.flightExpensesProvider.getBusinessTripsFlightsExpensesByBusinessTripIdLoader.load(
        businessTrip.id,
      ),
      this.accommodationsExpensesProvider.getBusinessTripsAccommodationsExpensesByBusinessTripIdLoader.load(
        businessTrip.id,
      ),
      this.travelAndSubsistenceExpensesProvider.getBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIdLoader.load(
        businessTrip.id,
      ),
      this.otherExpensesProvider.getBusinessTripsOtherExpensesByBusinessTripIdLoader.load(
        businessTrip.id,
      ),
      this.carRentalExpensesProvider.getBusinessTripsCarRentalExpensesByBusinessTripIdLoader.load(
        businessTrip.id,
      ),
    ]);

    const extendedIds = new Set<string>(
      [
        ...flightExpenses,
        ...accommodationsExpenses,
        ...travelAndSubsistenceExpenses,
        ...otherExpenses,
        ...carRentalExpenses,
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
      carRentalExpenses,
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
      this.carRentalExpensesProvider.getBusinessTripsCarRentalExpensesByBusinessTripIdLoader.load(
        businessTripId,
      ),
    ]);

    const extendedIds = new Set<string>(
      [
        ...flightExpenses,
        ...accommodationsExpenses,
        ...travelAndSubsistenceExpenses,
        ...otherExpenses,
        ...carRentalExpenses,
      ].map(t => t.id),
    );

    return {
      nonExtendedExpenses: allExpenses?.filter(t => !extendedIds.has(t.id!)),
      flightExpenses,
      accommodationsExpenses,
      travelAndSubsistenceExpenses,
      otherExpenses,
      carRentalExpenses,
    };
  }

  public async getUncategorizedTransactionsByBusinessTripId(
    params: IGetUncategorizedTransactionsByBusinessTripIdParams,
  ) {
    const transactionIDs = await getUncategorizedTransactionsByBusinessTripId.run(
      params,
      this.dbProvider,
    );
    return this.transactionsProvider.getTransactionByIdLoader.loadMany(
      transactionIDs.map(t => t.id),
    );
  }

  public async getTransactionsByBusinessTripId(businessTripId: string) {
    const chargeIds =
      await this.businessTripsProvider.getChargeIdsByBusinessTripIdLoader.load(businessTripId);
    return this.transactionsProvider.getTransactionsByChargeIDLoader
      .loadMany(chargeIds)
      .then(
        res => res.filter(r => !(r instanceof Error)).flat() as IGetTransactionsByChargeIdsResult[],
      );
  }

  public deleteBusinessTripExpense(params: IDeleteBusinessTripExpenseParams) {
    if (params.businessTripExpenseId) {
      this.invalidateById(params.businessTripExpenseId);
    }
    return deleteBusinessTripExpense.run(params, this.dbProvider);
  }

  private invalidateExpenseExtensionsById(expenseId: string) {
    this.flightExpensesProvider.invalidateById(expenseId);
    this.accommodationsExpensesProvider.invalidateById(expenseId);
    this.travelAndSubsistenceExpensesProvider.invalidateById(expenseId);
    this.otherExpensesProvider.invalidateById(expenseId);
    this.carRentalExpensesProvider.invalidateById(expenseId);
  }

  private invalidateExpenseExtensionsByBusinessTripId(businessTripId: string) {
    this.flightExpensesProvider.invalidateByBusinessTripId(businessTripId);
    this.accommodationsExpensesProvider.invalidateByBusinessTripId(businessTripId);
    this.travelAndSubsistenceExpensesProvider.invalidateByBusinessTripId(businessTripId);
    this.otherExpensesProvider.invalidateByBusinessTripId(businessTripId);
    this.carRentalExpensesProvider.invalidateByBusinessTripId(businessTripId);
  }

  public async invalidateById(expenseId: string) {
    const expense = await this.getBusinessTripsExpensesByIdLoader.load(expenseId);
    if (expense?.business_trip_id) {
      this.cache.delete(`business-trip-expenses-trip-${expense.business_trip_id}`);
      this.invalidateExpenseExtensionsByBusinessTripId(expense.business_trip_id);
    }
    this.cache.delete(`business-trip-expense-${expenseId}`);
    this.invalidateExpenseExtensionsById(expenseId);
  }

  public async invalidateByBusinessTripId(businessTripId: string) {
    const expenses = await this.getBusinessTripsExpensesByBusinessTripIdLoader.load(businessTripId);
    for (const expense of expenses ?? []) {
      if (expense.id) {
        this.cache.delete(`business-trip-expense-${expense.id}`);
        this.invalidateExpenseExtensionsById(expense.id);
      }
    }
    this.cache.delete(`business-trip-expenses-trip-${businessTripId}`);
    this.invalidateExpenseExtensionsByBusinessTripId(businessTripId);
  }

  public clearCache() {
    this.cache.clear();
  }
}
