import { GraphQLError } from 'graphql';
import type { IGetFinancialAccountsByAccountIDsResult } from '@modules/financial-accounts/types';
import { IGetFinancialEntitiesByIdsResult } from '@modules/financial-entities/types';
import type { IGetTransactionsByChargeIdsResult } from '@modules/transactions/types';
import { DEFAULT_LOCAL_CURRENCY, EMPTY_UUID } from '@shared/constants';
import { Currency } from '@shared/enums';
import type { FinancialAmount } from '@shared/gql-types';
import { formatCurrency, formatFinancialAmount } from '@shared/helpers';
import type {
  CounterAccountProto,
  LedgerBalanceInfoType,
  LedgerProto,
  StrictLedgerProto,
} from '@shared/types';
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
  ledgerBalance: Map<string, { amount: number; entity: CounterAccountProto }>,
): void {
  if (entry.creditAccountID1) {
    const name =
      typeof entry.creditAccountID1 === 'string'
        ? entry.creditAccountID1
        : entry.creditAccountID1.name;
    ledgerBalance.set(name, {
      amount: (ledgerBalance.get(name)?.amount ?? 0) + (entry.localCurrencyCreditAmount1 ?? 0),
      entity: entry.creditAccountID1,
    });
  }
  if (entry.debitAccountID1) {
    const name =
      typeof entry.debitAccountID1 === 'string'
        ? entry.debitAccountID1
        : entry.debitAccountID1.name;
    ledgerBalance.set(name, {
      amount: (ledgerBalance.get(name)?.amount ?? 0) - (entry.localCurrencyDebitAmount1 ?? 0),
      entity: entry.debitAccountID1,
    });
  }
  if (entry.creditAccountID2) {
    const name =
      typeof entry.creditAccountID2 === 'string'
        ? entry.creditAccountID2
        : entry.creditAccountID2.name;
    ledgerBalance.set(name, {
      amount: (ledgerBalance.get(name)?.amount ?? 0) + (entry.localCurrencyCreditAmount2 ?? 0),
      entity: entry.creditAccountID2,
    });
  }
  if (entry.debitAccountID2) {
    const name =
      typeof entry.debitAccountID2 === 'string'
        ? entry.debitAccountID2
        : entry.debitAccountID2.name;
    ledgerBalance.set(name, {
      amount: (ledgerBalance.get(name)?.amount ?? 0) - (entry.localCurrencyDebitAmount2 ?? 0),
      entity: entry.debitAccountID2,
    });
  }

  return;
}

export function getLedgerBalanceInfo(
  ledgerBalance: Map<string, { amount: number; entity: CounterAccountProto }>,
  allowedUnbalancedBusinesses: Set<string> = new Set(),
  financialEntities?: Array<IGetFinancialEntitiesByIdsResult>,
): LedgerBalanceInfoType {
  let ledgerBalanceSum = 0;
  let isBalanced = true;
  const unbalancedEntities: Array<{ entity: CounterAccountProto; balance: FinancialAmount }> = [];
  for (const { amount, entity } of ledgerBalance.values()) {
    if (Math.abs(amount) < 0.005) {
      continue;
    }
    const isBusinessEntity =
      typeof entity === 'string' &&
      (financialEntities
        ? financialEntities.some(
            financialEntity => financialEntity.id === entity && financialEntity.type === 'business',
          )
        : true);
    if (isBusinessEntity && !allowedUnbalancedBusinesses.has(entity)) {
      isBalanced = false;
    }
    unbalancedEntities.push({
      entity,
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
  };
}

function getCounterAccountProtoId(counterAccountProto?: CounterAccountProto): string | null {
  if (!counterAccountProto) {
    return null;
  }

  return typeof counterAccountProto === 'string' ? counterAccountProto : counterAccountProto.id;
}

export function ledgerProtoToRecordsConverter(
  records: LedgerProto[],
): IGetLedgerRecordsByChargesIdsResult[] {
  return records.map(record => {
    const adjustedRecord: IGetLedgerRecordsByChargesIdsResult = {
      charge_id: record.chargeId,
      created_at: new Date(),
      credit_entity1: getCounterAccountProtoId(record.creditAccountID1),
      credit_entity2: getCounterAccountProtoId(record.creditAccountID2),
      credit_foreign_amount1: record.creditAmount1?.toString() ?? null,
      credit_foreign_amount2: record.creditAmount2?.toString() ?? null,
      credit_local_amount1: record.localCurrencyCreditAmount1?.toString(),
      credit_local_amount2: record.localCurrencyCreditAmount2?.toString() ?? null,
      currency: record.currency,
      debit_entity1: getCounterAccountProtoId(record.debitAccountID1),
      debit_entity2: getCounterAccountProtoId(record.debitAccountID2),
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
