import { describe, expect, it } from 'vitest';
import { mockExchangeRate, createMockExchangeRates } from './exchange-mock.js';
import { Currency } from '@shared/enums';

describe('exchange-mock', () => {
  describe('mockExchangeRate', () => {
    it('should return fixed rate for configured currency pair', async () => {
      const mockFn = mockExchangeRate(Currency.Usd, Currency.Ils, 3.5);
      const rate = await mockFn(Currency.Usd, Currency.Ils, new Date('2024-01-01'));
      expect(rate).toBe(3.5);
    });

    it('should return 1 for same currency', async () => {
      const mockFn = mockExchangeRate(Currency.Usd, Currency.Ils, 3.5);
      const rate = await mockFn(Currency.Usd, Currency.Usd, new Date('2024-01-01'));
      expect(rate).toBe(1);
    });

    it('should return inverse rate for swapped pair', async () => {
      const mockFn = mockExchangeRate(Currency.Usd, Currency.Ils, 4.0);
      const rate = await mockFn(Currency.Ils, Currency.Usd, new Date('2024-01-01'));
      expect(rate).toBe(0.25); // 1 / 4.0
    });

    it('should throw error for unmocked pair', async () => {
      const mockFn = mockExchangeRate(Currency.Usd, Currency.Ils, 3.5);
      await expect(
        mockFn(Currency.Eur, Currency.Gbp, new Date('2024-01-01')),
      ).rejects.toThrow(/No exchange rate mock configured for EUR → GBP/);
    });
  });

  describe('createMockExchangeRates', () => {
    it('should support multiple mocked pairs', async () => {
      const mockFn = createMockExchangeRates([
        { fromCurrency: Currency.Usd, toCurrency: Currency.Ils, rate: 3.5 },
        { fromCurrency: Currency.Eur, toCurrency: Currency.Ils, rate: 4.2 },
      ]);

      const usdRate = await mockFn(Currency.Usd, Currency.Ils, new Date('2024-01-01'));
      const eurRate = await mockFn(Currency.Eur, Currency.Ils, new Date('2024-01-01'));

      expect(usdRate).toBe(3.5);
      expect(eurRate).toBe(4.2);
    });

    it('should handle inverse rates for multiple pairs', async () => {
      const mockFn = createMockExchangeRates([
        { fromCurrency: Currency.Usd, toCurrency: Currency.Ils, rate: 4.0 },
        { fromCurrency: Currency.Eur, toCurrency: Currency.Ils, rate: 5.0 },
      ]);

      const ilsToUsd = await mockFn(Currency.Ils, Currency.Usd, new Date('2024-01-01'));
      const ilsToEur = await mockFn(Currency.Ils, Currency.Eur, new Date('2024-01-01'));

      expect(ilsToUsd).toBe(0.25); // 1 / 4.0
      expect(ilsToEur).toBe(0.2); // 1 / 5.0
    });

    it('should list available mocks in error message', async () => {
      const mockFn = createMockExchangeRates([
        { fromCurrency: Currency.Usd, toCurrency: Currency.Ils, rate: 3.5 },
        { fromCurrency: Currency.Eur, toCurrency: Currency.Gbp, rate: 1.2 },
      ]);

      await expect(mockFn(Currency.Jpy, Currency.Aud, new Date('2024-01-01'))).rejects.toThrow(
        /Available mocks: USD→ILS, EUR→GBP/,
      );
    });
  });
});
