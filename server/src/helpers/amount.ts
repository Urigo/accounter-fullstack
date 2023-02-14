import { Currency, FinancialAmount, FinancialIntAmount } from '../__generated__/types.js';

export const addCommasToStringifiedInt = (rawAmount: string | number): string => {
  // add commas
  const formattedAmount = rawAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return formattedAmount;
};

export const formatStringifyAmount = (rawAmount: number): string => {
  const formattedParts = rawAmount.toFixed(2).split('.');
  // add commas
  formattedParts[0] = addCommasToStringifiedInt(formattedParts[0]);
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
    formatted: `${formatStringifyAmount(amount)} ${getCurrencySymbol(currency)}`,
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

export function getCurrencySymbol(currency: Currency) {
  switch (currency) {
    case Currency.Gbp:
      return '£';
    case Currency.Usd:
      return '$';
    case Currency.Eur:
      return '€';
    case Currency.Ils:
      return '₪';
    default:
      console.warn(`Unknown currency code: "${currency}". Using "₪" as default symbol.`);
      return '₪';
  }
}

export const formatFinancialIntAmount = (
  rawAmount?: number | string | null,
  rawCurrency?: string | null,
): FinancialIntAmount => {
  let amount = formatAmount(rawAmount);
  if (!Number.isInteger(amount)) {
    console.warn(`formatStringifyIntAmount got a non-integer amount${amount}. Rounding it.`);
    amount = Math.round(formatAmount(amount));
  }
  const currency = formatCurrency(rawCurrency);
  return {
    raw: amount,
    formatted: `${addCommasToStringifiedInt(amount)} ${getCurrencySymbol(currency)}`,
    currency,
  };
};

export const formatAmount = (rawAmount?: number | string | null): number => {
  switch (typeof rawAmount) {
    case 'number':
      return rawAmount;
    case 'string': {
      const amount = parseFloat(rawAmount);
      if (!Number.isNaN(amount)) {
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
