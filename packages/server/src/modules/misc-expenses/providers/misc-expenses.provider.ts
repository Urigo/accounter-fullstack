import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '@shared/helpers';
import type {
  IDeleteExpenseParams,
  IDeleteExpenseQuery,
  IGetExpensesByChargeIdsQuery,
  IGetExpensesByChargeIdsResult,
  IGetExpensesByIdQuery,
  IInsertExpenseParams,
  IInsertExpenseQuery,
  IUpdateExpenseParams,
  IUpdateExpenseQuery,
} from '../types.js';

const getExpensesByChargeIds = sql<IGetExpensesByChargeIdsQuery>`
  SELECT *
  FROM accounter_schema.misc_expenses
  WHERE charge_id IN $$chargeIds;`;

const getExpensesById = sql<IGetExpensesByIdQuery>`
  SELECT *
  FROM accounter_schema.misc_expenses
  WHERE id = $id;`;

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
  cache = getCacheInstance({
    stdTTL: 60 * 5,
  });

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
      cacheKeyFn: key => `misc-expenses-charge-${key}`,
      cacheMap: this.cache,
    },
  );

  public updateExpense(params: IUpdateExpenseParams) {
    if (params.miscExpenseId) this.invalidateById(params.miscExpenseId);
    if (params.chargeId) this.invalidateByChargeId(params.chargeId);
    return updateExpense.run(params, this.dbProvider);
  }

  public insertExpense(params: IInsertExpenseParams) {
    if (params.chargeId) this.invalidateByChargeId(params.chargeId);
    return insertExpense.run(params, this.dbProvider);
  }

  public deleteMiscExpense(params: IDeleteExpenseParams) {
    if (params.id) this.invalidateById(params.id);
    return deleteExpense.run(params, this.dbProvider);
  }

  public async invalidateByChargeId(chargeId: string) {
    this.cache.delete(`misc-expenses-charge-${chargeId}`);
  }

  public async invalidateById(id: string) {
    const [expense] = await getExpensesById.run({ id }, this.dbProvider);
    if (expense) this.invalidateByChargeId(expense.charge_id);
  }

  public clearCache() {
    this.cache.clear();
  }
}
