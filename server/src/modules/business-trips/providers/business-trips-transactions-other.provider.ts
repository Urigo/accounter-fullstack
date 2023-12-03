import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IGetAllBusinessTripsOtherTransactionsQuery,
  IGetBusinessTripsOtherTransactionsByBusinessTripIdsQuery,
  IGetBusinessTripsOtherTransactionsByChargeIdsQuery,
  IInsertBusinessTripOtherTransactionParams,
  IInsertBusinessTripOtherTransactionQuery,
  IUpdateBusinessTripOtherTransactionParams,
  IUpdateBusinessTripOtherTransactionQuery,
} from '../types.js';

const getAllBusinessTripsOtherTransactions = sql<IGetAllBusinessTripsOtherTransactionsQuery>`
  SELECT a.*, t.business_trip_id, t.category, t.date, t.amount, t.currency, t.employee_business_id, t.transaction_id
  FROM accounter_schema.business_trips_transactions_other a
  LEFT JOIN accounter_schema.business_trips_transactions t
    ON a.id = t.id`;

const getBusinessTripsOtherTransactionsByChargeIds = sql<IGetBusinessTripsOtherTransactionsByChargeIdsQuery>`
  SELECT btc.charge_id, a.*, t.business_trip_id, t.category, t.date, t.amount, t.currency, t.employee_business_id, t.transaction_id
  FROM accounter_schema.business_trips_transactions_other a
  LEFT JOIN accounter_schema.business_trips_transactions t
    ON a.id = t.id
  LEFT JOIN accounter_schema.business_trip_charges btc
    ON t.business_trip_id = btc.business_trip_id
  WHERE ($isChargeIds = 0 OR btc.charge_id IN $$chargeIds);`;

const getBusinessTripsOtherTransactionsByBusinessTripIds = sql<IGetBusinessTripsOtherTransactionsByBusinessTripIdsQuery>`
  SELECT a.*, t.business_trip_id, t.category, t.date, t.amount, t.currency, t.employee_business_id, t.transaction_id
  FROM accounter_schema.business_trips_transactions_other a
  LEFT JOIN accounter_schema.business_trips_transactions t
    ON a.id = t.id
  WHERE ($isBusinessTripIds = 0 OR t.business_trip_id IN $$businessTripIds);`;

const updateBusinessTripOtherTransaction = sql<IUpdateBusinessTripOtherTransactionQuery>`
  UPDATE accounter_schema.business_trips_transactions_other
  SET
  payed_by_employee = COALESCE(
    $payedByEmployee,
    payed_by_employee
  ),
  deductible_expense = COALESCE(
    $deductibleExpense,
    deductible_expense
  ),
  expense_type = COALESCE(
    $expenseType,
    expense_type
  )
  WHERE
    id = $businessTripTransactionId
  RETURNING *;
`;

const insertBusinessTripOtherTransaction = sql<IInsertBusinessTripOtherTransactionQuery>`
  INSERT INTO accounter_schema.business_trips_transactions_other (id, payed_by_employee, deductible_expense, expense_type)
  VALUES($id, $payedByEmployee, $deductibleExpense, $expenseType)
  RETURNING *;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class BusinessTripOtherTransactionsProvider {
  constructor(private dbProvider: DBProvider) {}

  public getAllBusinessTripsOtherTransactions() {
    return getAllBusinessTripsOtherTransactions.run(undefined, this.dbProvider);
  }

  private async batchBusinessTripsOtherTransactionsByChargeIds(chargeIds: readonly string[]) {
    const businessTripsOtherTransactions = await getBusinessTripsOtherTransactionsByChargeIds.run(
      {
        isChargeIds: chargeIds.length > 0 ? 1 : 0,
        chargeIds,
      },
      this.dbProvider,
    );
    return chargeIds.map(id =>
      businessTripsOtherTransactions.filter(record => record.charge_id === id),
    );
  }

  public getBusinessTripsOtherTransactionsByChargeIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsOtherTransactionsByChargeIds(ids),
    {
      cache: false,
    },
  );

  private async batchBusinessTripsOtherTransactionsByBusinessTripIds(
    businessTripIds: readonly string[],
  ) {
    const businessTripsOtherTransactions =
      await getBusinessTripsOtherTransactionsByBusinessTripIds.run(
        {
          isBusinessTripIds: businessTripIds.length > 0 ? 1 : 0,
          businessTripIds,
        },
        this.dbProvider,
      );
    return businessTripIds.map(id =>
      businessTripsOtherTransactions.filter(record => record.business_trip_id === id),
    );
  }

  public getBusinessTripsOtherTransactionsByBusinessTripIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsOtherTransactionsByBusinessTripIds(ids),
    {
      cache: false,
    },
  );

  public updateBusinessTripOtherTransaction(params: IUpdateBusinessTripOtherTransactionParams) {
    return updateBusinessTripOtherTransaction.run(params, this.dbProvider);
  }

  public insertBusinessTripOtherTransaction(params: IInsertBusinessTripOtherTransactionParams) {
    return insertBusinessTripOtherTransaction.run(params, this.dbProvider);
  }
}
