import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type {
  IDeleteBusinessTripAccommodationsExpenseParams,
  IDeleteBusinessTripAccommodationsExpenseQuery,
  IGetBusinessTripsAccommodationsExpensesByBusinessTripIdsQuery,
  IGetBusinessTripsAccommodationsExpensesByIdsQuery,
  IInsertBusinessTripAccommodationsExpenseParams,
  IInsertBusinessTripAccommodationsExpenseQuery,
  IUpdateBusinessTripAccommodationsExpenseParams,
  IUpdateBusinessTripAccommodationsExpenseQuery,
} from '../types.js';

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
  WHERE a.id IN $$expenseIds;`;

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
  scope: Scope.Operation,
  global: true,
})
export class BusinessTripAccommodationsExpensesProvider {
  constructor(private db: TenantAwareDBClient) {}

  private async batchBusinessTripsAccommodationsExpensesByBusinessTripIds(
    businessTripIds: readonly string[],
  ) {
    const businessTripsAccommodationsExpenses =
      await getBusinessTripsAccommodationsExpensesByBusinessTripIds.run(
        {
          businessTripIds,
        },
        this.db,
      );
    return businessTripIds.map(id =>
      businessTripsAccommodationsExpenses.filter(record => record.business_trip_id === id),
    );
  }

  public getBusinessTripsAccommodationsExpensesByBusinessTripIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsAccommodationsExpensesByBusinessTripIds(ids),
  );

  private async batchBusinessTripsAccommodationsExpensesByIds(expenseIds: readonly string[]) {
    const businessTripsAccommodationsExpenses =
      await getBusinessTripsAccommodationsExpensesByIds.run(
        {
          expenseIds,
        },
        this.db,
      );
    return expenseIds.map(id =>
      businessTripsAccommodationsExpenses.find(record => record.id === id),
    );
  }

  public getBusinessTripsAccommodationsExpensesByIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsAccommodationsExpensesByIds(ids),
  );

  public updateBusinessTripAccommodationsExpense(
    params: IUpdateBusinessTripAccommodationsExpenseParams,
  ) {
    if (params.businessTripExpenseId) {
      this.invalidateById(params.businessTripExpenseId);
    }
    return updateBusinessTripAccommodationsExpense.run(params, this.db);
  }

  public insertBusinessTripAccommodationsExpense(
    params: IInsertBusinessTripAccommodationsExpenseParams,
  ) {
    params.attendeesStay ||= [];
    return insertBusinessTripAccommodationsExpense.run(params, this.db);
  }

  public deleteBusinessTripAccommodationsExpense(
    params: IDeleteBusinessTripAccommodationsExpenseParams,
  ) {
    if (params.businessTripExpenseId) {
      this.invalidateById(params.businessTripExpenseId);
    }
    return deleteBusinessTripAccommodationsExpense.run(params, this.db);
  }

  public async invalidateById(expenseId: string) {
    const expense = await this.getBusinessTripsAccommodationsExpensesByIdLoader.load(expenseId);
    if (expense?.business_trip_id) {
      this.getBusinessTripsAccommodationsExpensesByBusinessTripIdLoader.clear(
        expense.business_trip_id,
      );
    }
    this.getBusinessTripsAccommodationsExpensesByIdLoader.clear(expenseId);
  }

  public async invalidateByBusinessTripId(businessTripId: string) {
    const expenses =
      await this.getBusinessTripsAccommodationsExpensesByBusinessTripIdLoader.load(businessTripId);
    for (const expense of expenses ?? []) {
      this.getBusinessTripsAccommodationsExpensesByIdLoader.clear(expense.id);
    }
    this.getBusinessTripsAccommodationsExpensesByBusinessTripIdLoader.clear(businessTripId);
  }

  public clearCache() {
    this.getBusinessTripsAccommodationsExpensesByBusinessTripIdLoader.clearAll();
    this.getBusinessTripsAccommodationsExpensesByIdLoader.clearAll();
  }
}
