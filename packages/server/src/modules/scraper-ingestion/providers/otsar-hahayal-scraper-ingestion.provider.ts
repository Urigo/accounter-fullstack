import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import type {
  ChangedField,
  ChangedTransaction,
  InsertedTransactionSummary,
  OtsarHahayalCreditCardTransactionInput,
  OtsarHahayalForeignTransactionInput,
  OtsarHahayalIlsTransactionInput,
  ScraperUploadResult,
} from '../../../__generated__/types.js';
import { dateToTimelessDateString } from '../../../shared/helpers/index.js';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import { AuthContextProvider } from '../../auth/providers/auth-context.provider.js';
import { formatValue } from '../helpers/utils.helper.js';
import type {
  IFetchOtsarHahayalCreditCardByKeysQuery,
  IFetchOtsarHahayalCreditCardByKeysResult,
  IFetchOtsarHahayalForeignByKeysQuery,
  IFetchOtsarHahayalForeignByKeysResult,
  IFetchOtsarHahayalIlsByKeysQuery,
  IFetchOtsarHahayalIlsByKeysResult,
  IUploadOtsarHahayalCreditCardTransactionsQuery,
  IUploadOtsarHahayalCreditCardTransactionsResult,
  IUploadOtsarHahayalForeignTransactionsQuery,
  IUploadOtsarHahayalForeignTransactionsResult,
  IUploadOtsarHahayalIlsTransactionsQuery,
  IUploadOtsarHahayalIlsTransactionsResult,
} from '../types.js';

const fetchOtsarHahayalIlsByKeys = sql<IFetchOtsarHahayalIlsByKeysQuery>`
  SELECT
    id,
    account_number,
    branch_number,
    date_of_registration,
    action_code,
    bfb_source,
    closing_balance,
    correspondent_account,
    correspondent_account_type,
    correspondent_bank,
    correspondent_branch,
    credit_amount,
    customer_name,
    date_of_business_day,
    debit_amount,
    depositor_id,
    description,
    drill_down_url,
    drill_down_data,
    first_transaction_of_day,
    last_transaction_of_day,
    name,
    opening_balance,
    operation_source,
    reference,
    salary_ind,
    transaction_source,
    transaction_reason,
    origin_reference
  FROM accounter_schema.otsar_hahayal_ils_account_transactions
  WHERE account_number = ANY($accountNumbers!)
    AND branch_number = ANY($branchNumbers!)
    AND date_of_registration = ANY($dateOfRegistrations!)
`;

const uploadOtsarHahayalIlsTransactions = sql<IUploadOtsarHahayalIlsTransactionsQuery>`
  INSERT INTO accounter_schema.otsar_hahayal_ils_account_transactions (
    account_number,
    account_type,
    branch_number,
    action_code,
    bfb_source,
    closing_balance,
    correspondent_account,
    correspondent_account_type,
    correspondent_bank,
    correspondent_branch,
    credit_amount,
    customer_name,
    date_of_business_day,
    date_of_registration,
    debit_amount,
    depositor_id,
    description,
    drill_down_url,
    drill_down_data,
    first_transaction_of_day,
    last_transaction_of_day,
    name,
    opening_balance,
    operation_source,
    reference,
    salary_ind,
    transaction_source,
    transaction_reason,
    origin_reference,
    owner_id
  )
  VALUES $$transactions(
    accountNumber,
    accountType,
    branchNumber,
    actionCode,
    bfbSource,
    closingBalance,
    correspondentAccount,
    correspondentAccountType,
    correspondentBank,
    correspondentBranch,
    creditAmount,
    customerName,
    dateOfBusinessDay,
    dateOfRegistration,
    debitAmount,
    depositorId,
    description,
    drillDownUrl,
    drillDownData,
    firstTransactionOfDay,
    lastTransactionOfDay,
    name,
    openingBalance,
    operationSource,
    reference,
    salaryInd,
    transactionSource,
    transactionReason,
    originReference,
    ownerId
  )
  ON CONFLICT (account_number, branch_number, date_of_registration, date_of_business_day, reference, origin_reference, credit_amount, debit_amount) DO NOTHING
  RETURNING id, account_number, branch_number, date_of_registration, description, credit_amount, debit_amount;
`;

