import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IDeleteBusinessTripFlightsExpenseParams,
  IDeleteBusinessTripFlightsExpenseQuery,
  IGetAllBusinessTripsFlightsExpensesQuery,
  IGetBusinessTripsFlightsExpensesByBusinessTripIdsQuery,
  IGetBusinessTripsFlightsExpensesByChargeIdsQuery,
  IGetBusinessTripsFlightsExpensesByIdsQuery,
  IInsertBusinessTripFlightsExpenseParams,
  IInsertBusinessTripFlightsExpenseQuery,
  IUpdateBusinessTripFlightsExpenseParams,
  IUpdateBusinessTripFlightsExpenseQuery,
} from '../types.js';

const getAllBusinessTripsFlightsExpenses = sql<IGetAllBusinessTripsFlightsExpensesQuery>`
  SELECT *
  FROM accounter_schema.business_trips_transactions_flights
  LEFT JOIN accounter_schema.extended_business_trip_transactions
  USING (id);`;

const getBusinessTripsFlightsExpensesByChargeIds = sql<IGetBusinessTripsFlightsExpensesByChargeIdsQuery>`
  SELECT btc.charge_id, f.*, t.business_trip_id, t.category, t.date, t.value_date, t.amount, t.currency, t.employee_business_id, t.payed_by_employee, t.transaction_ids
  FROM accounter_schema.business_trips_transactions_flights f
  LEFT JOIN accounter_schema.extended_business_trip_transactions t
    USING (id)
  LEFT JOIN accounter_schema.business_trip_charges btc
    ON t.business_trip_id = btc.business_trip_id
  WHERE ($isChargeIds = 0 OR btc.charge_id IN $$chargeIds);`;

const getBusinessTripsFlightsExpensesByBusinessTripIds = sql<IGetBusinessTripsFlightsExpensesByBusinessTripIdsQuery>`
  SELECT *
  FROM accounter_schema.business_trips_transactions_flights f
  LEFT JOIN accounter_schema.extended_business_trip_transactions t
    USING (id)
  WHERE ($isBusinessTripIds = 0 OR t.business_trip_id IN $$businessTripIds);`;

const getBusinessTripsFlightsExpensesByIds = sql<IGetBusinessTripsFlightsExpensesByIdsQuery>`
  SELECT *
  FROM accounter_schema.business_trips_transactions_flights f
  LEFT JOIN accounter_schema.extended_business_trip_transactions t
    USING (id)
  WHERE ($isIds = 0 OR t.id IN $$expenseIds);`;

const updateBusinessTripFlightsExpense = sql<IUpdateBusinessTripFlightsExpenseQuery>`
  UPDATE accounter_schema.business_trips_transactions_flights
  SET
  origin = COALESCE(
    $origin,
    origin
  ),
  destination = COALESCE(
    $destination,
    destination
  ),
  class = COALESCE(
    $class,
    class
  ),
  attendees = COALESCE(
    $attendeeIds,
    attendees
  )
  WHERE
    id = $businessTripExpenseId
  RETURNING *;
`;

const insertBusinessTripFlightsExpense = sql<IInsertBusinessTripFlightsExpenseQuery>`
  INSERT INTO accounter_schema.business_trips_transactions_flights (id, origin, destination, class, attendees)
  VALUES($id, $origin, $destination, $class, $attendeeIds)
  RETURNING *;`;

const deleteBusinessTripFlightsExpense = sql<IDeleteBusinessTripFlightsExpenseQuery>`
  DELETE FROM accounter_schema.business_trips_transactions_flights
  WHERE id = $businessTripExpenseId
  RETURNING id;
`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class BusinessTripFlightsExpensesProvider {
  constructor(private dbProvider: DBProvider) {}

  public getAllBusinessTripsFlightsExpenses() {
    return getAllBusinessTripsFlightsExpenses.run(undefined, this.dbProvider);
  }

  private async batchBusinessTripsFlightsExpensesByChargeIds(chargeIds: readonly string[]) {
    const businessTripsFlightsExpenses = await getBusinessTripsFlightsExpensesByChargeIds.run(
      {
        isChargeIds: chargeIds.length > 0 ? 1 : 0,
        chargeIds,
      },
      this.dbProvider,
    );
    return chargeIds.map(id =>
      businessTripsFlightsExpenses.filter(record => record.charge_id === id),
    );
  }

  public getBusinessTripsFlightsExpensesByChargeIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsFlightsExpensesByChargeIds(ids),
    {
      cache: false,
    },
  );

  private async batchBusinessTripsFlightsExpensesByBusinessTripIds(
    businessTripIds: readonly string[],
  ) {
    const businessTripsFlightsExpenses = await getBusinessTripsFlightsExpensesByBusinessTripIds.run(
      {
        isBusinessTripIds: businessTripIds.length > 0 ? 1 : 0,
        businessTripIds,
      },
      this.dbProvider,
    );
    return businessTripIds.map(id =>
      businessTripsFlightsExpenses.filter(record => record.business_trip_id === id),
    );
  }

  public getBusinessTripsFlightsExpensesByBusinessTripIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsFlightsExpensesByBusinessTripIds(ids),
    {
      cache: false,
    },
  );

  private async batchBusinessTripsFlightsExpensesByIds(expenseIds: readonly string[]) {
    const businessTripsFlightsExpenses = await getBusinessTripsFlightsExpensesByIds.run(
      {
        isIds: expenseIds.length > 0 ? 1 : 0,
        expenseIds,
      },
      this.dbProvider,
    );
    return expenseIds.map(id => businessTripsFlightsExpenses.filter(record => record.id === id));
  }

  public getBusinessTripsFlightsExpensesByIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsFlightsExpensesByIds(ids),
    {
      cache: false,
    },
  );

  public updateBusinessTripFlightsExpense(params: IUpdateBusinessTripFlightsExpenseParams) {
    return updateBusinessTripFlightsExpense.run(params, this.dbProvider);
  }

  public insertBusinessTripFlightsExpense(params: IInsertBusinessTripFlightsExpenseParams) {
    return insertBusinessTripFlightsExpense.run(params, this.dbProvider);
  }

  public deleteBusinessTripFlightsExpense(params: IDeleteBusinessTripFlightsExpenseParams) {
    return deleteBusinessTripFlightsExpense.run(params, this.dbProvider);
  }
}
