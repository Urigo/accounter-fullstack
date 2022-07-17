import { Currency, FinancialAmount } from '../generated-types/graphql';

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
      return 'GBP';
    case 'לש':
      return 'GBP';
    case 'USD':
      return 'USD';
    case '$':
      return 'USD';
    case 'EUR':
      return 'EUR';
    case 'אירו':
      return 'EUR';
    case 'ILS':
      return 'ILS';
    case null:
      return 'ILS';
    case undefined:
      return 'ILS';
    default:
      console.warn(`Unknown currency: "${raw}". Using "ILS" instead.`);
      return 'ILS';
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
      console.warn(`Unknown amount: "${rawAmount}". Using 0 instead.`);
      return 0;
    }
    default:
      console.warn(`Unknown amount: "${rawAmount}". Using 0 instead.`);
      return 0;
  }
};
