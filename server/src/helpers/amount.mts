import { Currency, FinancialAmount } from '../__generated__/types.mjs';

export const formatFinancialAmount = (
  rawAmount?: number | string | null,
  rawCurrency?: string | null
): FinancialAmount => {
  const amount = formatAmount(rawAmount);
  const currency = formatCurrency(rawCurrency);
  return {
    raw: amount,
    formatted: `${amount.toFixed(2)} ${currency}`,
    currency,
  };
};

export const formatCurrency = (raw?: string | null): Currency => {
  switch (raw) {
    case 'GBP':
      return Currency.Gbp;
    case 'לש':
      return Currency.Gbp;
    case 'USD':
      return Currency.Usd;
    case '$':
      return Currency.Usd;
    case 'EUR':
      return Currency.Eur;
    case 'אירו':
      return Currency.Eur;
    case 'ILS':
      return Currency.Nis;
    case null:
      return Currency.Nis;
    case undefined:
      return Currency.Nis;
    default:
      console.warn(`Unknown currency: "${raw}". Using "ILS" instead.`);
      return Currency.Nis;
  }
};

export const formatAmount = (rawAmount?: number | string | null): number => {
  switch (typeof rawAmount) {
    case 'number':
      return rawAmount;
    case 'string':
      const amount = parseFloat(rawAmount);
      if (amount) {
        return amount;
      }
      console.warn(`Unknown amount: "${rawAmount}". Using 0 instead.`);
      return 0;
    default:
      console.warn(`Unknown amount: "${rawAmount}". Using 0 instead.`);
      return 0;
  }
};
