import { GraphQLError } from 'graphql';
import { Currency, FinancialAmount, FinancialIntAmount } from '@shared/gql-types';

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
    formatted: `${getCurrencySymbol(currency)} ${formatStringifyAmount(amount)}`,
    currency,
  };
};

export function formatCurrency<T extends boolean = false>(
  raw: string | null = null,
  nullable?: T,
): Currency | (T extends true ? null : never) {
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
    case 'GRT':
      return Currency.Grt;
    case 'USDC':
      return Currency.Usdc;
    case 'ETH':
      return Currency.Eth;
    case null:
      return Currency.Ils;
    case undefined:
      return Currency.Ils;
    default:
      if (nullable) {
        return null as T extends true ? null : never;
      }
      console.warn(`Unknown currency: "${raw}". Using "ILS" instead.`);
      return Currency.Ils;
  }
}

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
    case Currency.Grt:
      return 'GRT';
    case Currency.Usdc:
      return 'USDC';
    case Currency.Eth:
      return 'Ξ';
    default:
      throw new GraphQLError(`Unknown currency code: "${currency}". Using "₪" as default symbol.`);
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
    formatted: `${getCurrencySymbol(currency)} ${addCommasToStringifiedInt(amount)}`,
    currency,
  };
};

export const formatAmount = (rawAmount?: number | string | null): number => {
  switch (typeof rawAmount) {
    case 'number':
      return rawAmount;
    case 'string': {
      const amount = parseFloat(rawAmount);
      if (Number.isNaN(amount)) {
        throw new GraphQLError(`Unknown string amount: "${rawAmount}". Using 0 instead.`);
      }
      return amount;
    }
    default:
      return 0;
  }
};
