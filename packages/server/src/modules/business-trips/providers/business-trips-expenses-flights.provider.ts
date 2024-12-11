import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type {
  IDeleteBusinessTripFlightsExpenseParams,
  IDeleteBusinessTripFlightsExpenseQuery,
  IGetBusinessTripsFlightsExpensesByBusinessTripIdsQuery,
  IGetBusinessTripsFlightsExpensesByBusinessTripIdsResult,
  IGetBusinessTripsFlightsExpensesByIdsQuery,
  IGetBusinessTripsFlightsExpensesByIdsResult,
  IInsertBusinessTripFlightsExpenseParams,
  IInsertBusinessTripFlightsExpenseQuery,
  IUpdateBusinessTripFlightsExpenseParams,
  IUpdateBusinessTripFlightsExpenseQuery,
} from '../types.js';

const getBusinessTripsFlightsExpensesByBusinessTripIds = sql<IGetBusinessTripsFlightsExpensesByBusinessTripIdsQuery>`
  SELECT *
  FROM accounter_schema.business_trips_transactions_flights f
  LEFT JOIN accounter_schema.extended_business_trip_transactions t
    USING (id)
  WHERE ($isBusinessTripIds = 0 OR t.business_trip_id IN $$businessTripIds);`;

const getBusinessTripsFlightsExpensesByIds = sql<IGetBusinessTripsFlightsExpensesByIdsQuery>`
  SELECT *
  FROM accounter_schema.business_trips_transactions_flights f
  LEFT JOIN accounter_schema.extended_business_trip_transactions t
    USING (id)
  WHERE ($isIds = 0 OR t.id IN $$expenseIds);`;

const updateBusinessTripFlightsExpense = sql<IUpdateBusinessTripFlightsExpenseQuery>`
  UPDATE accounter_schema.business_trips_transactions_flights
  SET
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
  ),
  attendees = COALESCE(
    $attendeeIds,
    attendees
  )
  WHERE
    id = $businessTripExpenseId
  RETURNING *;
`;

const insertBusinessTripFlightsExpense = sql<IInsertBusinessTripFlightsExpenseQuery>`
  INSERT INTO accounter_schema.business_trips_transactions_flights (id, origin, destination, class, attendees)
  VALUES($id, $origin, $destination, $class, $attendeeIds)
  RETURNING *;`;

const deleteBusinessTripFlightsExpense = sql<IDeleteBusinessTripFlightsExpenseQuery>`
  DELETE FROM accounter_schema.business_trips_transactions_flights
  WHERE id = $businessTripExpenseId
  RETURNING id;
`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class BusinessTripFlightsExpensesProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  private async batchBusinessTripsFlightsExpensesByBusinessTripIds(
    businessTripIds: readonly string[],
  ) {
    const businessTripsFlightsExpenses = await getBusinessTripsFlightsExpensesByBusinessTripIds.run(
      {
        isBusinessTripIds: businessTripIds.length > 0 ? 1 : 0,
        businessTripIds,
      },
      this.dbProvider,
    );
    return businessTripIds.map(id =>
      businessTripsFlightsExpenses.filter(record => record.business_trip_id === id),
    );
  }

  public getBusinessTripsFlightsExpensesByBusinessTripIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsFlightsExpensesByBusinessTripIds(ids),
    {
      cacheKeyFn: key => `business-trip-flights-expense-trip-${key}`,
      cacheMap: this.cache,
    },
  );

  private async batchBusinessTripsFlightsExpensesByIds(expenseIds: readonly string[]) {
    const businessTripsFlightsExpenses = await getBusinessTripsFlightsExpensesByIds.run(
      {
        isIds: expenseIds.length > 0 ? 1 : 0,
        expenseIds,
      },
      this.dbProvider,
    );
    return expenseIds.map(id => businessTripsFlightsExpenses.find(record => record.id === id));
  }

  public getBusinessTripsFlightsExpensesByIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsFlightsExpensesByIds(ids),
    {
      cacheKeyFn: key => `business-trip-flights-expense-${key}`,
      cacheMap: this.cache,
    },
  );

  public updateBusinessTripFlightsExpense(params: IUpdateBusinessTripFlightsExpenseParams) {
    if (params.businessTripExpenseId) {
      this.invalidateById(params.businessTripExpenseId);
    }
    return updateBusinessTripFlightsExpense.run(params, this.dbProvider);
  }

  public insertBusinessTripFlightsExpense(params: IInsertBusinessTripFlightsExpenseParams) {
    params.attendeeIds ||= [];
    return insertBusinessTripFlightsExpense.run(params, this.dbProvider);
  }

  public deleteBusinessTripFlightsExpense(params: IDeleteBusinessTripFlightsExpenseParams) {
    if (params.businessTripExpenseId) {
      this.invalidateById(params.businessTripExpenseId);
    }
    return deleteBusinessTripFlightsExpense.run(params, this.dbProvider);
  }

  public invalidateById(expenseId: string) {
    const expense = this.cache.get<IGetBusinessTripsFlightsExpensesByIdsResult>(
      `business-trip-flights-expense-${expenseId}`,
    );
    if (expense) {
      this.cache.delete(`business-trip-flights-expense-${expenseId}`);
      this.cache.delete(`business-trip-flights-expense-trip-${expense.business_trip_id}`);
    }
  }

  public invalidateByBusinessTripId(businessTripId: string) {
    const expenses = this.cache.get<IGetBusinessTripsFlightsExpensesByBusinessTripIdsResult[]>(
      `business-trip-flights-expense-trip-${businessTripId}`,
    );
    for (const expense of expenses ?? []) {
      this.cache.delete(`business-trip-flights-expense-${expense.id}`);
    }
    this.cache.delete(`business-trip-flights-expense-trip-${businessTripId}`);
  }

  public clearCache() {
    this.cache.clear();
  }
}
