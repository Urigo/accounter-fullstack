import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IGetAllAuthoritiesQuery,
  IGetExpensesByChargeIdsQuery,
  IGetExpensesByChargeIdsResult,
  IGetExpensesByTransactionIdsQuery,
  IInsertExpenseParams,
  IInsertExpenseQuery,
  IUpdateExpenseParams,
  IUpdateExpenseQuery,
} from '../types.js';

const getAllAuthorities = sql<IGetAllAuthoritiesQuery>`
  SELECT * FROM accounter_schema.businesses
  WHERE is_authority IS TRUE;`;

const getExpensesByTransactionIds = sql<IGetExpensesByTransactionIdsQuery>`
  SELECT *
  FROM accounter_schema.authorities_misc_expenses
  WHERE transaction_id IN $$transactionIds;`;

const getExpensesByChargeIds = sql<IGetExpensesByChargeIdsQuery>`
  SELECT t.charge_id, e.*
  FROM accounter_schema.authorities_misc_expenses e
  LEFT JOIN accounter_schema.transactions t
    ON e.transaction_id = t.id
  WHERE t.charge_id IN $$chargeIds;`;

const updateExpense = sql<IUpdateExpenseQuery>`
  UPDATE accounter_schema.authorities_misc_expenses
  SET
  transaction_id = COALESCE(
    $transactionId,
    transaction_id
  ),
  counterparty = COALESCE(
    $counterpartyId,
    counterparty
  ),
  amount = COALESCE(
    $amount,
    amount
  ),
  description = COALESCE(
    $description,
    description
  ),
  date = COALESCE(
    $date,
    date
  )
  WHERE
    transaction_id = $transactionId
  RETURNING *;`;

const insertExpense = sql<IInsertExpenseQuery>`
  INSERT INTO accounter_schema.authorities_misc_expenses (transaction_id, counterparty, amount, description, date)
  VALUES ($transactionId, $counterpartyId, $amount, $description, $date)
  RETURNING *`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class MiscExpensesProvider {
  constructor(private dbProvider: DBProvider) {}

  public getAllAuthorities() {
    return getAllAuthorities.run(undefined, this.dbProvider);
  }

  private async batchExpensesByTransactionIds(transactionIds: readonly string[]) {
    const expenses = await getExpensesByTransactionIds.run({ transactionIds }, this.dbProvider);
    return transactionIds.map(id => expenses.filter(expense => expense.transaction_id === id));
  }

  public getExpensesByTransactionIdLoader = new DataLoader(
    (transactionIds: readonly string[]) => this.batchExpensesByTransactionIds(transactionIds),
    {
      cache: false,
    },
  );

  private async batchExpensesByChargeIds(chargeIds: readonly string[]) {
    const expenses = await getExpensesByChargeIds.run({ chargeIds }, this.dbProvider);
    const expensesByChargeId = new Map<string, IGetExpensesByChargeIdsResult[]>();
    expenses.map(expense => {
      if (expensesByChargeId.has(expense.charge_id)) {
        expensesByChargeId.get(expense.charge_id)?.push(expense);
      } else {
        expensesByChargeId.set(expense.charge_id, [expense]);
      }
    });
    return chargeIds.map(id => expensesByChargeId.get(id) ?? []);
  }

  public getExpensesByChargeIdLoader = new DataLoader(
    (chargeIds: readonly string[]) => this.batchExpensesByChargeIds(chargeIds),
    {
      cache: false,
    },
  );

  public updateExpense(params: IUpdateExpenseParams) {
    return updateExpense.run(params, this.dbProvider);
  }

  public insertExpense(params: IInsertExpenseParams) {
    return insertExpense.run(params, this.dbProvider);
  }
}
