import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IDeleteBusinessTripTravelAndSubsistenceExpenseParams,
  IDeleteBusinessTripTravelAndSubsistenceExpenseQuery,
  IGetAllBusinessTripsTravelAndSubsistenceExpensesQuery,
  IGetBusinessTripsTravelAndSubsistenceExpensesByBusinessTripIdsQuery,
  IGetBusinessTripsTravelAndSubsistenceExpensesByChargeIdsQuery,
  IGetBusinessTripsTravelAndSubsistenceExpensesByIdsQuery,
  IInsertBusinessTripTravelAndSubsistenceExpenseParams,
  IInsertBusinessTripTravelAndSubsistenceExpenseQuery,
  IUpdateBusinessTripTravelAndSubsistenceExpenseParams,
  IUpdateBusinessTripTravelAndSubsistenceExpenseQuery,
} from '../types.js';

const getAllBusinessTripsTravelAndSubsistenceExpenses = sql<IGetAllBusinessTripsTravelAndSubsistenceExpensesQuery>`
  SELECT *
  FROM accounter_schema.business_trips_transactions_tns a
  LEFT JOIN accounter_schema.extended_business_trip_transactions t
    USING (id);`;

const getBusinessTripsTravelAndSubsistenceExpensesByChargeIds = sql<IGetBusinessTripsTravelAndSubsistenceExpensesByChargeIdsQuery>`
  SELECT btc.charge_id, a.*, t.business_trip_id, t.category, t.date, t.value_date, t.amount, t.currency, t.employee_business_id, t.payed_by_employee, t.transaction_ids
  FROM accounter_schema.business_trips_transactions_tns a
  LEFT JOIN accounter_schema.extended_business_trip_transactions t
    USING (id)
  LEFT JOIN accounter_schema.business_trip_charges btc
    ON t.business_trip_id = btc.business_trip_id
  WHERE ($isChargeIds = 0 OR btc.charge_id IN $$chargeIds);`;

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
  constructor(private dbProvider: DBProvider) {}

  public getAllBusinessTripsTravelAndSubsistenceExpenses() {
    return getAllBusinessTripsTravelAndSubsistenceExpenses.run(undefined, this.dbProvider);
  }

  private async batchBusinessTripsTravelAndSubsistenceExpensesByChargeIds(
    chargeIds: readonly string[],
  ) {
    const businessTripsTravelAndSubsistenceExpenses =
      await getBusinessTripsTravelAndSubsistenceExpensesByChargeIds.run(
        {
          isChargeIds: chargeIds.length > 0 ? 1 : 0,
          chargeIds,
        },
        this.dbProvider,
      );
    return chargeIds.map(id =>
      businessTripsTravelAndSubsistenceExpenses.filter(record => record.charge_id === id),
    );
  }

  public getBusinessTripsTravelAndSubsistenceExpensesByChargeIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsTravelAndSubsistenceExpensesByChargeIds(ids),
    {
      cache: false,
    },
  );

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
      cache: false,
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
      businessTripsTravelAndSubsistenceExpenses.filter(record => record.id === id),
    );
  }

  public getBusinessTripsTravelAndSubsistenceExpensesByIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsTravelAndSubsistenceExpensesByIds(ids),
    {
      cache: false,
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
}
