import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import type {
  ChangedField,
  ChangedTransaction,
  InsertedTransactionSummary,
  PayoneerTransactionInput,
  ScraperUploadResult,
} from '../../../__generated__/types.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { AuthContextProvider } from '../../auth/providers/auth-context.provider.js';
import { formatValue } from '../helpers/utils.helper.js';
import type {
  IFetchPayoneerTransactionsByKeysQuery,
  IFetchPayoneerTransactionsByKeysResult,
  IUploadPayoneerTransactionsQuery,
} from '../types.js';

const fetchPayoneerTransactionsByKeys = sql<IFetchPayoneerTransactionsByKeysQuery>`
  SELECT id, account_id, transaction_id, status, amount, fee, balance
  FROM accounter_schema.payoneer_transactions
  WHERE account_id = ANY($accountIds!)
    AND transaction_id = ANY($transactionIds!);
`;

const uploadPayoneerTransactions = sql<IUploadPayoneerTransactionsQuery>`
  INSERT INTO accounter_schema.payoneer_transactions (
    owner_id,
    account_id,
    transaction_id,
    activity_type,
    status,
    activity_date,
    currency,
    amount,
    fee,
    balance,
    description,
    counterparty_name,
    payment_description,
    receiving_account,
    transfer_id,
    target_account,
    gross_amount,
    amount_sent,
    raw_data
  )
  VALUES $$transactions(
    ownerId,
    accountId,
    transactionId,
    activityType,
    status,
    activityDate,
    currency,
    amount,
    fee,
    balance,
    description,
    counterpartyName,
    paymentDescription,
    receivingAccount,
    transferId,
    targetAccount,
    grossAmount,
    amountSent,
    rawData
  )
  ON CONFLICT (owner_id, account_id, transaction_id) DO NOTHING
  RETURNING id, account_id, transaction_id, activity_date, description, amount;
`;

/**
 * Payoneer reports activity times in UTC without an offset (`2026-01-15T06:04:27.577`); pin them
 * to UTC so Postgres does not read them in the session time zone.
 */
export function toPayoneerInstant(value: string): string {
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`;
}

function diffPayoneerRow(
  existing: IFetchPayoneerTransactionsByKeysResult,
  incoming: PayoneerTransactionInput,
): ChangedField[] {
  const fields: Array<[string, unknown, unknown, boolean]> = [
    ['status', existing.status, incoming.status ?? null, true],
    ['amount', existing.amount, incoming.amount, true],
    ['fee', existing.fee, incoming.fee, true],
    ['balance', existing.balance, incoming.balance ?? null, true],
  ];
  const changed: ChangedField[] = [];
  for (const [field, oldRaw, newRaw, isNumber] of fields) {
    const oldValue = formatValue(oldRaw, isNumber);
    const newValue = formatValue(newRaw, isNumber);
    if (oldValue !== newValue) {
      changed.push({ field, oldValue, newValue });
    }
  }
  return changed;
}

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class PayoneerScraperIngestionProvider {
  private businessIdCache: string | null = null;

  constructor(
    private db: TenantAwareDBClient,
    private authContextProvider: AuthContextProvider,
  ) {}

  private async getBusinessId() {
    if (this.businessIdCache !== null) {
      return this.businessIdCache;
    }
    const authContext = await this.authContextProvider.getAuthContext();
    this.businessIdCache = authContext?.tenant.businessId ?? null;
    return this.businessIdCache;
  }

  /**
   * Inserts Payoneer activity items. Rows are immutable once inserted (the insert trigger books
   * them), so callers should upload completed items only; a re-upload of a known item is skipped,
   * and any difference in its status or amounts is reported under `changedTransactions`.
   */
  async uploadPayoneerTransactions(
    transactions: readonly PayoneerTransactionInput[],
  ): Promise<ScraperUploadResult> {
    if (transactions.length === 0)
      return {
        inserted: 0,
        skipped: 0,
        insertedIds: [],
        insertedTransactions: [],
        changedTransactions: [],
      };

    const accountIds = [...new Set(transactions.map(t => t.accountId))];
    const transactionIds = [...new Set(transactions.map(t => t.transactionId))];
    const existing = await fetchPayoneerTransactionsByKeys.run(
      { accountIds, transactionIds },
      this.db,
    );
    const existingByKey = new Map(
      existing.map(row => [`${row.account_id}_${row.transaction_id}`, row]),
    );

    const ownerId = await this.getBusinessId();

    const params = transactions.map(t => ({
      ownerId,
      accountId: t.accountId,
      transactionId: t.transactionId,
      activityType: t.activityType,
      status: t.status ?? null,
      activityDate: toPayoneerInstant(t.activityDate),
      currency: t.currency,
      amount: t.amount,
      fee: t.fee,
      balance: t.balance ?? null,
      description: t.description,
      counterpartyName: t.counterpartyName ?? null,
      paymentDescription: t.paymentDescription ?? null,
      receivingAccount: t.receivingAccount ?? null,
      transferId: t.transferId ?? null,
      targetAccount: t.targetAccount ?? null,
      grossAmount: t.grossAmount ?? null,
      amountSent: t.amountSent ?? null,
      rawData: t.rawData ? JSON.parse(t.rawData) : null,
    }));

    const result = await uploadPayoneerTransactions.run({ transactions: params }, this.db);
    const insertedIds = result.map(r => r.id);
    const insertedIdSet = new Set(insertedIds);

    const insertedTransactions: InsertedTransactionSummary[] = result.map(r => ({
      id: r.id,
      date: r.activity_date.toISOString(),
      description: r.description,
      amount: String(r.amount),
      account: r.account_id,
    }));

    const changedTransactions: ChangedTransaction[] = [];
    for (const t of transactions) {
      const existingRow = existingByKey.get(`${t.accountId}_${t.transactionId}`);
      if (existingRow && !insertedIdSet.has(existingRow.id)) {
        const changedFields = diffPayoneerRow(existingRow, t);
        if (changedFields.length > 0) {
          changedTransactions.push({ id: existingRow.id, changedFields });
        }
      }
    }

    return {
      inserted: insertedIds.length,
      skipped: transactions.length - insertedIds.length,
      insertedIds,
      insertedTransactions,
      changedTransactions,
    };
  }
}
