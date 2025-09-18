import type { IGetChargesByIdsResult } from '@modules/charges/types';
import { ExchangeProvider } from '@modules/exchange-rates/providers/exchange.provider.js';
import type { IGetTransactionsByChargeIdsResult } from '@modules/transactions/types.js';
import type { LedgerProto } from '@shared/types';
import {
  getFinancialAccountTaxCategoryId,
  LedgerError,
  validateTransactionBasicVariables,
} from './utils.helper.js';

export function splitFeeTransactions(transactions: Array<IGetTransactionsByChargeIdsResult>) {
  const feeTransactions = [];
  const mainTransactions = [];
  for (const transaction of transactions) {
    if (transaction.is_fee) {
      feeTransactions.push(transaction);
    } else {
      mainTransactions.push(transaction);
    }
  }
  return { feeTransactions, mainTransactions };
}

export function isSupplementalFeeTransaction(
  transaction: IGetTransactionsByChargeIdsResult,
  context: GraphQLModules.Context,
): boolean {
  const { internalWalletsIds, swiftBusinessId } = context.adminContext.financialAccounts;
  if (!transaction.is_fee) {
    return false;
  }
  if (!transaction.business_id) {
    throw new LedgerError(
      `Transaction reference "${transaction.source_reference}" is missing business_id, which is required to figure if fee is supplemental`,
    );
  }

  if (internalWalletsIds.includes(transaction.business_id)) {
    return true;
  }

  const fundamentalFeeBusinesses = [swiftBusinessId].filter(Boolean) as string[];
  if (fundamentalFeeBusinesses.includes(transaction.business_id)) {
    return false;
  }
  throw new LedgerError(
    `Unable to determine if business ID="${transaction.business_id}" is supplemental or fundamental fee`,
  );
}

export async function getEntriesFromFeeTransaction(
  transaction: IGetTransactionsByChargeIdsResult,
  charge: IGetChargesByIdsResult,
  context: GraphQLModules.Context,
): Promise<Array<LedgerProto>> {
  const {
    injector,
    adminContext: {
      defaultLocalCurrency,
      general: {
        taxCategories: { feeTaxCategoryId, generalFeeTaxCategoryId },
      },
    },
  } = context;
  const ledgerEntries: Array<LedgerProto> = [];

  if (!transaction.is_fee) {
    throw new LedgerError(
      `Seems like did a non-fee transaction marked as fee (Transaction ID="${transaction.id}")`,
    );
  }

  if (Number(transaction.amount) === 0) {
    // no ledger entries for 0 amount fee transactions
    return ledgerEntries;
  }

  const isSupplementalFee = isSupplementalFeeTransaction(transaction, context);
  const { currency, valueDate, transactionBusinessId } =
    validateTransactionBasicVariables(transaction);

  let amount = Number(transaction.amount);
  let foreignAmount: number | undefined = undefined;

  if (currency !== defaultLocalCurrency) {
    // get exchange rate for currency
    const exchangeRate = await injector
      .get(ExchangeProvider)
      .getExchangeRates(currency, defaultLocalCurrency, valueDate);

    foreignAmount = amount;
    // calculate amounts in ILS
    amount = exchangeRate * amount;
  }

  const isCreditorCounterparty = amount > 0;

  let mainAccount = transactionBusinessId;

  const partialLedgerEntry: LedgerProto = {
    id: transaction.id,
    invoiceDate: transaction.event_date,
    valueDate,
    currency,
    creditAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
    localCurrencyCreditAmount1: Math.abs(amount),
    debitAmount1: foreignAmount ? Math.abs(foreignAmount) : undefined,
    localCurrencyDebitAmount1: Math.abs(amount),
    description: transaction.source_description ?? undefined,
    reference: transaction.origin_key,
    isCreditorCounterparty: isSupplementalFee ? isCreditorCounterparty : !isCreditorCounterparty,
    ownerId: charge.owner_id,
    currencyRate: transaction.currency_rate ? Number(transaction.currency_rate) : undefined,
    chargeId: transaction.charge_id,
  };

  if (isSupplementalFee) {
    mainAccount = await getFinancialAccountTaxCategoryId(injector, transaction);
  } else {
    const mainBusiness = charge.business_id ?? undefined;

    const ledgerEntry: LedgerProto = {
      ...partialLedgerEntry,
      creditAccountID1: isCreditorCounterparty ? mainAccount : mainBusiness,
      debitAccountID1: isCreditorCounterparty ? mainBusiness : mainAccount,
    };

    ledgerEntries.push(ledgerEntry);
  }

  const feeTaxCategory =
    charge.tax_category_id === generalFeeTaxCategoryId ? generalFeeTaxCategoryId : feeTaxCategoryId;

  const ledgerEntry: LedgerProto = {
    ...partialLedgerEntry,
    creditAccountID1: isCreditorCounterparty ? feeTaxCategory : mainAccount,
    debitAccountID1: isCreditorCounterparty ? mainAccount : feeTaxCategory,
  };

  ledgerEntries.push(ledgerEntry);

  return ledgerEntries;
}
