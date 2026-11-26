import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import type {
  InsertedTransactionSummary,
  LeumiCreditCardTransactionInput,
  LeumiForeignTransactionInput,
  LeumiIlsTransactionInput,
  ScraperUploadResult,
} from '../../../__generated__/types.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { AuthContextProvider } from '../../auth/providers/auth-context.provider.js';
import { toCalendarDate } from '../helpers/utils.helper.js';
import type {
  IUploadLeumiCreditCardTransactionsQuery,
  IUploadLeumiForeignTransactionsQuery,
  IUploadLeumiIlsTransactionsQuery,
} from '../types.js';

const uploadLeumiIlsTransactions = sql<IUploadLeumiIlsTransactionsQuery>`
  INSERT INTO accounter_schema.leumi_ils_account_transactions (
    account_number,
    date,
    effective_date,
    amount,
    credit,
    debit,
    description,
    additional_data,
    running_balance,
    reference_number,
    check_number,
    fitid,
    type_code,
    additional_activity_type,
    extension_type_code,
    segmentation_flag,
    credit_card_index,
    if_link,
    owner_id
  )
  VALUES $$transactions(
    accountNumber,
    date,
    effectiveDate,
    amount,
    credit,
    debit,
    description,
    additionalData,
    runningBalance,
    referenceNumber,
    checkNumber,
    fitid,
    typeCode,
    additionalActivityType,
    extensionTypeCode,
    segmentationFlag,
    creditCardIndex,
    ifLink,
    ownerId
  )
  ON CONFLICT (owner_id, account_number, fitid, amount, running_balance) DO NOTHING
  RETURNING id, account_number, date, description, amount;
`;

const uploadLeumiForeignTransactions = sql<IUploadLeumiForeignTransactionsQuery>`
  INSERT INTO accounter_schema.leumi_foreign_account_transactions (
    account_number,
    currency,
    date,
    description,
    reference,
    debit,
    credit,
    balance,
    owner_id
  )
  VALUES $$transactions(
    accountNumber,
    currency,
    date,
    description,
    reference,
    debit,
    credit,
    balance,
    ownerId
  )
  ON CONFLICT (owner_id, account_number, date, reference, description, debit, credit, balance) DO NOTHING
  RETURNING id, account_number, date, description, debit, credit;
`;

const uploadLeumiCreditCardTransactions = sql<IUploadLeumiCreditCardTransactionsQuery>`
  INSERT INTO accounter_schema.leumi_creditcard_transactions (
    card_last4,
    related_account_number,
    card_transaction_id,
    deal_date,
    debit_date,
    merchant_name,
    deal_description,
    deal_amount,
    deal_currency_code,
    charge_amount,
    charge_currency,
    transaction_type,
    table_id,
    owner_id
  )
  VALUES $$transactions(
    cardLast4,
    relatedAccountNumber,
    cardTransactionId,
    dealDate,
    debitDate,
    merchantName,
    dealDescription,
    dealAmount,
    dealCurrencyCode,
    chargeAmount,
    chargeCurrency,
    transactionType,
    tableId,
    ownerId
  )
  ON CONFLICT (owner_id, card_last4, card_transaction_id, debit_date) DO NOTHING
  RETURNING id, card_last4, deal_date, merchant_name, charge_amount;
`;

const EMPTY_RESULT: ScraperUploadResult = {
  inserted: 0,
  skipped: 0,
  insertedIds: [],
  insertedTransactions: [],
  changedTransactions: [],
};

/**
 * Bank Leumi uploads. A row that is already stored is skipped (`ON CONFLICT DO NOTHING`).
 *
 * Unlike the Poalim and Otsar Hahayal providers this one does not report rows whose other
 * fields changed since they were stored: `changedTransactions` is always empty.
 */