const fetchOtsarHahayalForeignByKeys = sql<IFetchOtsarHahayalForeignByKeysQuery>`
  SELECT
    id,
    account,
    branch,
    account_type,
    currency,
    opening_balance,
    balance,
    value_date,
    credit,
    debit,
    description,
    sp,
    reference,
    date,
    sub_transactions
  FROM accounter_schema.otsar_hahayal_foreign_account_transactions
  WHERE account = ANY($accounts!)
    AND branch = ANY($branches!)
    AND date = ANY($dates!)
    AND reference = ANY($references!)
`;

const uploadOtsarHahayalForeignTransactions = sql<IUploadOtsarHahayalForeignTransactionsQuery>`
  INSERT INTO accounter_schema.otsar_hahayal_foreign_account_transactions (
    account,
    branch,
    account_type,
    currency,
    opening_balance,
    balance,
    value_date,
    credit,
    debit,
    description,
    sp,
    reference,
    date,
    sub_transactions,
    owner_id
  )
  VALUES $$transactions(
    account,
    branch,
    accountType,
    currency,
    openingBalance,
    balance,
    valueDate,
    credit,
    debit,
    description,
    sp,
    reference,
    date,
    subTransactions,
    ownerId
  )
  ON CONFLICT (account, branch, date, value_date, reference, description) DO NOTHING
  RETURNING id, account, branch, currency, date, description, credit, debit;
`;

const fetchOtsarHahayalCreditCardByKeys = sql<IFetchOtsarHahayalCreditCardByKeysQuery>`
  SELECT
    id,
    resource_id,
    masked_pan,
    card_type,
    billing_period,
    date,
    charge_date,
    name,
    deal_amount,
    charge_amount,
    notes,
    wallet_type,
    charge_currency,
    deal_currency,
    counter
  FROM accounter_schema.otsar_hahayal_creditcard_transactions
  WHERE resource_id = ANY($resourceIds!)
    AND card_type = ANY($cardTypes!)
    AND date = ANY($dates!)
`;

const uploadOtsarHahayalCreditCardTransactions = sql<IUploadOtsarHahayalCreditCardTransactionsQuery>`
  INSERT INTO accounter_schema.otsar_hahayal_creditcard_transactions (
    resource_id,
    masked_pan,
    card_type,
    billing_period,
    date,
    charge_date,
    name,
    deal_amount,
    charge_amount,
    notes,
    wallet_type,
    charge_currency,
    deal_currency,
    counter,
    owner_id
  )
  VALUES $$transactions(
    resourceId,
    maskedPan,
    cardType,
    dealGroup,
    date,
    chargeDate,
    name,
    dealAmount,
    chargeAmount,
    notes,
    walletType,
    chargeCurrency,
    dealCurrency,
    counter,
    ownerId
  )
  ON CONFLICT (resource_id, card_type, date, charge_date, deal_amount, deal_currency, name, notes, counter) DO NOTHING
  RETURNING id, resource_id, date, name, charge_amount, charge_currency;
`;

const OTSAR_HAHAYAL_CREDITCARD_DIFF_FIELDS: Array<{
  key: string & keyof IFetchOtsarHahayalCreditCardByKeysResult;
  incoming: (t: OtsarHahayalCreditCardTransactionInput) => string | number | boolean | null;
}> = [
  { key: 'masked_pan', incoming: t => t.maskedPan },
  { key: 'billing_period', incoming: t => t.dealGroup },
  { key: 'charge_date', incoming: t => t.chargeDate },
  { key: 'charge_amount', incoming: t => t.chargeAmount },
  { key: 'wallet_type', incoming: t => t.walletType },
  { key: 'charge_currency', incoming: t => t.chargeCurrency },
];

const OTSAR_HAHAYAL_CREDITCARD_NUMERIC_FIELDS: (keyof IFetchOtsarHahayalCreditCardByKeysResult)[] =
  ['deal_amount', 'charge_amount'] as const;

