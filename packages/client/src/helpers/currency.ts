import { Currency } from '../gql/graphql.js';
import { formatStringifyAmount } from './index.js';

export type CurrencyFormatter = Pick<Intl.NumberFormat, 'format'>;

export function getCurrencyFormatter(
  currency: Currency,
  options?: Omit<Intl.NumberFormatOptions, 'currency'>,
): CurrencyFormatter {
  // Crypto currencies (e.g. USDC, ETH, GRT) are not valid ISO 4217 codes, so
  // `Intl.NumberFormat` with `style: 'currency'` throws a RangeError. Fall back
  // to decimal formatting and prepend the currency symbol for those.
  if (!FIAT_CURRENCIES.includes(currency)) {
    const decimalFormatter = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...options,
      style: 'decimal',
    });
    return {
      format: (value: number): string =>
        `${currencyCodeToSymbol(currency)} ${decimalFormatter.format(value)}`,
    };
  }
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

export const FIAT_CURRENCIES: Currency[] = [
  Currency.Ils,
  Currency.Eur,
  Currency.Usd,
  Currency.Gbp,
  Currency.Cad,
  Currency.Jpy,
  Currency.Aud,
  Currency.Sek,
] as const;

export function formatAmountWithCurrency(amount: number, currency: Currency, digits = 2): string {
  return `${currencyCodeToSymbol(currency)} ${formatStringifyAmount(amount, digits)}`;
}
