import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IDeleteBusinessTripOtherExpenseParams,
  IDeleteBusinessTripOtherExpenseQuery,
  IGetAllBusinessTripsOtherExpensesQuery,
  IGetBusinessTripsOtherExpensesByBusinessTripIdsQuery,
  IGetBusinessTripsOtherExpensesByChargeIdsQuery,
  IGetBusinessTripsOtherExpensesByIdsQuery,
  IInsertBusinessTripOtherExpenseParams,
  IInsertBusinessTripOtherExpenseQuery,
  IUpdateBusinessTripOtherExpenseParams,
  IUpdateBusinessTripOtherExpenseQuery,
} from '../types.js';

const getAllBusinessTripsOtherExpenses = sql<IGetAllBusinessTripsOtherExpensesQuery>`
  SELECT*
  FROM accounter_schema.business_trips_transactions_other a
  LEFT JOIN accounter_schema.extended_business_trip_transactions t
    USING (id);`;

const getBusinessTripsOtherExpensesByChargeIds = sql<IGetBusinessTripsOtherExpensesByChargeIdsQuery>`
  SELECT btc.charge_id, a.*, t.business_trip_id, t.category, t.date, t.value_date, t.amount, t.currency, t.employee_business_id, t.payed_by_employee, t.transaction_ids
  FROM accounter_schema.business_trips_transactions_other a
  LEFT JOIN accounter_schema.extended_business_trip_transactions t
    USING (id)
  LEFT JOIN accounter_schema.business_trip_charges btc
    ON t.business_trip_id = btc.business_trip_id
  WHERE ($isChargeIds = 0 OR btc.charge_id IN $$chargeIds);`;

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
  constructor(private dbProvider: DBProvider) {}

  public getAllBusinessTripsOtherExpenses() {
    return getAllBusinessTripsOtherExpenses.run(undefined, this.dbProvider);
  }

  private async batchBusinessTripsOtherExpensesByChargeIds(chargeIds: readonly string[]) {
    const businessTripsOtherExpenses = await getBusinessTripsOtherExpensesByChargeIds.run(
      {
        isChargeIds: chargeIds.length > 0 ? 1 : 0,
        chargeIds,
      },
      this.dbProvider,
    );
    return chargeIds.map(id =>
      businessTripsOtherExpenses.filter(record => record.charge_id === id),
    );
  }

  public getBusinessTripsOtherExpensesByChargeIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsOtherExpensesByChargeIds(ids),
    {
      cache: false,
    },
  );

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
      cache: false,
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
    return expenseIds.map(id => businessTripsOtherExpenses.filter(record => record.id === id));
  }

  public getBusinessTripsOtherExpensesByIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsOtherExpensesByIds(ids),
    {
      cache: false,
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
}