function diffOtsarHahayalCreditCardRow(
  existing: IFetchOtsarHahayalCreditCardByKeysResult,
  incoming: OtsarHahayalCreditCardTransactionInput,
): ChangedField[] {
  const changed: ChangedField[] = [];
  for (const { key, incoming: getIncoming } of OTSAR_HAHAYAL_CREDITCARD_DIFF_FIELDS) {
    const isNumberField = OTSAR_HAHAYAL_CREDITCARD_NUMERIC_FIELDS.includes(key);
    const oldValue = formatValue(existing[key], isNumberField);
    const newValue = formatValue(getIncoming(incoming), isNumberField);
    if (oldValue !== newValue) {
      changed.push({ field: key, oldValue, newValue });
    }
  }
  return changed;
}

const OTSAR_HAHAYAL_ILS_DIFF_FIELDS: Array<{
  key: string & keyof IFetchOtsarHahayalIlsByKeysResult;
  incoming: (t: OtsarHahayalIlsTransactionInput) => string | number | boolean | null;
}> = [
  { key: 'action_code', incoming: t => t.actionCode },
  { key: 'bfb_source', incoming: t => t.bfbSource },
  { key: 'closing_balance', incoming: t => t.closingBalance },
  { key: 'correspondent_account', incoming: t => t.correspondentAccount },
  { key: 'correspondent_account_type', incoming: t => t.correspondentAccountType },
  { key: 'correspondent_bank', incoming: t => t.correspondentBank },
  { key: 'correspondent_branch', incoming: t => t.correspondentBranch },
  { key: 'credit_amount', incoming: t => t.creditAmount },
  { key: 'customer_name', incoming: t => t.customerName },
  { key: 'debit_amount', incoming: t => t.debitAmount },
  { key: 'description', incoming: t => t.description },
  { key: 'drill_down_url', incoming: t => t.drillDownUrl },
  { key: 'first_transaction_of_day', incoming: t => t.firstTransactionOfDay },
  { key: 'last_transaction_of_day', incoming: t => t.lastTransactionOfDay },
  { key: 'name', incoming: t => t.name },
  { key: 'opening_balance', incoming: t => t.openingBalance },
  { key: 'operation_source', incoming: t => t.operationSource },
  { key: 'salary_ind', incoming: t => t.salaryInd },
  { key: 'transaction_source', incoming: t => t.transactionSource },
  { key: 'transaction_reason', incoming: t => t.transactionReason },
];

const OTSAR_HAHAYAL_ILS_NUMERIC_FIELDS: (keyof IFetchOtsarHahayalIlsByKeysResult)[] = [
  'closing_balance',
  'credit_amount',
  'debit_amount',
  'opening_balance',
] as const;

function diffOtsarHahayalIlsRow(
  existing: IFetchOtsarHahayalIlsByKeysResult,
  incoming: OtsarHahayalIlsTransactionInput,
): ChangedField[] {
  const changed: ChangedField[] = [];
  for (const { key, incoming: getIncoming } of OTSAR_HAHAYAL_ILS_DIFF_FIELDS) {
    const isNumberField = OTSAR_HAHAYAL_ILS_NUMERIC_FIELDS.includes(key);
    const oldValue = formatValue(existing[key], isNumberField);
    const newValue = formatValue(getIncoming(incoming), isNumberField);
    if (oldValue !== newValue) {
      changed.push({ field: key, oldValue, newValue });
    }
  }
  return changed;
}

const OTSAR_HAHAYAL_FOREIGN_DIFF_FIELDS: Array<{
  key: string & keyof IFetchOtsarHahayalForeignByKeysResult;
  incoming: (t: OtsarHahayalForeignTransactionInput) => string | number | boolean | null;
}> = [
  { key: 'account_type', incoming: t => t.accountType },
  { key: 'currency', incoming: t => t.currency },
  { key: 'opening_balance', incoming: t => t.openingBalance },
  { key: 'balance', incoming: t => t.balance ?? null },
  { key: 'credit', incoming: t => t.credit },
  { key: 'debit', incoming: t => t.debit },
  { key: 'description', incoming: t => t.description },
  { key: 'sp', incoming: t => t.sp ?? null },
];

