import { Currency } from '../gql/graphql.js';

export const formatCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export function currencyCodeToSymbol(currency_code: Currency): string {
  let currencySymbol = '₪';
  if (currency_code === 'USD') {
    currencySymbol = '$';
  } else if (currency_code === 'EUR') {
    currencySymbol = '€';
  } else if (currency_code === 'GBP') {
    currencySymbol = '&#163;';
  } else if (currency_code === 'CAD') {
    currencySymbol = 'C$';
  } else if (currency_code === 'GRT') {
    currencySymbol = 'GRT';
  } else if (currency_code === 'USDC') {
    currencySymbol = 'USDC';
  } else if (currency_code === 'ETH') {
    currencySymbol = 'ETH';
  }
  return currencySymbol;
}
