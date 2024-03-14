import { GraphQLError } from 'graphql';
import { Injector } from 'graphql-modules';
import { FinancialAccountsProvider } from '@modules/financial-accounts/providers/financial-accounts.provider.js';
import type { IGetFinancialAccountsByAccountIDsResult } from '@modules/financial-accounts/types';
import { FinancialEntitiesProvider } from '@modules/financial-entities/providers/financial-entities.provider.js';
import { TaxCategoriesProvider } from '@modules/financial-entities/providers/tax-categories.provider.js';
import { IGetFinancialEntitiesByIdsResult } from '@modules/financial-entities/types';
import type { IGetTransactionsByChargeIdsResult } from '@modules/transactions/types';
import { DEFAULT_LOCAL_CURRENCY, EMPTY_UUID } from '@shared/constants';
import { Currency } from '@shared/enums';
import type { FinancialAmount } from '@shared/gql-types';
import { formatCurrency, formatFinancialAmount } from '@shared/helpers';
import type { LedgerBalanceInfoType, LedgerProto, StrictLedgerProto } from '@shared/types';
import type { IGetLedgerRecordsByChargesIdsResult } from '../types.js';

export function isTransactionsOppositeSign([first, second]: IGetTransactionsByChargeIdsResult[]) {
  if (!first || !second) {
    throw new GraphQLError('Transactions are missing');
  }
  const firstAmount = Number(first.amount);
  const secondAmount = Number(second.amount);
  if (Number.isNaN(firstAmount) || Number.isNaN(secondAmount)) {
    throw new Error('Transaction amount is not a number');
  }
  return Number(first.amount) > 0 !== Number(second.amount) > 0;
}

export function getTaxCategoryNameByAccountCurrency(
  account: IGetFinancialAccountsByAccountIDsResult,
  currency: Currency,
): string {
  let taxCategoryName = account.hashavshevet_account_ils;
  switch (currency) {
    case Currency.Ils:
      taxCategoryName = account.hashavshevet_account_ils;
      break;
    case Currency.Usd:
      taxCategoryName = account.hashavshevet_account_usd;
      break;
    case Currency.Eur:
      taxCategoryName = account.hashavshevet_account_eur;
      break;
    case Currency.Gbp:
      taxCategoryName = account.hashavshevet_account_gbp;
      break;
    case Currency.Usdc:
    case Currency.Grt:
    case Currency.Eth:
      taxCategoryName = account.hashavshevet_account_ils;
      break;
    default:
      console.error(`Unknown currency for account's tax category: ${currency}`);
  }
  if (!taxCategoryName) {
    throw new GraphQLError(`Account ID="${account.id}" is missing tax category name`);
  }
  return taxCategoryName;
}

export function validateTransactionBasicVariables(transaction: IGetTransactionsByChargeIdsResult) {
  const currency = formatCurrency(transaction.currency);
  if (!transaction.debit_date) {
    throw new GraphQLError(
      `Transaction ID="${transaction.id}" is missing debit date for currency ${currency}`,
    );
  }
  const valueDate = transaction.debit_timestamp ?? transaction.debit_date;

  if (!transaction.business_id) {
    throw new GraphQLError(`Transaction ID="${transaction.id}" is missing business_id`);
  }

  const transactionBusinessId = transaction.business_id;

  return {
    currency,
    valueDate,
    transactionBusinessId,
  };
}

type WithRequired<T, K extends keyof T> = T & { [P in K]-?: NonNullable<T[P]> };
export type ValidateTransaction = Omit<
  WithRequired<IGetTransactionsByChargeIdsResult, 'debit_date' | 'business_id' | 'debit_timestamp'>,
  'currency'
> & { currency: Currency };

