export const formatCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export function currencyCodeToSymbol(currency_code: string): string {
  let currencySymbol = '₪';
  if (currency_code === 'USD') {
    currencySymbol = '$';
  } else if (currency_code === 'EUR') {
    currencySymbol = '€';
  } else if (currency_code === 'GBP') {
    currencySymbol = '£';
  } else if (currency_code === 'GRT') {
    currencySymbol = 'GRT';
  } else if (currency_code === 'USDC') {
    currencySymbol = 'USDC';
  } else if (currency_code === 'ETH') {
    currencySymbol = 'ETH';
  }
  return currencySymbol;
}