const OTSAR_HAHAYAL_FOREIGN_NUMERIC_FIELDS: (keyof IFetchOtsarHahayalForeignByKeysResult)[] = [
  'opening_balance',
  'balance',
  'credit',
  'debit',
] as const;

function diffOtsarHahayalForeignRow(
  existing: IFetchOtsarHahayalForeignByKeysResult,
  incoming: OtsarHahayalForeignTransactionInput,
): ChangedField[] {
  const changed: ChangedField[] = [];
  for (const { key, incoming: getIncoming } of OTSAR_HAHAYAL_FOREIGN_DIFF_FIELDS) {
    const isNumberField = OTSAR_HAHAYAL_FOREIGN_NUMERIC_FIELDS.includes(key);
    const oldValue = formatValue(existing[key], isNumberField);
    const newValue = formatValue(getIncoming(incoming), isNumberField);
    if (oldValue !== newValue) {
      changed.push({ field: key, oldValue, newValue });
    }
  }
  return changed;
}

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class OtsarHahayalScraperIngestionProvider {
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

  async uploadOtsarHahayalIlsTransactions(
    transactions: readonly OtsarHahayalIlsTransactionInput[],
  ): Promise<ScraperUploadResult> {
    try {
      if (transactions.length === 0)
        return {
          inserted: 0,
          skipped: 0,
          insertedIds: [],
          insertedTransactions: [],
          changedTransactions: [],
        };

      const dateOfRegistrations = transactions
        .map(t => (t.dateOfRegistration ? new Date(t.dateOfRegistration) : null))
        .filter((d): d is Date => d !== null);
      const accountNumbers = transactions
        .map(t => t.accountNumber ?? null)
        .filter((n): n is number => n !== null);
      const branchNumbers = transactions
        .map(t => t.branchNumber ?? null)
        .filter((n): n is number => n !== null);

      const existing = await fetchOtsarHahayalIlsByKeys.run(
        { accountNumbers, branchNumbers, dateOfRegistrations },
        this.db,
      );

      const existingByKey = new Map<string, IFetchOtsarHahayalIlsByKeysResult>();
      for (const row of existing) {
        const key = [
          row.account_number,
          row.branch_number,
          row.date_of_registration ? dateToTimelessDateString(row.date_of_registration) : '',
          row.date_of_business_day ? dateToTimelessDateString(row.date_of_business_day) : '',
          row.reference,
          row.origin_reference,
          formatValue(row.credit_amount, true),
          formatValue(row.debit_amount, true),
        ].join('_');
        existingByKey.set(key, row);
      }

      const businessId = await this.getBusinessId();

      const params = transactions.map(t => ({
        accountNumber: t.accountNumber,
        accountType: t.accountType,
        branchNumber: t.branchNumber,
        actionCode: t.actionCode,
        bfbSource: t.bfbSource,
        closingBalance: t.closingBalance,
        correspondentAccount: t.correspondentAccount,
        correspondentAccountType: t.correspondentAccountType,
        correspondentBank: t.correspondentBank,
        correspondentBranch: t.correspondentBranch,
        creditAmount: t.creditAmount,
        customerName: t.customerName,
        dateOfBusinessDay: t.dateOfBusinessDay,
        dateOfRegistration: t.dateOfRegistration,
        debitAmount: t.debitAmount,
        depositorId: t.depositorId,
        description: t.description,
        drillDownUrl: t.drillDownUrl,
        drillDownData: t.drillDownData ?? null,
        firstTransactionOfDay: t.firstTransactionOfDay,
        lastTransactionOfDay: t.lastTransactionOfDay,
        name: t.name,
        openingBalance: t.openingBalance,
        operationSource: t.operationSource,
        reference: t.reference,
        salaryInd: t.salaryInd,
        transactionSource: t.transactionSource,
        transactionReason: t.transactionReason,
        originReference: t.originReference ?? '',
        ownerId: businessId,
      }));

      const result: IUploadOtsarHahayalIlsTransactionsResult[] =
        await uploadOtsarHahayalIlsTransactions.run({ transactions: params }, this.db);
      const insertedIds = result
        .map(r => r.id)
        .filter((id): id is string => typeof id === 'string');
      const insertedIdSet = new Set(insertedIds);

      const insertedTransactions: InsertedTransactionSummary[] = result.map(r => ({
        id: r.id,
        date: r.date_of_registration ? dateToTimelessDateString(r.date_of_registration) : null,
        description: r.description ?? null,
        amount:
          Number(r.debit_amount) === 0 ? String(r.credit_amount) : String(-Number(r.debit_amount)),
        account: String(r.account_number),
      }));

      const changedTransactions: ChangedTransaction[] = [];
      for (const t of transactions) {
        const key = [
          t.accountNumber,
          t.branchNumber,
          t.dateOfRegistration ? dateToTimelessDateString(new Date(t.dateOfRegistration)) : '',
          t.dateOfBusinessDay ? dateToTimelessDateString(new Date(t.dateOfBusinessDay)) : '',
          t.reference,
          t.originReference ?? '',
          formatValue(t.creditAmount, true),
          formatValue(t.debitAmount, true),
        ].join('_');
        const existingRow = existingByKey.get(key);
        if (existingRow && !insertedIdSet.has(existingRow.id)) {
          const changedFields = diffOtsarHahayalIlsRow(existingRow, t);
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
    } catch (error) {
      console.error('Error uploading Otsar HaHayal ILS transactions:', error);
      throw error;
    }
  }

  async uploadOtsarHahayalForeignTransactions(
    transactions: readonly OtsarHahayalForeignTransactionInput[],
  ): Promise<ScraperUploadResult> {
    try {
      if (transactions.length === 0)
        return {
          inserted: 0,
          skipped: 0,
          insertedIds: [],
          insertedTransactions: [],
          changedTransactions: [],
        };

      const accounts = transactions
        .map(t => t.account ?? null)
        .filter((n): n is number => n !== null);
      const branches = transactions
        .map(t => t.branch ?? null)
        .filter((n): n is number => n !== null);
      const dates = transactions
        .map(t => (t.date ? new Date(t.date) : null))
        .filter((d): d is Date => d !== null);
      const references = transactions
        .map(t => t.reference ?? null)
        .filter((r): r is string => r !== null);

      const existing = await fetchOtsarHahayalForeignByKeys.run(
        { accounts, branches, dates, references },
        this.db,
      );

      const existingByKey = new Map<string, IFetchOtsarHahayalForeignByKeysResult>();
      for (const row of existing) {
        const key = [
          row.account,
          row.branch,
          row.date ? dateToTimelessDateString(row.date) : '',
          row.value_date ? dateToTimelessDateString(row.value_date) : '',
          row.reference,
          row.description,
        ].join('_');
        existingByKey.set(key, row);
      }

      const businessId = await this.getBusinessId();

      const params = transactions.map(t => ({
        account: t.account,
        branch: t.branch,
        accountType: t.accountType,
        currency: t.currency,
        openingBalance: t.openingBalance,
        balance: t.balance ?? null,
        valueDate: t.valueDate,
        credit: t.credit,
        debit: t.debit,
        description: t.description,
        sp: t.sp ?? null,
        reference: t.reference,
        date: t.date,
        subTransactions: t.subTransactions,
        ownerId: businessId,
      }));

      const result: IUploadOtsarHahayalForeignTransactionsResult[] =
        await uploadOtsarHahayalForeignTransactions.run({ transactions: params }, this.db);
      const insertedIds = result
        .map(r => r.id)
        .filter((id): id is string => typeof id === 'string');
      const insertedIdSet = new Set(insertedIds);

      const insertedTransactions: InsertedTransactionSummary[] = result.map(r => ({
        id: r.id,
        date: r.date ? dateToTimelessDateString(r.date) : null,
        description: r.description ?? null,
        amount: Number(r.debit) === 0 ? String(r.credit) : String(-Number(r.debit)),
        account: String(r.account),
      }));

      const changedTransactions: ChangedTransaction[] = [];
      for (const t of transactions) {
        const key = [
          t.account,
          t.branch,
          t.date ? dateToTimelessDateString(new Date(t.date)) : '',
          t.valueDate ? dateToTimelessDateString(new Date(t.valueDate)) : '',
          t.reference,
          t.description,
        ].join('_');
        const existingRow = existingByKey.get(key);
        if (existingRow && !insertedIdSet.has(existingRow.id)) {
          const changedFields = diffOtsarHahayalForeignRow(existingRow, t);
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
    } catch (error) {
      console.error('Error uploading Otsar HaHayal foreign transactions:', error);
      throw error;
    }
  }

  async uploadOtsarHahayalCreditCardTransactions(
    transactions: readonly OtsarHahayalCreditCardTransactionInput[],
  ): Promise<ScraperUploadResult> {
    try {
      if (transactions.length === 0)
        return {
          inserted: 0,
          skipped: 0,
          insertedIds: [],
          insertedTransactions: [],
          changedTransactions: [],
        };

      const resourceIds = [...new Set(transactions.map(t => t.resourceId))];
      const cardTypes = [...new Set(transactions.map(t => t.cardType))];
      const dates = transactions.map(t => new Date(t.date));

      const existing = await fetchOtsarHahayalCreditCardByKeys.run(
        { resourceIds, cardTypes, dates },
        this.db,
      );

      const existingByKey = new Map<string, IFetchOtsarHahayalCreditCardByKeysResult>();
      for (const row of existing) {
        const key = [
          row.resource_id,
          row.card_type,
          row.date ? dateToTimelessDateString(row.date) : '',
          row.charge_date ? dateToTimelessDateString(row.charge_date) : '',
          row.deal_amount,
          row.deal_currency,
          row.name,
          row.notes,
          row.counter,
        ].join('|');
        existingByKey.set(key, row);
      }

      const businessId = await this.getBusinessId();

      const params = transactions.map(t => ({
        resourceId: t.resourceId,
        maskedPan: t.maskedPan,
        cardType: t.cardType,
        dealGroup: t.dealGroup,
        date: t.date,
        chargeDate: t.chargeDate,
        name: t.name,
        dealAmount: t.dealAmount,
        chargeAmount: t.chargeAmount,
        notes: t.notes,
        walletType: t.walletType,
        chargeCurrency: t.chargeCurrency,
        dealCurrency: t.dealCurrency,
        counter: t.counter,
        ownerId: businessId,
      }));

      const result: IUploadOtsarHahayalCreditCardTransactionsResult[] =
        await uploadOtsarHahayalCreditCardTransactions.run({ transactions: params }, this.db);
      const insertedIds = result
        .map(r => r.id)
        .filter((id): id is string => typeof id === 'string');
      const insertedIdSet = new Set(insertedIds);

      const insertedTransactions: InsertedTransactionSummary[] = result.map(r => ({
        id: r.id,
        date: r.date ? dateToTimelessDateString(r.date) : null,
        description: r.name ?? null,
        amount: r.charge_amount == null ? null : String(-Number(r.charge_amount)),
        account: r.resource_id ?? null,
      }));

      const changedTransactions: ChangedTransaction[] = [];
      for (const t of transactions) {
        const key = [
          t.resourceId,
          t.cardType,
          t.date,
          t.chargeDate,
          t.dealAmount,
          t.dealCurrency,
          t.name,
          t.notes,
          t.counter,
        ].join('|');
        const existingRow = existingByKey.get(key);
        if (existingRow && !insertedIdSet.has(existingRow.id)) {
          const changedFields = diffOtsarHahayalCreditCardRow(existingRow, t);
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
    } catch (error) {
      console.error('Error uploading Otsar HaHayal credit card transactions:', error);
      throw error;
    }
  }
}
