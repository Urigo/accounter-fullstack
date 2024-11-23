import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type {
  IDeleteBusinessTripAccommodationsExpenseParams,
  IDeleteBusinessTripAccommodationsExpenseQuery,
  IGetAllBusinessTripsAccommodationsExpensesQuery,
  IGetBusinessTripsAccommodationsExpensesByBusinessTripIdsQuery,
  IGetBusinessTripsAccommodationsExpensesByChargeIdsQuery,
  IGetBusinessTripsAccommodationsExpensesByIdsQuery,
  IInsertBusinessTripAccommodationsExpenseParams,
  IInsertBusinessTripAccommodationsExpenseQuery,
  IUpdateBusinessTripAccommodationsExpenseParams,
  IUpdateBusinessTripAccommodationsExpenseQuery,
} from '../types.js';

const getAllBusinessTripsAccommodationsExpenses = sql<IGetAllBusinessTripsAccommodationsExpensesQuery>`
  SELECT *
  FROM accounter_schema.business_trips_transactions_accommodations a
  LEFT JOIN accounter_schema.extended_business_trip_transactions t
    USING (id);`;

const getBusinessTripsAccommodationsExpensesByChargeIds = sql<IGetBusinessTripsAccommodationsExpensesByChargeIdsQuery>`
  SELECT btc.charge_id, a.*, t.business_trip_id, t.category, t.date, t.value_date, t.amount, t.currency, t.employee_business_id, t.payed_by_employee, t.transaction_ids
  FROM accounter_schema.business_trips_transactions_accommodations a
  LEFT JOIN accounter_schema.extended_business_trip_transactions t
    USING (id)
  LEFT JOIN accounter_schema.business_trip_charges btc
    ON t.business_trip_id = btc.business_trip_id
  WHERE btc.charge_id IN $$chargeIds;`;

const getBusinessTripsAccommodationsExpensesByBusinessTripIds = sql<IGetBusinessTripsAccommodationsExpensesByBusinessTripIdsQuery>`
  SELECT *
  FROM accounter_schema.business_trips_transactions_accommodations a
  LEFT JOIN accounter_schema.extended_business_trip_transactions t
    USING (id)
  WHERE t.business_trip_id IN $$businessTripIds;`;

const getBusinessTripsAccommodationsExpensesByIds = sql<IGetBusinessTripsAccommodationsExpensesByIdsQuery>`
  SELECT *
  FROM accounter_schema.business_trips_transactions_accommodations a
  LEFT JOIN accounter_schema.extended_business_trip_transactions t
    USING (id)
  WHERE t.id IN $$expenseIds;`;

const updateBusinessTripAccommodationsExpense = sql<IUpdateBusinessTripAccommodationsExpenseQuery>`
  UPDATE accounter_schema.business_trips_transactions_accommodations
  SET
  country = COALESCE(
    $country,
    country
  ),
  nights_count = COALESCE(
    $nightsCount,
    nights_count
  ),
  attendees_stay = COALESCE(
    $attendeesStay,
    attendees_stay
  )
  WHERE
    id = $businessTripExpenseId
  RETURNING *;
`;

const insertBusinessTripAccommodationsExpense = sql<IInsertBusinessTripAccommodationsExpenseQuery>`
  INSERT INTO accounter_schema.business_trips_transactions_accommodations (id, country, nights_count, attendees_stay)
  VALUES($id, $country, $nightsCount, $attendeesStay)
  RETURNING *;`;

const deleteBusinessTripAccommodationsExpense = sql<IDeleteBusinessTripAccommodationsExpenseQuery>`
  DELETE FROM accounter_schema.business_trips_transactions_accommodations
  WHERE id = $businessTripExpenseId
  RETURNING id;
`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class BusinessTripAccommodationsExpensesProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  public getAllBusinessTripsAccommodationsExpenses() {
    return getAllBusinessTripsAccommodationsExpenses.run(undefined, this.dbProvider);
  }

  private async batchBusinessTripsAccommodationsExpensesByChargeIds(chargeIds: readonly string[]) {
    const businessTripsAccommodationsExpenses =
      await getBusinessTripsAccommodationsExpensesByChargeIds.run(
        {
          chargeIds,
        },
        this.dbProvider,
      );
    return chargeIds.map(id =>
      businessTripsAccommodationsExpenses.filter(record => record.charge_id === id),
    );
  }

  public getBusinessTripsAccommodationsExpensesByChargeIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsAccommodationsExpensesByChargeIds(ids),
    {
      cacheKeyFn: key => `business-trip-accommodation-expenses-by-charge-${key}`,
      cacheMap: this.cache,
    },
  );

  private async batchBusinessTripsAccommodationsExpensesByBusinessTripIds(
    businessTripIds: readonly string[],
  ) {
    const businessTripsAccommodationsExpenses =
      await getBusinessTripsAccommodationsExpensesByBusinessTripIds.run(
        {
          businessTripIds,
        },
        this.dbProvider,
      );
    return businessTripIds.map(id =>
      businessTripsAccommodationsExpenses.filter(record => record.business_trip_id === id),
    );
  }

  public getBusinessTripsAccommodationsExpensesByBusinessTripIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsAccommodationsExpensesByBusinessTripIds(ids),
    {
      cacheKeyFn: key => `business-trip-accommodation-expenses-by-trip-${key}`,
      cacheMap: this.cache,
    },
  );

  private async batchBusinessTripsAccommodationsExpensesByIds(expenseIds: readonly string[]) {
    const businessTripsAccommodationsExpenses =
      await getBusinessTripsAccommodationsExpensesByIds.run(
        {
          expenseIds,
        },
        this.dbProvider,
      );
    return expenseIds.map(id =>
      businessTripsAccommodationsExpenses.filter(record => record.id === id),
    );
  }

  public getBusinessTripsAccommodationsExpensesByIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsAccommodationsExpensesByIds(ids),
    {
      cacheKeyFn: key => `business-trip-accommodation-expenses-${key}`,
      cacheMap: this.cache,
    },
  );

  public updateBusinessTripAccommodationsExpense(
    params: IUpdateBusinessTripAccommodationsExpenseParams,
  ) {
    this.clearCache();
    return updateBusinessTripAccommodationsExpense.run(params, this.dbProvider);
  }

  public insertBusinessTripAccommodationsExpense(
    params: IInsertBusinessTripAccommodationsExpenseParams,
  ) {
    this.clearCache();
    params.attendeesStay ||= [];
    return insertBusinessTripAccommodationsExpense.run(params, this.dbProvider);
  }

  public deleteBusinessTripAccommodationsExpense(
    params: IDeleteBusinessTripAccommodationsExpenseParams,
  ) {
    this.clearCache();
    return deleteBusinessTripAccommodationsExpense.run(params, this.dbProvider);
  }

  public clearCache() {
    this.cache.clear();
  }

  public clearExpenseByIdCache(id: string) {
    this.cache.delete(`business-trip-accommodation-expenses-${id}`);
  }

  public clearExpenseByTripIdCache(id: string) {
    this.cache.delete(`business-trip-accommodation-expenses-by-trip-${id}`);
  }

  public clearExpenseByChargeIdCache(id: string) {
    this.cache.delete(`business-trip-accommodation-expenses-by-charge-${id}`);
  }
}
