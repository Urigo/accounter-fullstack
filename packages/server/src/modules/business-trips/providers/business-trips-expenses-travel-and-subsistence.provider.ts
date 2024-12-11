import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type {
  IDeleteBusinessTripTravelAndSubsistenceExpenseParams,
  IDeleteBusinessTripTravelAndSubsistenceExpenseQuery,
  IGetBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIdsQuery,
  IGetBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIdsResult,
  IGetBusinessTripsTravelAndSubsistenceExpensesByIdsQuery,
  IGetBusinessTripsTravelAndSubsistenceExpensesByIdsResult,
  IInsertBusinessTripTravelAndSubsistenceExpenseParams,
  IInsertBusinessTripTravelAndSubsistenceExpenseQuery,
  IUpdateBusinessTripTravelAndSubsistenceExpenseParams,
  IUpdateBusinessTripTravelAndSubsistenceExpenseQuery,
} from '../types.js';

const getBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIds = sql<IGetBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIdsQuery>`
  SELECT *
  FROM accounter_schema.business_trips_transactions_tns a
  LEFT JOIN accounter_schema.extended_business_trip_transactions t
    USING (id)
  WHERE ($isBusinessTripIds = 0 OR t.business_trip_id IN $$businessTripIds);`;

const getBusinessTripsTravelAndSubsistenceExpensesByIds = sql<IGetBusinessTripsTravelAndSubsistenceExpensesByIdsQuery>`
  SELECT *
  FROM accounter_schema.business_trips_transactions_tns a
  LEFT JOIN accounter_schema.extended_business_trip_transactions t
    USING (id)
  WHERE ($isIds = 0 OR t.id IN $$expenseIds);`;

const updateBusinessTripTravelAndSubsistenceExpense = sql<IUpdateBusinessTripTravelAndSubsistenceExpenseQuery>`
  UPDATE accounter_schema.business_trips_transactions_tns
  SET
  expense_type = COALESCE(
    $expenseType,
    expense_type
  )
  WHERE
    id = $businessTripExpenseId
  RETURNING *;
`;

const insertBusinessTripTravelAndSubsistenceExpense = sql<IInsertBusinessTripTravelAndSubsistenceExpenseQuery>`
  INSERT INTO accounter_schema.business_trips_transactions_tns (id, expense_type)
  VALUES($id, $expenseType)
  RETURNING *;`;

const deleteBusinessTripTravelAndSubsistenceExpense = sql<IDeleteBusinessTripTravelAndSubsistenceExpenseQuery>`
  DELETE FROM accounter_schema.business_trips_transactions_tns
  WHERE id = $businessTripExpenseId
  RETURNING id;
`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class BusinessTripTravelAndSubsistenceExpensesProvider {
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

  constructor(private dbProvider: DBProvider) {}

  private async batchBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIds(
    businessTripIds: readonly string[],
  ) {
    const businessTripsTravelAndSubsistenceExpenses =
      await getBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIds.run(
        {
          isBusinessTripIds: businessTripIds.length > 0 ? 1 : 0,
          businessTripIds,
        },
        this.dbProvider,
      );
    return businessTripIds.map(id =>
      businessTripsTravelAndSubsistenceExpenses.filter(record => record.business_trip_id === id),
    );
  }

  public getBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIdLoader = new DataLoader(
    (ids: readonly string[]) =>
      this.batchBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIds(ids),
    {
      cacheKeyFn: key => `business-trip-tns-expense-trip-${key}`,
      cacheMap: this.cache,
    },
  );

  private async batchBusinessTripsTravelAndSubsistenceExpensesByIds(expenseIds: readonly string[]) {
    const businessTripsTravelAndSubsistenceExpenses =
      await getBusinessTripsTravelAndSubsistenceExpensesByIds.run(
        {
          isIds: expenseIds.length > 0 ? 1 : 0,
          expenseIds,
        },
        this.dbProvider,
      );
    return expenseIds.map(id =>
      businessTripsTravelAndSubsistenceExpenses.find(record => record.id === id),
    );
  }

  public getBusinessTripsTravelAndSubsistenceExpensesByIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsTravelAndSubsistenceExpensesByIds(ids),
    {
      cacheKeyFn: key => `business-trip-tns-expense-${key}`,
      cacheMap: this.cache,
    },
  );

  public updateBusinessTripTravelAndSubsistenceExpense(
    params: IUpdateBusinessTripTravelAndSubsistenceExpenseParams,
  ) {
    return updateBusinessTripTravelAndSubsistenceExpense.run(params, this.dbProvider);
  }

  public insertBusinessTripTravelAndSubsistenceExpense(
    params: IInsertBusinessTripTravelAndSubsistenceExpenseParams,
  ) {
    return insertBusinessTripTravelAndSubsistenceExpense.run(params, this.dbProvider);
  }

  public deleteBusinessTripTravelAndSubsistenceExpense(
    params: IDeleteBusinessTripTravelAndSubsistenceExpenseParams,
  ) {
    return deleteBusinessTripTravelAndSubsistenceExpense.run(params, this.dbProvider);
  }

  public invalidateById(expenseId: string) {
    const expense = this.cache.get<IGetBusinessTripsTravelAndSubsistenceExpensesByIdsResult>(
      `business-trip-tns-expense-${expenseId}`,
    );
    if (expense) {
      this.cache.delete(`business-trip-tns-expense-${expenseId}`);
      this.cache.delete(`business-trip-tns-expense-trip-${expense.business_trip_id}`);
    }
  }

  public invalidateByBusinessTripId(businessTripId: string) {
    const expenses = this.cache.get<
      IGetBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIdsResult[]
    >(`business-trip-tns-expense-trip-${businessTripId}`);
    for (const expense of expenses ?? []) {
      this.cache.delete(`business-trip-tns-expense-${expense.id}`);
    }
    this.cache.delete(`business-trip-tns-expense-trip-${businessTripId}`);
  }

  public clearCache() {
    this.cache.clear();
  }
}
