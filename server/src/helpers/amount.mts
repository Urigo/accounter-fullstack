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
    case 'לש':
      return Currency.Gbp;
    case '$':
      return Currency.Usd;
    case 'אירו':
      return Currency.Eur;
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
    default:
      console.warn(`Unknown amount: "${rawAmount}". Using 0 instead.`);
      return 0;
  }
};