@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class LeumiScraperIngestionProvider {
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

  private toResult(
    received: number,
    insertedTransactions: InsertedTransactionSummary[],
  ): ScraperUploadResult {
    const insertedIds = insertedTransactions.map(t => t.id);
    return {
      inserted: insertedIds.length,
      skipped: received - insertedIds.length,
      insertedIds,
      insertedTransactions,
      changedTransactions: [],
    };
  }

  async uploadLeumiIlsTransactions(
    transactions: readonly LeumiIlsTransactionInput[],
  ): Promise<ScraperUploadResult> {
    if (transactions.length === 0) return EMPTY_RESULT;
    const ownerId = await this.getBusinessId();

    const result = await uploadLeumiIlsTransactions.run(
      {
        transactions: transactions.map(t => ({
          accountNumber: t.accountNumber,
          date: toCalendarDate(t.date),
          effectiveDate: toCalendarDate(t.effectiveDate),
          amount: t.amount,
          credit: t.credit,
          debit: t.debit,
          description: t.description,
          additionalData: t.additionalData ?? null,
          runningBalance: t.runningBalance,
          referenceNumber: t.referenceNumber,
          checkNumber: t.checkNumber,
          fitid: t.fitid,
          typeCode: t.typeCode,
          additionalActivityType: t.additionalActivityType,
          extensionTypeCode: t.extensionTypeCode,
          segmentationFlag: t.segmentationFlag,
          creditCardIndex: t.creditCardIndex,
          ifLink: t.ifLink,
          ownerId,
        })),
      },
      this.db,
    );

    return this.toResult(
      transactions.length,
      result.map(r => ({
        id: r.id,
        date: r.date,
        description: r.description,
        amount: String(r.amount),
        account: r.account_number,
      })),
    );
  }

  async uploadLeumiForeignTransactions(
    transactions: readonly LeumiForeignTransactionInput[],
  ): Promise<ScraperUploadResult> {
    if (transactions.length === 0) return EMPTY_RESULT;
    const ownerId = await this.getBusinessId();

    const result = await uploadLeumiForeignTransactions.run(
      {
        transactions: transactions.map(t => ({
          accountNumber: t.accountNumber,
          currency: t.currency,
          date: toCalendarDate(t.date),
          description: t.description,
          reference: t.reference,
          debit: t.debit,
          credit: t.credit,
          balance: t.balance,
          ownerId,
        })),
      },
      this.db,
    );

    return this.toResult(
      transactions.length,
      result.map(r => ({
        id: r.id,
        date: r.date,
        description: r.description,
        amount: Number(r.debit) === 0 ? String(r.credit) : String(-Number(r.debit)),
        account: r.account_number,
      })),
    );
  }

  async uploadLeumiCreditCardTransactions(
    transactions: readonly LeumiCreditCardTransactionInput[],
  ): Promise<ScraperUploadResult> {
    if (transactions.length === 0) return EMPTY_RESULT;
    const ownerId = await this.getBusinessId();

    const result = await uploadLeumiCreditCardTransactions.run(
      {
        transactions: transactions.map(t => ({
          cardLast4: t.cardLast4,
          relatedAccountNumber: t.relatedAccountNumber,
          cardTransactionId: t.cardTransactionId,
          dealDate: toCalendarDate(t.dealDate),
          debitDate: toCalendarDate(t.debitDate),
          merchantName: t.merchantName,
          dealDescription: t.dealDescription ?? '',
          dealAmount: t.dealAmount,
          dealCurrencyCode: t.dealCurrencyCode,
          chargeAmount: t.chargeAmount,
          chargeCurrency: t.chargeCurrency,
          transactionType: t.transactionType,
          tableId: t.tableId,
          ownerId,
        })),
      },
      this.db,
    );

    return this.toResult(
      transactions.length,
      result.map(r => ({
        id: r.id,
        date: r.deal_date,
        description: r.merchant_name,
        amount: String(-Number(r.charge_amount)),
        account: r.card_last4,
      })),
    );
  }
}
