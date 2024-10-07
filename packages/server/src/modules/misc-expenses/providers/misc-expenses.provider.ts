import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IDeleteExpenseParams,
  IDeleteExpenseQuery,
  IGetExpensesByChargeIdsQuery,
  IGetExpensesByChargeIdsResult,
  IInsertExpenseParams,
  IInsertExpenseQuery,
  IUpdateExpenseParams,
  IUpdateExpenseQuery,
} from '../types.js';

const getExpensesByChargeIds = sql<IGetExpensesByChargeIdsQuery>`
  SELECT e.*
  FROM accounter_schema.misc_expenses e
  WHERE e.charge_id IN $$chargeIds;`;

const updateExpense = sql<IUpdateExpenseQuery>`
  UPDATE accounter_schema.misc_expenses
  SET
  charge_id = COALESCE(
    $chargeId,
    charge_id
  ),
  creditor_id = COALESCE(
    $creditorId,
    creditor_id
  ),
  debtor_id = COALESCE(
    $debtorId,
    debtor_id
  ),
  amount = COALESCE(
    $amount,
    amount
  ),
  currency = COALESCE(
    $currency,
    currency
  ),
  description = COALESCE(
    $description,
    description
  ),
  invoice_date = COALESCE(
    $invoiceDate,
    invoice_date
  ),
  value_date = COALESCE(
    $valueDate,
    value_date
  )
  WHERE
    id = $miscExpenseId
  RETURNING *;`;

const insertExpense = sql<IInsertExpenseQuery>`
  INSERT INTO accounter_schema.misc_expenses (charge_id, creditor_id, debtor_id, amount, currency, description, invoice_date, value_date)
  VALUES ($chargeId, $creditorId, $debtorId, $amount, $currency, $description, $invoiceDate, $valueDate)
  RETURNING *;`;

const deleteExpense = sql<IDeleteExpenseQuery>`
  DELETE FROM accounter_schema.misc_expenses
  WHERE id = $id
  RETURNING id;`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class MiscExpensesProvider {
  constructor(private dbProvider: DBProvider) {}

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

  public deleteMiscExpense(params: IDeleteExpenseParams) {
    return deleteExpense.run(params, this.dbProvider);
  }
}
