import type { Currency } from '../../shared/enums.js';
import type { ExchangeProvider } from '../../modules/exchange-rates/providers/exchange.provider.js';

/**
 * Configuration for a mocked exchange rate.
 */
export interface ExchangeRateMock {
  fromCurrency: Currency;
  toCurrency: Currency;
  rate: number;
}

/**
 * Creates a mock function that overrides ExchangeProvider.getExchangeRates
 * to return a fixed rate for specific currency pairs.
 *
 * @example
 * ```ts
 * // Fix USD → ILS at 3.5
 * const mockFn = createMockExchangeRates([
 *   { fromCurrency: Currency.Usd, toCurrency: Currency.Ils, rate: 3.5 }
 * ]);
 * provider.getExchangeRates = mockFn;
 * ```
 */
export function createMockExchangeRates(
  mocks: ExchangeRateMock[],
): ExchangeProvider['getExchangeRates'] {
  return async function getExchangeRates(
    baseCurrency: Currency,
    quoteCurrency: Currency,
    _date: Date,
  ): Promise<number> {
    // Same currency always returns 1
    if (baseCurrency === quoteCurrency) {
      return 1;
    }

    // Find matching mock
    const mock = mocks.find(
      m => m.fromCurrency === baseCurrency && m.toCurrency === quoteCurrency,
    );

    if (mock) {
      return mock.rate;
    }

    // Try inverse rate (base/quote swapped)
    const inverseMock = mocks.find(
      m => m.fromCurrency === quoteCurrency && m.toCurrency === baseCurrency,
    );

    if (inverseMock) {
      return 1 / inverseMock.rate;
    }

    // No mock found - throw error to prevent fallthrough to real API
    throw new Error(
      `No exchange rate mock configured for ${baseCurrency} → ${quoteCurrency}. ` +
        `Available mocks: ${mocks.map(m => `${m.fromCurrency}→${m.toCurrency}`).join(', ')}`,
    );
  };
}

/**
 * Convenience function to create a single exchange rate mock.
 *
 * @example
 * ```ts
 * const mockFn = mockExchangeRate(Currency.Usd, Currency.Ils, 3.5);
 * provider.getExchangeRates = mockFn;
 * ```
 */
export function mockExchangeRate(
  fromCurrency: Currency,
  toCurrency: Currency,
  rate: number,
): ExchangeProvider['getExchangeRates'] {
  return createMockExchangeRates([{ fromCurrency, toCurrency, rate }]);
}
