import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { DBProvider } from '../../app-providers/db.provider.js';
import type {
  IDeleteBusinessTripTravelAndSubsistenceExpenseParams,
  IDeleteBusinessTripTravelAndSubsistenceExpenseQuery,
  IGetBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIdsQuery,
  IGetBusinessTripsTravelAndSubsistenceExpensesByIdsQuery,
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
  scope: Scope.Operation,
  global: true,
})
export class BusinessTripTravelAndSubsistenceExpensesProvider {
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
  );

  public updateBusinessTripTravelAndSubsistenceExpense(
    params: IUpdateBusinessTripTravelAndSubsistenceExpenseParams,
  ) {
    if (params.businessTripExpenseId) {
      this.invalidateById(params.businessTripExpenseId);
    }
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
    if (params.businessTripExpenseId) {
      this.invalidateById(params.businessTripExpenseId);
    }
    return deleteBusinessTripTravelAndSubsistenceExpense.run(params, this.dbProvider);
  }

  public async invalidateById(expenseId: string) {
    const expense =
      await this.getBusinessTripsTravelAndSubsistenceExpensesByIdLoader.load(expenseId);
    if (expense) {
      this.getBusinessTripsTravelAndSubsistenceExpensesByIdLoader.clear(expenseId);
      if (expense.business_trip_id) {
        this.getBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIdLoader.clear(
          expense.business_trip_id,
        );
      }
    }
  }

  public async invalidateByBusinessTripId(businessTripId: string) {
    const expenses =
      await this.getBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIdLoader.load(
        businessTripId,
      );
    for (const expense of expenses ?? []) {
      this.getBusinessTripsTravelAndSubsistenceExpensesByIdLoader.clear(expense.id);
    }
    this.getBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIdLoader.clear(businessTripId);
  }

  public clearCache() {
    this.getBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIdLoader.clearAll();
    this.getBusinessTripsTravelAndSubsistenceExpensesByIdLoader.clearAll();
  }
}