export function validateTransactionRequiredVariables(
  transaction: IGetTransactionsByChargeIdsResult,
): ValidateTransaction {
  if (!transaction.debit_date) {
    throw new GraphQLError(
      `Transaction ID="${transaction.id}" is missing debit date for currency ${transaction.currency}`,
    );
  }

  if (!transaction.business_id) {
    throw new GraphQLError(`Transaction ID="${transaction.id}" is missing business_id`);
  }

  const debit_timestamp = transaction.debit_timestamp ?? transaction.debit_date;

  return {
    ...transaction,
    debit_timestamp,
    currency: formatCurrency(transaction.currency),
  } as ValidateTransaction;
}

export function generatePartialLedgerEntry(
  transaction: ValidateTransaction,
  ownerId: string,
  exchangeRate?: number,
): Omit<StrictLedgerProto, 'creditAccountID1' | 'debitAccountID1'> {
  // set amounts
  let amount = Number(transaction.amount);
  let foreignAmount: number | undefined = undefined;
  if (exchangeRate) {
    foreignAmount = amount;
    // calculate amounts in ILS
    amount = exchangeRate * amount;
  }
  const absAmount = Math.abs(amount);
  const absForeignAmount = foreignAmount ? Math.abs(foreignAmount) : undefined;

  const isCreditorCounterparty = amount > 0;
  return {
    id: transaction.id,
    invoiceDate: transaction.event_date,
    valueDate: transaction.debit_timestamp,
    currency: transaction.currency,
    creditAmount1: absForeignAmount,
    localCurrencyCreditAmount1: absAmount,
    debitAmount1: absForeignAmount,
    localCurrencyDebitAmount1: absAmount,
    description: transaction.source_description ?? undefined,
    reference1: transaction.source_reference ?? undefined,
    isCreditorCounterparty,
    ownerId,
    currencyRate: transaction.currency_rate ? Number(transaction.currency_rate) : undefined,
    chargeId: transaction.charge_id,
  };
}

export function updateLedgerBalanceByEntry(
  entry: LedgerProto,
  ledgerBalance: Map<string, { amount: number; entityId: string }>,
): void {
  if (entry.creditAccountID1) {
    const name = entry.creditAccountID1;
    ledgerBalance.set(name, {
      amount: (ledgerBalance.get(name)?.amount ?? 0) + (entry.localCurrencyCreditAmount1 ?? 0),
      entityId: entry.creditAccountID1,
    });
  }
  if (entry.debitAccountID1) {
    const name = entry.debitAccountID1;
    ledgerBalance.set(name, {
      amount: (ledgerBalance.get(name)?.amount ?? 0) - (entry.localCurrencyDebitAmount1 ?? 0),
      entityId: entry.debitAccountID1,
    });
  }
  if (entry.creditAccountID2) {
    const name = entry.creditAccountID2;
    ledgerBalance.set(name, {
      amount: (ledgerBalance.get(name)?.amount ?? 0) + (entry.localCurrencyCreditAmount2 ?? 0),
      entityId: entry.creditAccountID2,
    });
  }
  if (entry.debitAccountID2) {
    const name = entry.debitAccountID2;
    ledgerBalance.set(name, {
      amount: (ledgerBalance.get(name)?.amount ?? 0) - (entry.localCurrencyDebitAmount2 ?? 0),
      entityId: entry.debitAccountID2,
    });
  }

  return;
}

export async function getLedgerBalanceInfo(
  injector: Injector,
  ledgerBalance: Map<string, { amount: number; entityId: string }>,
  allowedUnbalancedBusinesses: Set<string> = new Set(),
  financialEntities?: Array<IGetFinancialEntitiesByIdsResult>,
): Promise<
  LedgerBalanceInfoType & {
    financialEntities: Array<IGetFinancialEntitiesByIdsResult>;
  }
