import { GraphQLError } from 'graphql';
import { getCurrencySymbol } from '@shared/helpers';
import { Currency } from '../../../shared/enums.js';
import type { LedgerProto } from '../../../shared/types/index.js';

export function validateExchangeRate(
  businessId: string,
  ledgerRecords: LedgerProto[],
  amount: number,
  defaultLocalCurrency: Currency,
): string | true {
  try {
    const exchangeAmount = calculateExchangeRate(businessId, ledgerRecords, defaultLocalCurrency);
    if (
      (!exchangeAmount && !!amount) ||
      (exchangeAmount && Math.abs(exchangeAmount - amount) > 0.005)
    ) {
      return 'Exchange rate error';
    }
    return true;
  } catch (e) {
    return (e as Error).message;
  }
}

function updateAmounts(
  amounts: Partial<Record<Currency, number>>,
  currency: Currency,
  defaultLocalCurrency: Currency,
  amount?: number,
  localAmount?: number,
) {
  if (localAmount) {
    if (!(defaultLocalCurrency in amounts)) {
      amounts[defaultLocalCurrency] = 0;
    }
    amounts[defaultLocalCurrency]! += localAmount;
  }
  if (amount) {
    if (!(currency in amounts)) {
      amounts[currency] = 0;
    }
    amounts[currency]! += amount;
  }
}

export function calculateExchangeRate(
  businessId: string,
  ledgerRecords: LedgerProto[],
  defaultLocalCurrency: Currency,
) {
  const amounts: Partial<Record<Currency, number>> = {};
  for (const record of ledgerRecords) {
    if (record.creditAccountID1 === businessId) {
      updateAmounts(
        amounts,
        record.currency,
        defaultLocalCurrency,
        record.creditAmount1,
        record.localCurrencyCreditAmount1,
      );
    }
    if (record.creditAccountID2 === businessId) {
      updateAmounts(
        amounts,
        record.currency,
        defaultLocalCurrency,
        record.creditAmount2,
        record.localCurrencyCreditAmount2,
      );
    }
    if (record.debitAccountID1 === businessId) {
      updateAmounts(
        amounts,
        record.currency,
        defaultLocalCurrency,
        -(record.debitAmount1 ?? 0),
        -record.localCurrencyDebitAmount1,
      );
    }
    if (record.debitAccountID2 === businessId) {
      updateAmounts(
        amounts,
        record.currency,
        defaultLocalCurrency,
        -(record.debitAmount2 ?? 0),
        -(record.localCurrencyDebitAmount2 ?? 0),
      );
    }
  }
  const currencies = Object.keys(amounts) as Currency[];
  if (!(defaultLocalCurrency in amounts)) {
    throw new GraphQLError('Local currency amount is required');
  }
  const foreignCurrencies = currencies.filter(currency => currency !== defaultLocalCurrency);
  if (foreignCurrencies.length === 0 && amounts[defaultLocalCurrency] !== 0) {
    throw new GraphQLError('Exchange should be 0 as there are no foreign currencies involved');
  }
  for (const foreignCurrency of foreignCurrencies) {
    if (Math.abs(amounts[foreignCurrency] ?? 0) > 0.005) {
      throw new GraphQLError(
        `Exchange rate error - ${foreignCurrency} amount not balanced By ${amounts[foreignCurrency]!.toFixed(2)}${getCurrencySymbol(foreignCurrency)}`,
      );
    }
  }
  return amounts[defaultLocalCurrency];
}
