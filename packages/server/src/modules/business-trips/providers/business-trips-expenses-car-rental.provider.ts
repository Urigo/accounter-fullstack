import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IDeleteBusinessTripCarRentalExpenseParams,
  IDeleteBusinessTripCarRentalExpenseQuery,
  IGetAllBusinessTripsCarRentalExpensesQuery,
  IGetBusinessTripsCarRentalExpensesByBusinessTripIdsQuery,
  IGetBusinessTripsCarRentalExpensesByChargeIdsQuery,
  IGetBusinessTripsCarRentalExpensesByIdsQuery,
  IInsertBusinessTripCarRentalExpenseParams,
  IInsertBusinessTripCarRentalExpenseQuery,
  IUpdateBusinessTripCarRentalExpenseParams,
  IUpdateBusinessTripCarRentalExpenseQuery,
} from '../types.js';

const getAllBusinessTripsCarRentalExpenses = sql<IGetAllBusinessTripsCarRentalExpensesQuery>`
  SELECT*
  FROM accounter_schema.business_trips_transactions_car_rental a
  LEFT JOIN accounter_schema.extended_business_trip_transactions t
    USING (id);`;

const getBusinessTripsCarRentalExpensesByChargeIds = sql<IGetBusinessTripsCarRentalExpensesByChargeIdsQuery>`
  SELECT btc.charge_id, a.*, t.business_trip_id, t.category, t.date, t.value_date, t.amount, t.currency, t.employee_business_id, t.payed_by_employee, t.transaction_ids
  FROM accounter_schema.business_trips_transactions_car_rental a
  LEFT JOIN accounter_schema.extended_business_trip_transactions t
    USING (id)
  LEFT JOIN accounter_schema.business_trip_charges btc
    ON t.business_trip_id = btc.business_trip_id
  WHERE ($isChargeIds = 0 OR btc.charge_id IN $$chargeIds);`;

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
  scope: Scope.Singleton,
  global: true,
})
export class BusinessTripCarRentalExpensesProvider {
  constructor(private dbProvider: DBProvider) {}

  public getAllBusinessTripsCarRentalExpenses() {
    return getAllBusinessTripsCarRentalExpenses.run(undefined, this.dbProvider);
  }

  private async batchBusinessTripsCarRentalExpensesByChargeIds(chargeIds: readonly string[]) {
    const businessTripsCarRentalExpenses = await getBusinessTripsCarRentalExpensesByChargeIds.run(
      {
        isChargeIds: chargeIds.length > 0 ? 1 : 0,
        chargeIds,
      },
      this.dbProvider,
    );
    return chargeIds.map(id =>
      businessTripsCarRentalExpenses.filter(record => record.charge_id === id),
    );
  }

  public getBusinessTripsCarRentalExpensesByChargeIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsCarRentalExpensesByChargeIds(ids),
    {
      cache: false,
    },
  );

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
    {
      cache: false,
    },
  );

  private async batchBusinessTripsCarRentalExpensesByIds(expenseIds: readonly string[]) {
    const businessTripsCarRentalExpenses = await getBusinessTripsCarRentalExpensesByIds.run(
      {
        isIds: expenseIds.length > 0 ? 1 : 0,
        expenseIds,
      },
      this.dbProvider,
    );
    return expenseIds.map(id => businessTripsCarRentalExpenses.filter(record => record.id === id));
  }

  public getBusinessTripsCarRentalExpensesByIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsCarRentalExpensesByIds(ids),
    {
      cache: false,
    },
  );

  public updateBusinessTripCarRentalExpense(params: IUpdateBusinessTripCarRentalExpenseParams) {
    return updateBusinessTripCarRentalExpense.run(params, this.dbProvider);
  }

  public insertBusinessTripCarRentalExpense(params: IInsertBusinessTripCarRentalExpenseParams) {
    return insertBusinessTripCarRentalExpense.run(params, this.dbProvider);
  }

  public deleteBusinessTripCarRentalExpense(params: IDeleteBusinessTripCarRentalExpenseParams) {
    return deleteBusinessTripCarRentalExpense.run(params, this.dbProvider);
  }
}
