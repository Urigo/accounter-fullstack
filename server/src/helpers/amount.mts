import { Currency, FinancialAmount } from '../__generated__/types.mjs';

export const formatStringifyAmount = (rawAmount: number): string => {
  const formattedParts = rawAmount.toFixed(2).split('.');
  // add commas
  formattedParts[0] = formattedParts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return formattedParts.join('.');
};

export const formatFinancialAmount = (
  rawAmount?: number | string | null,
  rawCurrency?: string | null,
): FinancialAmount => {
  const amount = formatAmount(rawAmount);
  const currency = formatCurrency(rawCurrency);
  return {
    raw: amount,
    formatted: `${formatStringifyAmount(amount)} ${currency}`,
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
      return Currency.Ils;
    case null:
      return Currency.Ils;
    case undefined:
      return Currency.Ils;
    default:
      console.warn(`Unknown currency: "${raw}". Using "ILS" instead.`);
      return Currency.Ils;
  }
};

export const formatAmount = (rawAmount?: number | string | null): number => {
  switch (typeof rawAmount) {
    case 'number':
      return rawAmount;
    case 'string': {
      const amount = parseFloat(rawAmount);
      if (amount) {
        return amount;
      }
      console.warn(`Unknown string amount: "${rawAmount}". Using 0 instead.`);
      return 0;
    }
    default:
      console.warn(`Unknown amount: "${rawAmount}". Using 0 instead.`);
      return 0;
  }
};
