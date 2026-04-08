export function normalizeCurrencySymbol(currencySymbol: string): string {
  switch (currencySymbol) {
    case '$':
    case 'USD':
    case 'דולר':
      return 'USD';
    case '₪':
    case 'NIS':
    case 'ש"ח':
      return 'ILS';
    case '€':
    case 'EUR':
      return 'EUR';
    case '£':
    case 'GBP':
      return 'GBP';
    default:
      return 'ILS';
  }
}
