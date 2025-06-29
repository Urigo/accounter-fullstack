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
  if (currency_code === 'USD') {
    currencySymbol = '$';
  } else if (currency_code === 'EUR') {
    currencySymbol = '€';
  } else if (currency_code === 'GBP') {
    currencySymbol = '£';
  } else if (currency_code === 'CAD') {
    currencySymbol = 'C$';
  } else if (currency_code === 'JPY') {
    currencySymbol = '¥';
  } else if (currency_code === 'GRT') {
    currencySymbol = 'GRT';
  } else if (currency_code === 'USDC') {
    currencySymbol = 'USDC';
  } else if (currency_code === 'ETH') {
    currencySymbol = 'ETH';
  }
  return currencySymbol;
}
