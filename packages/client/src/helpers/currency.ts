import { Currency } from '../gql/graphql.js';

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
    case 'USD': {
      currencySymbol = '$';
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
    case 'CAD': {
      currencySymbol = 'C$';
      break;
    }
    case 'JPY': {
      currencySymbol = '¥';
      break;
    }
    case 'AUD': {
      currencySymbol = 'A$';
      break;
    }
    case 'SEK': {
      currencySymbol = 'kr';
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
    case 'ETH': {
      currencySymbol = 'ETH';
      break;
    }
  }
  return currencySymbol;
}
