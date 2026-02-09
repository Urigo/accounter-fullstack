import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { DBProvider } from '../../app-providers/db.provider.js';
import type {
  IDeleteBusinessTripCarRentalExpenseParams,
  IDeleteBusinessTripCarRentalExpenseQuery,
  IGetBusinessTripsCarRentalExpensesByBusinessTripIdsQuery,
  IGetBusinessTripsCarRentalExpensesByIdsQuery,
  IInsertBusinessTripCarRentalExpenseParams,
  IInsertBusinessTripCarRentalExpenseQuery,
  IUpdateBusinessTripCarRentalExpenseParams,
  IUpdateBusinessTripCarRentalExpenseQuery,
} from '../types.js';

const getBusinessTripsCarRentalExpensesByBusinessTripIds = sql<IGetBusinessTripsCarRentalExpensesByBusinessTripIdsQuery>`
  SELECT *
  FROM accounter_schema.business_trips_transactions_car_rental a
  LEFT JOIN accounter_schema.extended_business_trip_transactions t
    USING (id)
  WHERE ($isBusinessTripIds = 0 OR t.business_trip_id IN $$businessTripIds);`;

const getBusinessTripsCarRentalExpensesByIds = sql<IGetBusinessTripsCarRentalExpensesByIdsQuery>`
  SELECT *
  FROM accounter_schema.business_trips_transactions_car_rental a
  LEFT JOIN accounter_schema.extended_business_trip_transactions t
    USING (id)
  WHERE ($isIds = 0 OR t.id IN $$expenseIds);`;

const updateBusinessTripCarRentalExpense = sql<IUpdateBusinessTripCarRentalExpenseQuery>`
  UPDATE accounter_schema.business_trips_transactions_car_rental
  SET
  days = COALESCE(
    $days,
    days
  ),
  is_fuel_expense = COALESCE(
    $isFuelExpense,
    is_fuel_expense
  )
  WHERE
    id = $businessTripExpenseId
  RETURNING *;
`;

const insertBusinessTripCarRentalExpense = sql<IInsertBusinessTripCarRentalExpenseQuery>`
  INSERT INTO accounter_schema.business_trips_transactions_car_rental (id, days, is_fuel_expense)
  VALUES($id, $days, $isFuelExpense)
  RETURNING *;`;

const deleteBusinessTripCarRentalExpense = sql<IDeleteBusinessTripCarRentalExpenseQuery>`
  DELETE FROM accounter_schema.business_trips_transactions_car_rental
  WHERE id = $businessTripExpenseId
  RETURNING id;
`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class BusinessTripCarRentalExpensesProvider {
  constructor(private dbProvider: DBProvider) {}

  private async batchBusinessTripsCarRentalExpensesByBusinessTripIds(
    businessTripIds: readonly string[],
  ) {
    const businessTripsCarRentalExpenses =
      await getBusinessTripsCarRentalExpensesByBusinessTripIds.run(
        {
          isBusinessTripIds: businessTripIds.length > 0 ? 1 : 0,
          businessTripIds,
        },
        this.dbProvider,
      );
    return businessTripIds.map(id =>
      businessTripsCarRentalExpenses.filter(record => record.business_trip_id === id),
    );
  }

  public getBusinessTripsCarRentalExpensesByBusinessTripIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsCarRentalExpensesByBusinessTripIds(ids),
  );

  private async batchBusinessTripsCarRentalExpensesByIds(expenseIds: readonly string[]) {
    const businessTripsCarRentalExpenses = await getBusinessTripsCarRentalExpensesByIds.run(
      {
        isIds: expenseIds.length > 0 ? 1 : 0,
        expenseIds,
      },
      this.dbProvider,
    );
    return expenseIds.map(id => businessTripsCarRentalExpenses.find(record => record.id === id));
  }

  public getBusinessTripsCarRentalExpensesByIdLoader = new DataLoader((ids: readonly string[]) =>
    this.batchBusinessTripsCarRentalExpensesByIds(ids),
  );

  public updateBusinessTripCarRentalExpense(params: IUpdateBusinessTripCarRentalExpenseParams) {
    if (params.businessTripExpenseId) {
      this.invalidateById(params.businessTripExpenseId);
    }
    return updateBusinessTripCarRentalExpense.run(params, this.dbProvider);
  }

  public insertBusinessTripCarRentalExpense(params: IInsertBusinessTripCarRentalExpenseParams) {
    return insertBusinessTripCarRentalExpense.run(params, this.dbProvider);
  }

  public deleteBusinessTripCarRentalExpense(params: IDeleteBusinessTripCarRentalExpenseParams) {
    if (params.businessTripExpenseId) {
      this.invalidateById(params.businessTripExpenseId);
    }
    return deleteBusinessTripCarRentalExpense.run(params, this.dbProvider);
  }

  public async invalidateById(expenseId: string) {
    const expense = await this.getBusinessTripsCarRentalExpensesByIdLoader.load(expenseId);
    if (expense?.business_trip_id) {
      this.getBusinessTripsCarRentalExpensesByBusinessTripIdLoader.clear(expense.business_trip_id);
    }
    this.getBusinessTripsCarRentalExpensesByIdLoader.clear(expenseId);
  }

  public async invalidateByBusinessTripId(businessTripId: string) {
    const expenses =
      await this.getBusinessTripsCarRentalExpensesByBusinessTripIdLoader.load(businessTripId);
    for (const expense of expenses ?? []) {
      this.getBusinessTripsCarRentalExpensesByIdLoader.clear(expense.id);
    }
    this.getBusinessTripsCarRentalExpensesByBusinessTripIdLoader.clear(businessTripId);
  }

  public clearCache() {
    this.getBusinessTripsCarRentalExpensesByBusinessTripIdLoader.clearAll();
    this.getBusinessTripsCarRentalExpensesByIdLoader.clearAll();
  }
}