> {
  let ledgerBalanceSum = 0;
  let isBalanced = true;
  const unbalancedEntities: Array<{ entityId: string; balance: FinancialAmount }> = [];

  if (!financialEntities) {
    const financialEntityIDs = new Set<string>(
      Array.from(ledgerBalance.values()).map(v => v.entityId),
    );
    financialEntities = (await injector
      .get(FinancialEntitiesProvider)
      .getFinancialEntityByIdLoader.loadMany(Array.from(financialEntityIDs))
      .then(res =>
        res.filter(fe => !!fe && 'id' in fe),
      )) as Array<IGetFinancialEntitiesByIdsResult>;
  }

  for (const { amount, entityId } of ledgerBalance.values()) {
    if (Math.abs(amount) < 0.005) {
      continue;
    }
    const isBusiness = financialEntities?.some(
      financialEntity => financialEntity.id === entityId && financialEntity.type === 'business',
    );

    const isBusinessEntity =
      isBusiness &&
      (financialEntities
        ? financialEntities.some(
            financialEntity =>
              financialEntity.id === entityId && financialEntity.type === 'business',
          )
        : true);
    if (isBusinessEntity && !allowedUnbalancedBusinesses.has(entityId)) {
      isBalanced = false;
    }
    unbalancedEntities.push({
      entityId,
      balance: formatFinancialAmount(amount, DEFAULT_LOCAL_CURRENCY),
    });
    ledgerBalanceSum += amount;
  }
  if (Math.abs(ledgerBalanceSum) >= 0.005) {
    isBalanced = false;
  }

  return {
    isBalanced,
    unbalancedEntities,
    balanceSum: ledgerBalanceSum,
    financialEntities,
  };
}

export function ledgerProtoToRecordsConverter(
  records: LedgerProto[],
): IGetLedgerRecordsByChargesIdsResult[] {
  return records.map(record => {
    const adjustedRecord: IGetLedgerRecordsByChargesIdsResult = {
      charge_id: record.chargeId,
      created_at: new Date(),
      credit_entity1: record.creditAccountID1 ?? null,
      credit_entity2: record.creditAccountID2 ?? null,
      credit_foreign_amount1: record.creditAmount1?.toString() ?? null,
      credit_foreign_amount2: record.creditAmount2?.toString() ?? null,
      credit_local_amount1: record.localCurrencyCreditAmount1?.toString(),
      credit_local_amount2: record.localCurrencyCreditAmount2?.toString() ?? null,
      currency: record.currency,
      debit_entity1: record.debitAccountID1 ?? null,
      debit_entity2: record.debitAccountID2 ?? null,
      debit_foreign_amount1: record.debitAmount1?.toString() ?? null,
      debit_foreign_amount2: record.debitAmount2?.toString() ?? null,
      debit_local_amount1: record.localCurrencyDebitAmount1?.toString(),
      debit_local_amount2: record.localCurrencyDebitAmount2?.toString() ?? null,
      description: record.description ?? null,
      id: EMPTY_UUID,
      invoice_date: record.invoiceDate,
      owner_id: record.ownerId ?? null,
      reference1: record.reference1 ?? null,
      updated_at: new Date(),
      value_date: record.valueDate,
    };
    return adjustedRecord;
  });
}

export async function getFinancialAccountTaxCategoryId(
  injector: Injector,
  transaction: IGetTransactionsByChargeIdsResult,
  currency?: Currency,
  useSourceReference?: boolean,
): Promise<string> {
  if (useSourceReference && !transaction.source_reference) {
    throw new GraphQLError(
      `Transaction ID="${transaction.id}" is missing source reference, which is required for fetching the financial account`,
    );
  }
  const account = await (useSourceReference
    ? injector
        .get(FinancialAccountsProvider)
        .getFinancialAccountByAccountNumberLoader.load(transaction.source_reference!)
    : injector
        .get(FinancialAccountsProvider)
        .getFinancialAccountByAccountIDLoader.load(transaction.account_id));
  if (!account) {
    throw new GraphQLError(`Transaction ID="${transaction.id}" is missing account`);
  }
  const taxCategoryName = getTaxCategoryNameByAccountCurrency(
    account,
    currency || (transaction.currency as Currency),
  );
  const taxCategory = await injector
    .get(TaxCategoriesProvider)
    .taxCategoryByNamesLoader.load(taxCategoryName);

  if (!taxCategory) {
    throw new GraphQLError(`Account ID="${account.id}" is missing tax category`);
  }

  return taxCategory.id;
}
