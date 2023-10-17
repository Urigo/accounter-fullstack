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
    // TODO: use symbol
    currencySymbol = 'GRT';
  } else if (currency_code === 'USDC') {
    // TODO: use symbol
    currencySymbol = 'USDC';
  } else if (currency_code === 'ETH') {
    // TODO: use symbol
    currencySymbol = 'ETH';
  }
  return currencySymbol;
}
