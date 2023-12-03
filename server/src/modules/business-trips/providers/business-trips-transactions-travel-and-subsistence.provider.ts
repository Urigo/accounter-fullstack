import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IGetAllBusinessTripsTravelAndSubsistenceTransactionsQuery,
  IGetBusinessTripsTravelAndSubsistenceTransactionsByBusinessTripIdsQuery,
  IGetBusinessTripsTravelAndSubsistenceTransactionsByChargeIdsQuery,
  IGetBusinessTripsTravelAndSubsistenceTransactionsByIdsQuery,
  IInsertBusinessTripTravelAndSubsistenceTransactionParams,
  IInsertBusinessTripTravelAndSubsistenceTransactionQuery,
  IUpdateBusinessTripTravelAndSubsistenceTransactionParams,
  IUpdateBusinessTripTravelAndSubsistenceTransactionQuery,
} from '../types.js';

const getAllBusinessTripsTravelAndSubsistenceTransactions = sql<IGetAllBusinessTripsTravelAndSubsistenceTransactionsQuery>`
  SELECT a.*, t.business_trip_id, t.category, t.date, t.amount, t.currency, t.employee_business_id, t.transaction_id
  FROM accounter_schema.business_trips_transactions_tns a
  LEFT JOIN accounter_schema.business_trips_transactions t
    ON a.id = t.id`;

const getBusinessTripsTravelAndSubsistenceTransactionsByChargeIds = sql<IGetBusinessTripsTravelAndSubsistenceTransactionsByChargeIdsQuery>`
  SELECT btc.charge_id, a.*, t.business_trip_id, t.category, t.date, t.amount, t.currency, t.employee_business_id, t.transaction_id
  FROM accounter_schema.business_trips_transactions_tns a
  LEFT JOIN accounter_schema.business_trips_transactions t
    ON a.id = t.id
  LEFT JOIN accounter_schema.business_trip_charges btc
    ON t.business_trip_id = btc.business_trip_id
  WHERE ($isChargeIds = 0 OR btc.charge_id IN $$chargeIds);`;

const getBusinessTripsTravelAndSubsistenceTransactionsByBusinessTripIds = sql<IGetBusinessTripsTravelAndSubsistenceTransactionsByBusinessTripIdsQuery>`
  SELECT a.*, t.business_trip_id, t.category, t.date, t.amount, t.currency, t.employee_business_id, t.transaction_id
  FROM accounter_schema.business_trips_transactions_tns a
  LEFT JOIN accounter_schema.business_trips_transactions t
    ON a.id = t.id
  WHERE ($isBusinessTripIds = 0 OR t.business_trip_id IN $$businessTripIds);`;

const getBusinessTripsTravelAndSubsistenceTransactionsByIds = sql<IGetBusinessTripsTravelAndSubsistenceTransactionsByIdsQuery>`
  SELECT a.*, t.business_trip_id, t.category, t.date, t.amount, t.currency, t.employee_business_id, t.transaction_id
  FROM accounter_schema.business_trips_transactions_tns a
  LEFT JOIN accounter_schema.business_trips_transactions t
    ON a.id = t.id
  WHERE ($isIds = 0 OR t.id IN $$transactionIds);`;

const updateBusinessTripTravelAndSubsistenceTransaction = sql<IUpdateBusinessTripTravelAndSubsistenceTransactionQuery>`
  UPDATE accounter_schema.business_trips_transactions_tns
  SET
  payed_by_employee = COALESCE(
    $payedByEmployee,
    payed_by_employee
  ),
  expense_type = COALESCE(
    $expanseType,
    expense_type
  )
  WHERE
    id = $businessTripTransactionId
  RETURNING *;
`;

const insertBusinessTripTravelAndSubsistenceTransaction = sql<IInsertBusinessTripTravelAndSubsistenceTransactionQuery>`
  INSERT INTO accounter_schema.business_trips_transactions_tns (id, payed_by_employee, expense_type)
  VALUES($id, $payedByEmployee, $expanseType)
  RETURNING *;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class BusinessTripTravelAndSubsistenceTransactionsProvider {
  constructor(private dbProvider: DBProvider) {}

  public getAllBusinessTripsTravelAndSubsistenceTransactions() {
    return getAllBusinessTripsTravelAndSubsistenceTransactions.run(undefined, this.dbProvider);
  }

  private async batchBusinessTripsTravelAndSubsistenceTransactionsByChargeIds(
    chargeIds: readonly string[],
  ) {
    const businessTripsTravelAndSubsistenceTransactions =
      await getBusinessTripsTravelAndSubsistenceTransactionsByChargeIds.run(
        {
          isChargeIds: chargeIds.length > 0 ? 1 : 0,
          chargeIds,
        },
        this.dbProvider,
      );
    return chargeIds.map(id =>
      businessTripsTravelAndSubsistenceTransactions.filter(record => record.charge_id === id),
    );
  }

  public getBusinessTripsTravelAndSubsistenceTransactionsByChargeIdLoader = new DataLoader(
    (ids: readonly string[]) =>
      this.batchBusinessTripsTravelAndSubsistenceTransactionsByChargeIds(ids),
    {
      cache: false,
    },
  );

  private async batchBusinessTripsTravelAndSubsistenceTransactionsByBusinessTripIds(
    businessTripIds: readonly string[],
  ) {
    const businessTripsTravelAndSubsistenceTransactions =
      await getBusinessTripsTravelAndSubsistenceTransactionsByBusinessTripIds.run(
        {
          isBusinessTripIds: businessTripIds.length > 0 ? 1 : 0,
          businessTripIds,
        },
        this.dbProvider,
      );
    return businessTripIds.map(id =>
      businessTripsTravelAndSubsistenceTransactions.filter(
        record => record.business_trip_id === id,
      ),
    );
  }

  public getBusinessTripsTravelAndSubsistenceTransactionsByBusinessTripIdLoader = new DataLoader(
    (ids: readonly string[]) =>
      this.batchBusinessTripsTravelAndSubsistenceTransactionsByBusinessTripIds(ids),
    {
      cache: false,
    },
  );

  private async batchBusinessTripsTravelAndSubsistenceTransactionsByIds(
    transactionIds: readonly string[],
  ) {
    const businessTripsTravelAndSubsistenceTransactions =
      await getBusinessTripsTravelAndSubsistenceTransactionsByIds.run(
        {
          isIds: transactionIds.length > 0 ? 1 : 0,
          transactionIds,
        },
        this.dbProvider,
      );
    return transactionIds.map(id =>
      businessTripsTravelAndSubsistenceTransactions.filter(record => record.id === id),
    );
  }

  public getBusinessTripsTravelAndSubsistenceTransactionsByIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchBusinessTripsTravelAndSubsistenceTransactionsByIds(ids),
    {
      cache: false,
    },
  );

  public updateBusinessTripTravelAndSubsistenceTransaction(
    params: IUpdateBusinessTripTravelAndSubsistenceTransactionParams,
  ) {
    return updateBusinessTripTravelAndSubsistenceTransaction.run(params, this.dbProvider);
  }

  public insertBusinessTripTravelAndSubsistenceTransaction(
    params: IInsertBusinessTripTravelAndSubsistenceTransactionParams,
  ) {
    return insertBusinessTripTravelAndSubsistenceTransaction.run(params, this.dbProvider);
  }
}
