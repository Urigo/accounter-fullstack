import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { getCacheInstance } from '../../../shared/helpers/index.js';
import { DBProvider } from '../../app-providers/db.provider.js';
import type {
  IDeleteExpenseParams,
  IDeleteExpenseQuery,
  IGetExpensesByChargeIdsQuery,
  IGetExpensesByChargeIdsResult,
  IGetExpensesByFinancialEntityIdsQuery,
  IGetExpensesByIdsQuery,
  IInsertExpenseParams,
  IInsertExpenseQuery,
  IInsertExpensesParams,
  IInsertExpensesQuery,
  IReplaceMiscExpensesChargeIdParams,
  IReplaceMiscExpensesChargeIdQuery,
  IUpdateExpenseParams,
  IUpdateExpenseQuery,
} from '../types.js';

const getExpensesByChargeIds = sql<IGetExpensesByChargeIdsQuery>`
  SELECT *
  FROM accounter_schema.misc_expenses
  WHERE charge_id IN $$chargeIds;`;

const getExpensesByIds = sql<IGetExpensesByIdsQuery>`
  SELECT *
  FROM accounter_schema.misc_expenses
  WHERE id IN $$ids;`;

const getExpensesByFinancialEntityIds = sql<IGetExpensesByFinancialEntityIdsQuery>`
SELECT *
FROM accounter_schema.misc_expenses
WHERE creditor_id IN $$financialEntityIds OR debtor_id IN $$financialEntityIds;`;

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

const replaceMiscExpensesChargeId = sql<IReplaceMiscExpensesChargeIdQuery>`
    UPDATE accounter_schema.misc_expenses
      SET
      charge_id = $assertChargeID
    WHERE
      charge_id = $replaceChargeID
    RETURNING *
  `;

const insertExpense = sql<IInsertExpenseQuery>`
  INSERT INTO accounter_schema.misc_expenses (charge_id, creditor_id, debtor_id, amount, currency, description, invoice_date, value_date)
  VALUES ($chargeId, $creditorId, $debtorId, $amount, $currency, $description, $invoiceDate, $valueDate)
  RETURNING *;`;

const insertExpenses = sql<IInsertExpensesQuery>`
  INSERT INTO accounter_schema.misc_expenses (charge_id, creditor_id, debtor_id, amount, currency, description, invoice_date, value_date)
  VALUES $$miscExpenses(chargeId, creditorId, debtorId, amount, currency, description, invoiceDate, valueDate)
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

  private async batchExpensesByFinancialEntityIds(financialEntityIds: readonly string[]) {
    const expenses = await getExpensesByFinancialEntityIds.run(
      { financialEntityIds },
      this.dbProvider,
    );
    const expensesByFinancialEntityId = new Map<string, IGetExpensesByChargeIdsResult[]>();
    expenses.map(expense => {
      if (expensesByFinancialEntityId.has(expense.creditor_id)) {
        expensesByFinancialEntityId.get(expense.creditor_id)?.push(expense);
      } else {
        expensesByFinancialEntityId.set(expense.creditor_id, [expense]);
      }
      if (expensesByFinancialEntityId.has(expense.debtor_id)) {
        expensesByFinancialEntityId.get(expense.debtor_id)?.push(expense);
      } else {
        expensesByFinancialEntityId.set(expense.debtor_id, [expense]);
      }
    });
    return financialEntityIds.map(id => expensesByFinancialEntityId.get(id) ?? []);
  }

  public getExpensesByFinancialEntityIdLoader = new DataLoader(
    (financialEntityIds: readonly string[]) =>
      this.batchExpensesByFinancialEntityIds(financialEntityIds),
    {
      cacheKeyFn: key => `misc-expenses-financial-entity-${key}`,
      cacheMap: this.cache,
    },
  );

  private async batchExpensesByIds(ids: readonly string[]) {
    const expenses = await getExpensesByIds.run({ ids }, this.dbProvider);
    return ids.map(id => expenses.find(expense => expense.id === id));
  }

  public getExpensesByIdLoader = new DataLoader(
    (ids: readonly string[]) => this.batchExpensesByIds(ids),
    {
      cacheKeyFn: key => `misc-expenses-${key}`,
      cacheMap: this.cache,
    },
  );

  public async updateExpense(params: IUpdateExpenseParams) {
    if (params.miscExpenseId) await this.invalidateById(params.miscExpenseId);
    return updateExpense.run(params, this.dbProvider);
  }

  public async replaceMiscExpensesChargeId(params: IReplaceMiscExpensesChargeIdParams) {
    if (params.assertChargeID) {
      await this.invalidateByChargeId(params.assertChargeID);
    }
    if (params.replaceChargeID) {
      await this.invalidateByChargeId(params.replaceChargeID);
    }
    return replaceMiscExpensesChargeId.run(params, this.dbProvider);
  }

  public async insertExpense(params: IInsertExpenseParams) {
    if (params.chargeId) await this.invalidateByChargeId(params.chargeId);
    return insertExpense.run(params, this.dbProvider);
  }

  public async insertExpenses(params: IInsertExpensesParams) {
    const chargeIds = Array.from(
      new Set(params.miscExpenses.map(({ chargeId }) => chargeId)),
    ).filter(id => !!id) as string[];
    if (chargeIds.length) {
      await Promise.all(chargeIds.map(chargeId => this.invalidateByChargeId(chargeId)));
    }
    return insertExpenses.run(params, this.dbProvider);
  }

  public async deleteMiscExpense(params: IDeleteExpenseParams) {
    if (params.id) await this.invalidateById(params.id);
    return deleteExpense.run(params, this.dbProvider);
  }

  public async invalidateByChargeId(chargeId: string) {
    try {
      const expenses = await this.getExpensesByChargeIdLoader.load(chargeId);
      await Promise.all(expenses.map(({ id }) => this.invalidateById(id)));
      this.cache.delete(`misc-expenses-charge-${chargeId}`);
    } catch (error) {
      const message = `Error invalidating misc expense by charge id: ${chargeId}`;
      console.error(`${message}: ${error}`);
      throw new Error(message);
    }
  }

  public async invalidateByFinancialEntityId(financialEntityId: string) {
    try {
      const expenses = await this.getExpensesByFinancialEntityIdLoader.load(financialEntityId);
      await Promise.all(expenses.map(({ id }) => this.invalidateById(id)));
      this.cache.delete(`misc-expenses-financial-entity-${financialEntityId}`);
    } catch (error) {
      const message = `Error invalidating misc expense by financial entity id: ${financialEntityId}`;
      console.error(`${message}: ${error}`);
      throw new Error(message);
    }
  }

  public async invalidateById(id: string) {
    try {
      const expense = await this.getExpensesByIdLoader.load(id);
      if (expense) {
        this.cache.delete(`misc-expenses-charge-${expense.charge_id}`);
        this.cache.delete(`misc-expenses-financial-entity-${expense.creditor_id}`);
        this.cache.delete(`misc-expenses-financial-entity-${expense.debtor_id}`);
      }
      this.cache.delete(`misc-expenses-${id}`);
    } catch (error) {
      const message = `Error invalidating misc expense by id: ${id}`;
      console.error(`${message}: ${error}`);
      throw new Error(message);
    }
  }

  public clearCache() {
    this.cache.clear();
  }
}
