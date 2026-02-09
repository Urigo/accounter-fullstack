import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { DBProvider } from '../../app-providers/db.provider.js';
import type {
  IDeleteBusinessTripOtherExpenseParams,
  IDeleteBusinessTripOtherExpenseQuery,
  IGetBusinessTripsOtherExpensesByBusinessTripIdsQuery,
  IGetBusinessTripsOtherExpensesByIdsQuery,
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
  scope: Scope.Operation,
  global: true,
})
export class BusinessTripOtherExpensesProvider {
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

  public getBusinessTripsOtherExpensesByIdLoader = new DataLoader((ids: readonly string[]) =>
    this.batchBusinessTripsOtherExpensesByIds(ids),
  );

  public updateBusinessTripOtherExpense(params: IUpdateBusinessTripOtherExpenseParams) {
    if (params.businessTripExpenseId) {
      this.invalidateById(params.businessTripExpenseId);
    }
    return updateBusinessTripOtherExpense.run(params, this.dbProvider);
  }

  public insertBusinessTripOtherExpense(params: IInsertBusinessTripOtherExpenseParams) {
    return insertBusinessTripOtherExpense.run(params, this.dbProvider);
  }

  public deleteBusinessTripOtherExpense(params: IDeleteBusinessTripOtherExpenseParams) {
    if (params.businessTripExpenseId) {
      this.invalidateById(params.businessTripExpenseId);
    }
    return deleteBusinessTripOtherExpense.run(params, this.dbProvider);
  }

  public async invalidateById(expenseId: string) {
    const expense = await this.getBusinessTripsOtherExpensesByIdLoader.load(expenseId);
    if (expense?.business_trip_id) {
      this.getBusinessTripsOtherExpensesByBusinessTripIdLoader.clear(expense.business_trip_id);
    }
    this.getBusinessTripsOtherExpensesByIdLoader.clear(expenseId);
  }

  public async invalidateByBusinessTripId(businessTripId: string) {
    const expenses =
      await this.getBusinessTripsOtherExpensesByBusinessTripIdLoader.load(businessTripId);
    for (const expense of expenses ?? []) {
      this.getBusinessTripsOtherExpensesByIdLoader.clear(expense.id);
    }
    this.getBusinessTripsOtherExpensesByBusinessTripIdLoader.clear(businessTripId);
  }

  public clearCache() {
    this.getBusinessTripsOtherExpensesByBusinessTripIdLoader.clearAll();
    this.getBusinessTripsOtherExpensesByIdLoader.clearAll();
  }
}
