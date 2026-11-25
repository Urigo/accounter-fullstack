import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type {
  IGetBankDepositsRevaluationChargeDescriptionsQuery,
  IGetPoalimDepositTaxEventsByAccountIdsQuery,
  IGetPoalimDepositTaxEventsByAccountIdsResult,
} from '../types.js';

/**
 * Poalim deposits tax events of the given financial accounts. The bank rows carry the account's
 * bank / branch / number, matched here to the account the deposits are held in.
 */
const getPoalimDepositTaxEventsByAccountIds = sql<IGetPoalimDepositTaxEventsByAccountIdsQuery>`
  SELECT
    fa.id AS financial_account_id,
    e.id,
    e.executing_date,
    e.event_serial_number,
    e.action_type_description,
    e.short_product_name,
    e.tax_action_type_description,
    e.tax_event_amount,
    e.debit_amount,
    e.crdit_amount
  FROM accounter_schema.poalim_deposit_tax_events e
  INNER JOIN accounter_schema.financial_accounts fa
    ON fa.account_number = e.account_number::text
  INNER JOIN accounter_schema.financial_bank_accounts fba
    ON fba.id = fa.id
    AND fba.bank_number = e.bank_number
    AND fba.branch_number = e.branch_number
  WHERE fa.id IN $$accountIds
  ORDER BY e.executing_date, e.event_serial_number;`;

/** Descriptions of the bank-deposits year-end revaluation charges (they name their year) */
const getBankDepositsRevaluationChargeDescriptions = sql<IGetBankDepositsRevaluationChargeDescriptionsQuery>`
  SELECT user_description
  FROM accounter_schema.charges
  WHERE tax_category_id = $taxCategoryId
    AND type = 'FINANCIAL';`;

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class BankDepositTaxEventsProvider {
  constructor(private db: TenantAwareDBClient) {}

  private async batchTaxEventsByAccountIds(accountIds: readonly string[]) {
    const rows = await getPoalimDepositTaxEventsByAccountIds.run(
      { accountIds: Array.from(new Set(accountIds)) },
      this.db,
    );
    const byAccount = new Map<string, IGetPoalimDepositTaxEventsByAccountIdsResult[]>();
    for (const row of rows) {
      const list = byAccount.get(row.financial_account_id) ?? [];
      list.push(row);
      byAccount.set(row.financial_account_id, list);
    }
    return accountIds.map(id => byAccount.get(id) ?? []);
  }

  public taxEventsByAccountIdLoader = new DataLoader((accountIds: readonly string[]) =>
    this.batchTaxEventsByAccountIds(accountIds),
  );

  /** Years that have a bank-deposits year-end revaluation charge */
  public async getRevaluationYears(taxCategoryId: string): Promise<number[]> {
    const rows = await getBankDepositsRevaluationChargeDescriptions.run({ taxCategoryId }, this.db);
    const years = new Set<number>();
    for (const row of rows) {
      const match = row.user_description?.match(/\b(\d{4})\b/);
      if (match) years.add(Number(match[1]));
    }
    return Array.from(years).sort();
  }
}
