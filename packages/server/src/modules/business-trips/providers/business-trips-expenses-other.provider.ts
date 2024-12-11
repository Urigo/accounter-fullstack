import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type {
  IDeleteBusinessTripOtherExpenseParams,
  IDeleteBusinessTripOtherExpenseQuery,
  IGetBusinessTripsOtherExpensesByBusinessTripIdsQuery,
  IGetBusinessTripsOtherExpensesByBusinessTripIdsResult,
  IGetBusinessTripsOtherExpensesByIdsQuery,
  IGetBusinessTripsOtherExpensesByIdsResult,
  IInsertBusinessTripOtherExpenseParams,
  IInsertBusinessTripOtherExpenseQuery,
  IUpdateBusinessTripOtherExpenseParams,
  IUpdateBusinessTripOtherExpenseQuery,
} from '../types.js';

const getBusinessTripsOtherExpensesByBusinessTripIds = sql<IGetBusinessTripsOtherExpensesByBusinessTripIdsQuery>`
  SELECT *
  FROM accounter_schema.business_trips_transactions_other a
  LEFT JOIN accounter_schema.extended_business_trip_transactions t
    USING (id)
  WHERE ($isBusinessTripIds = 0 OR t.business_trip_id IN $$businessTripIds);`;

const getBusinessTripsOtherExpensesByIds = sql<IGetBusinessTripsOtherExpensesByIdsQuery>`
  SELECT *
  FROM accounter_schema.business_trips_transactions_other a
  LEFT JOIN accounter_schema.extended_business_trip_transactions t
    USING (id)
  WHERE ($isIds = 0 OR t.id IN $$expenseIds);`;

const updateBusinessTripOtherExpense = sql<IUpdateBusinessTripOtherExpenseQuery>`
  UPDATE accounter_schema.business_trips_transactions_other
  SET
  deductible_expense = COALESCE(
    $deductibleExpense,
    deductible_expense
  ),
  description = COALESCE(
    $description,
    description
  )
  WHERE
    id = $businessTripExpenseId
  RETURNING *;
`;

const insertBusinessTripOtherExpense = sql<IInsertBusinessTripOtherExpenseQuery>`
  INSERT INTO accounter_schema.business_trips_transactions_other (id, deductible_expense, description)
  VALUES($id, $deductibleExpense, $description)
  RETURNING *;`;

const deleteBusinessTripOtherExpense = sql<IDeleteBusinessTripOtherExpenseQuery>`
  DELETE FROM accounter_schema.business_trips_transactions_other
  WHERE id = $businessTripExpenseId
  RETURNING id;
`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class BusinessTripOtherExpensesProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  private async batchBusinessTripsOtherExpensesByBusinessTripIds(
    businessTripIds: readonly string[],
  ) {
    const businessTripsOtherExpenses = await getBusinessTripsOtherExpensesByBusinessTripIds.run(
      {
        isBusinessTripIds: businessTripIds.length > 0 ? 1 : 0,
        businessTripIds,
      },
      this.dbProvider,
    );
    return businessTripIds.map(id =>
      businessTripsOtherExpenses.filter(record => record.business_trip_id === id),
    );
  }

  public getBusinessTripsOtherExpensesByBusinessTripIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsOtherExpensesByBusinessTripIds(ids),
    {
      cacheKeyFn: key => `business-trip-other-expense-trip-${key}`,
      cacheMap: this.cache,
    },
  );

  private async batchBusinessTripsOtherExpensesByIds(expenseIds: readonly string[]) {
    const businessTripsOtherExpenses = await getBusinessTripsOtherExpensesByIds.run(
      {
        isIds: expenseIds.length > 0 ? 1 : 0,
        expenseIds,
      },
      this.dbProvider,
    );
    return expenseIds.map(id => businessTripsOtherExpenses.find(record => record.id === id));
  }

  public getBusinessTripsOtherExpensesByIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsOtherExpensesByIds(ids),
    {
      cacheKeyFn: key => `business-trip-other-expense-${key}`,
      cacheMap: this.cache,
    },
  );

  public updateBusinessTripOtherExpense(params: IUpdateBusinessTripOtherExpenseParams) {
    return updateBusinessTripOtherExpense.run(params, this.dbProvider);
  }

  public insertBusinessTripOtherExpense(params: IInsertBusinessTripOtherExpenseParams) {
    return insertBusinessTripOtherExpense.run(params, this.dbProvider);
  }

  public deleteBusinessTripOtherExpense(params: IDeleteBusinessTripOtherExpenseParams) {
    return deleteBusinessTripOtherExpense.run(params, this.dbProvider);
  }

  public invalidateById(expenseId: string) {
    const expense = this.cache.get<IGetBusinessTripsOtherExpensesByIdsResult>(
      `business-trip-other-expense-${expenseId}`,
    );
    if (expense) {
      this.cache.delete(`business-trip-other-expense-${expenseId}`);
      this.cache.delete(`business-trip-other-expense-trip-${expense.business_trip_id}`);
    }
  }

  public invalidateByBusinessTripId(businessTripId: string) {
    const expenses = this.cache.get<IGetBusinessTripsOtherExpensesByBusinessTripIdsResult[]>(
      `business-trip-other-expense-trip-${businessTripId}`,
    );
    for (const expense of expenses ?? []) {
      this.cache.delete(`business-trip-other-expense-${expense.id}`);
    }
    this.cache.delete(`business-trip-other-expense-trip-${businessTripId}`);
  }

  public clearCache() {
    this.cache.clear();
  }
}
