import { describe, it, expect } from 'vitest';
import { calculateCurrencyConfidence } from '../helpers/currency-confidence.helper.js';

describe('calculateCurrencyConfidence', () => {
  describe('same currency', () => {
    it('should return 1.0 for identical USD', () => {
      expect(calculateCurrencyConfidence('USD', 'USD')).toBe(1.0);
    });

    it('should return 1.0 for identical EUR', () => {
      expect(calculateCurrencyConfidence('EUR', 'EUR')).toBe(1.0);
    });

    it('should return 1.0 for identical ILS', () => {
      expect(calculateCurrencyConfidence('ILS', 'ILS')).toBe(1.0);
    });

    it('should return 1.0 for identical GBP', () => {
      expect(calculateCurrencyConfidence('GBP', 'GBP')).toBe(1.0);
    });

    it('should return 1.0 for identical USDC', () => {
      expect(calculateCurrencyConfidence('USDC', 'USDC')).toBe(1.0);
    });

    it('should return 1.0 for identical GRT', () => {
      expect(calculateCurrencyConfidence('GRT', 'GRT')).toBe(1.0);
    });

    it('should return 1.0 for identical ETH', () => {
      expect(calculateCurrencyConfidence('ETH', 'ETH')).toBe(1.0);
    });
  });

  describe('different currencies', () => {
    it('should return 0.0 for USD vs EUR', () => {
      expect(calculateCurrencyConfidence('USD', 'EUR')).toBe(0.0);
    });

    it('should return 0.0 for ILS vs USD', () => {
      expect(calculateCurrencyConfidence('ILS', 'USD')).toBe(0.0);
    });

    it('should return 0.0 for EUR vs GBP', () => {
      expect(calculateCurrencyConfidence('EUR', 'GBP')).toBe(0.0);
    });

    it('should return 0.0 for GRT vs ETH', () => {
      expect(calculateCurrencyConfidence('GRT', 'ETH')).toBe(0.0);
    });

    it('should return 0.0 for USDC vs USD', () => {
      expect(calculateCurrencyConfidence('USDC', 'USD')).toBe(0.0);
    });
  });

  describe('case sensitivity', () => {
    it('should be case-insensitive for uppercase vs lowercase', () => {
      expect(calculateCurrencyConfidence('USD', 'usd')).toBe(1.0);
    });

    it('should be case-insensitive for lowercase vs uppercase', () => {
      expect(calculateCurrencyConfidence('eur', 'EUR')).toBe(1.0);
    });

    it('should be case-insensitive for mixed case', () => {
      expect(calculateCurrencyConfidence('Usd', 'UsD')).toBe(1.0);
    });

    it('should be case-insensitive for ILS variations', () => {
      expect(calculateCurrencyConfidence('ILS', 'ils')).toBe(1.0);
      expect(calculateCurrencyConfidence('ils', 'ILS')).toBe(1.0);
    });
  });

  describe('edge cases with null and undefined', () => {
    it('should return 0.2 when transaction currency is null', () => {
      expect(calculateCurrencyConfidence(null, 'USD')).toBe(0.2);
    });

    it('should return 0.2 when document currency is null', () => {
      expect(calculateCurrencyConfidence('USD', null)).toBe(0.2);
    });

    it('should return 0.2 when both currencies are null', () => {
      expect(calculateCurrencyConfidence(null, null)).toBe(0.2);
    });

    it('should return 0.2 when transaction currency is undefined', () => {
      expect(calculateCurrencyConfidence(undefined, 'USD')).toBe(0.2);
    });

    it('should return 0.2 when document currency is undefined', () => {
      expect(calculateCurrencyConfidence('USD', undefined)).toBe(0.2);
    });

    it('should return 0.2 when both currencies are undefined', () => {
      expect(calculateCurrencyConfidence(undefined, undefined)).toBe(0.2);
    });

    it('should return 0.2 when transaction is null and document is undefined', () => {
      expect(calculateCurrencyConfidence(null, undefined)).toBe(0.2);
    });

    it('should return 0.2 when transaction is undefined and document is null', () => {
      expect(calculateCurrencyConfidence(undefined, null)).toBe(0.2);
    });
  });

  describe('edge cases with empty strings', () => {
    it('should return 0.2 when transaction currency is empty string', () => {
      expect(calculateCurrencyConfidence('', 'USD')).toBe(0.2);
    });

    it('should return 0.2 when document currency is empty string', () => {
      expect(calculateCurrencyConfidence('USD', '')).toBe(0.2);
    });

    it('should return 0.2 when both currencies are empty strings', () => {
      expect(calculateCurrencyConfidence('', '')).toBe(0.2);
    });
  });

  describe('symmetry', () => {
    it('should return same result regardless of parameter order for same currencies', () => {
      expect(calculateCurrencyConfidence('USD', 'EUR')).toBe(
        calculateCurrencyConfidence('EUR', 'USD'),
      );
    });

    it('should return same result regardless of parameter order for matching currencies', () => {
      expect(calculateCurrencyConfidence('USD', 'USD')).toBe(
        calculateCurrencyConfidence('USD', 'USD'),
      );
    });
  });

  describe('return value validation', () => {
    it('should return exactly 1.0, 0.2, or 0.0 (no other values)', () => {
      const result1 = calculateCurrencyConfidence('USD', 'USD');
      const result2 = calculateCurrencyConfidence('USD', 'EUR');
      const result3 = calculateCurrencyConfidence(null, 'USD');

      expect([1.0, 0.2, 0.0]).toContain(result1);
      expect([1.0, 0.2, 0.0]).toContain(result2);
      expect([1.0, 0.2, 0.0]).toContain(result3);
    });

    it('should return numbers with correct precision', () => {
      const match = calculateCurrencyConfidence('USD', 'USD');
      const mismatch = calculateCurrencyConfidence('USD', 'EUR');
      const missing = calculateCurrencyConfidence(null, 'USD');

      expect(match).toBe(1.0);
      expect(mismatch).toBe(0.0);
      expect(missing).toBe(0.2);

      // Verify exact values
      expect(match === 1.0).toBe(true);
      expect(mismatch === 0.0).toBe(true);
      expect(missing === 0.2).toBe(true);
    });
  });
});
