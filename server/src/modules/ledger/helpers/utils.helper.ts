import { GraphQLError } from 'graphql';
import type { IGetFinancialAccountsByAccountIDsResult } from '@modules/financial-accounts/types';
import type { IGetTransactionsByChargeIdsResult } from '@modules/transactions/types';
import { Currency } from '@shared/enums';
import { formatCurrency } from '@shared/helpers';
import { LedgerProto, StrictLedgerProto } from '@shared/types';

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
type ValidateTransaction = Omit<
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
    reference1: transaction.source_id,
    isCreditorCounterparty,
    ownerId,
    currencyRate: transaction.currency_rate ? Number(transaction.currency_rate) : undefined,
  };
}

export function updateLedgerBalanceByEntry(
  entry: LedgerProto,
  ledgerBalance: Map<string, number>,
): void {
  if (entry.creditAccountID1) {
    const name =
      typeof entry.creditAccountID1 === 'string'
        ? entry.creditAccountID1
        : entry.creditAccountID1.name;
    ledgerBalance.set(
      name,
      (ledgerBalance.get(name) ?? 0) + (entry.localCurrencyCreditAmount1 ?? 0),
    );
  }
  if (entry.debitAccountID1) {
    const name =
      typeof entry.debitAccountID1 === 'string'
        ? entry.debitAccountID1
        : entry.debitAccountID1.name;
    ledgerBalance.set(
      name,
      (ledgerBalance.get(name) ?? 0) - (entry.localCurrencyDebitAmount1 ?? 0),
    );
  }
  if (entry.creditAccountID2) {
    const name =
      typeof entry.creditAccountID2 === 'string'
        ? entry.creditAccountID2
        : entry.creditAccountID2.name;
    ledgerBalance.set(
      name,
      (ledgerBalance.get(name) ?? 0) + (entry.localCurrencyCreditAmount2 ?? 0),
    );
  }
  if (entry.debitAccountID2) {
    const name =
      typeof entry.debitAccountID2 === 'string'
        ? entry.debitAccountID2
        : entry.debitAccountID2.name;
    ledgerBalance.set(
      name,
      (ledgerBalance.get(name) ?? 0) - (entry.localCurrencyDebitAmount2 ?? 0),
    );
  }

  return;
}
