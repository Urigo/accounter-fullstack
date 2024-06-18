import DataLoader from 'dataloader';
import { Injectable, Scope } from 'graphql-modules';
import { DBProvider } from '@modules/app-providers/db.provider.js';
import { sql } from '@pgtyped/runtime';
import type {
  IGetCreditCardTransactionsByChargeIdsQuery,
  IValidateCreditCardTransactionsAmountByChargeIdsQuery,
} from '../types.js';

const getCreditCardTransactionsByChargeIds = sql<IGetCreditCardTransactionsByChargeIdsQuery>`
  SELECT t.*
  FROM accounter_schema.extended_transactions origin_transaction
    left join lateral (SELECT t.*,
        origin_transaction.id        as origin_transaction_id,
        origin_transaction.charge_id as origin_charge_id,
        a.type,
        a.account_number
      FROM accounter_schema.extended_transactions t
      left join accounter_schema.financial_accounts a
        on a.id = t.account_id) t
      on t.account_number = origin_transaction.source_reference
        and t.type = 'creditcard'
        and t.currency = origin_transaction.currency
        and t.debit_date = origin_transaction.debit_date
  WHERE origin_transaction.charge_id in $$chargeIds;`;

const validateCreditCardTransactionsAmountByChargeIds = sql<IValidateCreditCardTransactionsAmountByChargeIdsQuery>`
  SELECT origin_transaction.charge_id           as origin_charge_id,
    (sum(t.amount) = origin_transaction.amount) as is_amount_match
  FROM accounter_schema.extended_transactions origin_transaction
    left join lateral (SELECT t.*,
        a.type,
        a.account_number
      FROM accounter_schema.extended_transactions t
      left join accounter_schema.financial_accounts a
        on a.id = t.account_id
    ) t
      on t.account_number = origin_transaction.source_reference
        and t.type = 'creditcard'
        and t.currency = origin_transaction.currency
        and t.debit_date = origin_transaction.debit_date
WHERE origin_transaction.charge_id in $$chargeIds
group by (origin_transaction.charge_id, origin_transaction.amount)`;

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class CreditCardTransactionsProvider {
  constructor(private dbProvider: DBProvider) {}

  private async batchCreditCardTransactionsByChargeIds(ids: readonly string[]) {
    const transactions = await getCreditCardTransactionsByChargeIds.run(
      {
        chargeIds: ids,
      },
      this.dbProvider,
    );
    return ids.map(id => transactions.filter(transaction => transaction.origin_charge_id === id));
  }

  public getCreditCardTransactionsByChargeIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchCreditCardTransactionsByChargeIds(keys),
    { cache: false },
  );

  private async batchValidateCreditCardTransactionsAmountByChargeIds(ids: readonly string[]) {
    const validations = await validateCreditCardTransactionsAmountByChargeIds.run(
      {
        chargeIds: ids,
      },
      this.dbProvider,
    );
    return ids.map(
      id => validations.find(validation => validation.origin_charge_id === id)?.is_amount_match,
    );
  }

  public validateCreditCardTransactionsAmountByChargeIdLoader = new DataLoader(
    (keys: readonly string[]) => this.batchValidateCreditCardTransactionsAmountByChargeIds(keys),
    { cache: false },
  );
}
