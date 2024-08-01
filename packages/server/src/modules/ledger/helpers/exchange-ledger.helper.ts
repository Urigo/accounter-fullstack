import { GraphQLError } from 'graphql';
import { DEFAULT_LOCAL_CURRENCY } from '@shared/constants';
import { Currency } from '@shared/enums';
import type { LedgerProto } from '@shared/types';

export function validateExchangeRate(
  businessId: string,
  ledgerRecords: LedgerProto[],
  amount: number,
): string | true {
  try {
    const exchangeAmount = calculateExchangeRate(businessId, ledgerRecords);
    if (
      (!exchangeAmount && !!amount) ||
      (exchangeAmount && Math.abs(exchangeAmount).toFixed(2) !== amount.toFixed(2))
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
  amount?: number,
  localAmount?: number,
) {
  if (localAmount) {
    if (!(DEFAULT_LOCAL_CURRENCY in amounts)) {
      amounts[DEFAULT_LOCAL_CURRENCY] = 0;
    }
    amounts[DEFAULT_LOCAL_CURRENCY]! += localAmount;
  }
  if (amount) {
    if (!(currency in amounts)) {
      amounts[currency] = 0;
    }
    amounts[currency]! += amount;
  }
}

export function calculateExchangeRate(businessId: string, ledgerRecords: LedgerProto[]) {
  const amounts: Partial<Record<Currency, number>> = {};
  for (const record of ledgerRecords) {
    if (record.creditAccountID1 === businessId) {
      updateAmounts(
        amounts,
        record.currency,
        record.creditAmount1,
        record.localCurrencyCreditAmount1,
      );
    }
    if (record.creditAccountID2 === businessId) {
      updateAmounts(
        amounts,
        record.currency,
        record.creditAmount2,
        record.localCurrencyCreditAmount2,
      );
    }
    if (record.debitAccountID1 === businessId) {
      updateAmounts(
        amounts,
        record.currency,
        -(record.debitAmount1 ?? 0),
        -record.localCurrencyDebitAmount1,
      );
    }
    if (record.debitAccountID2 === businessId) {
      updateAmounts(
        amounts,
        record.currency,
        -(record.debitAmount2 ?? 0),
        -(record.localCurrencyDebitAmount2 ?? 0),
      );
    }
  }
  const currencies = Object.keys(amounts) as Currency[];
  if (!(DEFAULT_LOCAL_CURRENCY in amounts)) {
    throw new GraphQLError('Local currency amount is required');
  }
  const foreignCurrencies = currencies.filter(currency => currency !== DEFAULT_LOCAL_CURRENCY);
  if (foreignCurrencies.length === 0 && amounts[DEFAULT_LOCAL_CURRENCY] !== 0) {
    throw new GraphQLError('Exchange should be 0 as there are no foreign currencies involved');
  }
  for (const foreignCurrency of foreignCurrencies) {
    if (Math.abs(amounts[foreignCurrency] ?? 0) > 0.005) {
      throw new GraphQLError(`Exchange rate error - ${foreignCurrency} amount not balanced`);
    }
  }
  return amounts[DEFAULT_LOCAL_CURRENCY];
}
