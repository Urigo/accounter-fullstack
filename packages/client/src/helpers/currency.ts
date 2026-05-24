import { Currency } from '../gql/graphql.js';
import { formatStringifyAmount } from './index.js';

export function getCurrencyFormatter(
  currency: Currency,
  options?: Omit<Intl.NumberFormatOptions, 'currency'>,
): Intl.NumberFormat {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    ...options,
    currency,
  });
}

export function currencyCodeToSymbol(currency_code: Currency): string {
  let currencySymbol = '₪';
  switch (currency_code) {
    case 'AUD': {
      currencySymbol = 'A$';
      break;
    }
    case 'CAD': {
      currencySymbol = 'C$';
      break;
    }
    case 'EUR': {
      currencySymbol = '€';
      break;
    }
    case 'GBP': {
      currencySymbol = '£';
      break;
    }
    case 'JPY': {
      currencySymbol = '¥';
      break;
    }
    case 'SEK': {
      currencySymbol = 'kr';
      break;
    }
    case 'UAH': {
      currencySymbol = '₴';
      break;
    }
    case 'USD': {
      currencySymbol = '$';
      break;
    }
    case 'ETH': {
      currencySymbol = 'ETH';
      break;
    }
    case 'GRT': {
      currencySymbol = 'GRT';
      break;
    }
    case 'USDC': {
      currencySymbol = 'USDC';
      break;
    }
  }
  return currencySymbol;
}

export const FIAT_CURRENCIES: Currency[] = [
  Currency.Ils,
  Currency.Aud,
  Currency.Cad,
  Currency.Eur,
  Currency.Gbp,
  Currency.Jpy,
  Currency.Sek,
  Currency.Uah,
  Currency.Usd,
] as const;

export function formatAmountWithCurrency(amount: number, currency: Currency, digits = 2): string {
  return `${currencyCodeToSymbol(currency)} ${formatStringifyAmount(amount, digits)}`;
}
