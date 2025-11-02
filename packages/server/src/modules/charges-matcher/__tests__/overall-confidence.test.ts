import { describe, expect, it } from 'vitest';
import {
  calculateOverallConfidence,
  type ConfidenceComponents,
} from '../helpers/overall-confidence.helper.js';

describe('Overall Confidence Calculator', () => {
  describe('Perfect Matches', () => {
    it('should return 1.0 when all components are 1.0', () => {
      const components: ConfidenceComponents = {
        amount: 1.0,
        currency: 1.0,
        business: 1.0,
        date: 1.0,
      };

      expect(calculateOverallConfidence(components)).toBe(1.0);
    });

    it('should return 1.0 when all components are exactly 1.0', () => {
      const result = calculateOverallConfidence({
        amount: 1.0,
        currency: 1.0,
        business: 1.0,
        date: 1.0,
      });

      expect(result).toBe(1.0);
      expect(typeof result).toBe('number');
    });
  });

  describe('Zero Matches', () => {
    it('should return 0.0 when all components are 0.0', () => {
      const components: ConfidenceComponents = {
        amount: 0.0,
        currency: 0.0,
        business: 0.0,
        date: 0.0,
      };

      expect(calculateOverallConfidence(components)).toBe(0.0);
    });
  });

  describe('Weighted Formula Verification', () => {
    it('should correctly apply amount weight (0.4)', () => {
      // Only amount is 1.0, others are 0.0
      const result = calculateOverallConfidence({
        amount: 1.0,
        currency: 0.0,
        business: 0.0,
        date: 0.0,
      });

      expect(result).toBe(0.4);
    });

    it('should correctly apply currency weight (0.2)', () => {
      // Only currency is 1.0, others are 0.0
      const result = calculateOverallConfidence({
        amount: 0.0,
        currency: 1.0,
        business: 0.0,
        date: 0.0,
      });

      expect(result).toBe(0.2);
    });

    it('should correctly apply business weight (0.3)', () => {
      // Only business is 1.0, others are 0.0
      const result = calculateOverallConfidence({
        amount: 0.0,
        currency: 0.0,
        business: 1.0,
        date: 0.0,
      });

      expect(result).toBe(0.3);
    });

    it('should correctly apply date weight (0.1)', () => {
      // Only date is 1.0, others are 0.0
      const result = calculateOverallConfidence({
        amount: 0.0,
        currency: 0.0,
        business: 0.0,
        date: 1.0,
      });

      expect(result).toBe(0.1);
    });

    it('should verify weights sum to 1.0', () => {
      // When all components are 1.0, result should be 1.0
      // This verifies: 0.4 + 0.2 + 0.3 + 0.1 = 1.0
      const result = calculateOverallConfidence({
        amount: 1.0,
        currency: 1.0,
        business: 1.0,
        date: 1.0,
      });

      expect(result).toBe(1.0);
    });
  });

  describe('Mixed Confidence Scenarios', () => {
    it('should handle typical good match (all high)', () => {
      const result = calculateOverallConfidence({
        amount: 0.9,
        currency: 1.0,
        business: 1.0,
        date: 1.0,
      });

      // (0.9 × 0.4) + (1.0 × 0.2) + (1.0 × 0.3) + (1.0 × 0.1) = 0.96
      expect(result).toBe(0.96);
    });

    it('should handle partial match (mixed scores)', () => {
      const result = calculateOverallConfidence({
        amount: 0.9,
        currency: 1.0,
        business: 0.5,
        date: 0.8,
      });

      // (0.9 × 0.4) + (1.0 × 0.2) + (0.5 × 0.3) + (0.8 × 0.1)
      // = 0.36 + 0.2 + 0.15 + 0.08 = 0.79
      expect(result).toBe(0.79);
    });

    it('should handle uncertain business with good other factors', () => {
      const result = calculateOverallConfidence({
        amount: 1.0,
        currency: 1.0,
        business: 0.5,
        date: 1.0,
      });

      // (1.0 × 0.4) + (1.0 × 0.2) + (0.5 × 0.3) + (1.0 × 0.1)
      // = 0.4 + 0.2 + 0.15 + 0.1 = 0.85
      expect(result).toBe(0.85);
    });

    it('should handle missing currency with good match otherwise', () => {
      const result = calculateOverallConfidence({
        amount: 1.0,
        currency: 0.2, // Missing currency penalty
        business: 1.0,
        date: 1.0,
      });

      // (1.0 × 0.4) + (0.2 × 0.2) + (1.0 × 0.3) + (1.0 × 0.1)
      // = 0.4 + 0.04 + 0.3 + 0.1 = 0.84
      expect(result).toBe(0.84);
    });

    it('should handle business mismatch with good amount/currency', () => {
      const result = calculateOverallConfidence({
        amount: 1.0,
        currency: 1.0,
        business: 0.2, // Mismatch
        date: 1.0,
      });

      // (1.0 × 0.4) + (1.0 × 0.2) + (0.2 × 0.3) + (1.0 × 0.1)
      // = 0.4 + 0.2 + 0.06 + 0.1 = 0.76
      expect(result).toBe(0.76);
    });

    it('should handle old date with perfect other factors', () => {
      const result = calculateOverallConfidence({
        amount: 1.0,
        currency: 1.0,
        business: 1.0,
        date: 0.0, // 30+ days apart
      });

      // (1.0 × 0.4) + (1.0 × 0.2) + (1.0 × 0.3) + (0.0 × 0.1)
      // = 0.4 + 0.2 + 0.3 + 0.0 = 0.9
      expect(result).toBe(0.9);
    });
  });

  describe('Auto-Match Threshold Scenarios', () => {
    it('should identify clear auto-match candidate (≥0.95)', () => {
      const result = calculateOverallConfidence({
        amount: 1.0,
        currency: 1.0,
        business: 1.0,
        date: 0.5,
      });

      // (1.0 × 0.4) + (1.0 × 0.2) + (1.0 × 0.3) + (0.5 × 0.1)
      // = 0.4 + 0.2 + 0.3 + 0.05 = 0.95
      expect(result).toBe(0.95);
      expect(result).toBeGreaterThanOrEqual(0.95);
    });

    it('should identify borderline case (just below threshold)', () => {
      const result = calculateOverallConfidence({
        amount: 0.9,
        currency: 1.0,
        business: 1.0,
        date: 0.9,
      });

      // (0.9 × 0.4) + (1.0 × 0.2) + (1.0 × 0.3) + (0.9 × 0.1)
      // = 0.36 + 0.2 + 0.3 + 0.09 = 0.95
      expect(result).toBe(0.95);
    });

    it('should identify case just above threshold', () => {
      const result = calculateOverallConfidence({
        amount: 1.0,
        currency: 1.0,
        business: 1.0,
        date: 0.6,
      });

      // (1.0 × 0.4) + (1.0 × 0.2) + (1.0 × 0.3) + (0.6 × 0.1)
      // = 0.4 + 0.2 + 0.3 + 0.06 = 0.96
      expect(result).toBe(0.96);
      expect(result).toBeGreaterThan(0.95);
    });
  });

  describe('Decimal Precision', () => {
    it('should round to 2 decimal places', () => {
      const result = calculateOverallConfidence({
        amount: 0.333,
        currency: 0.667,
        business: 0.555,
        date: 0.444,
      });

      // (0.333 × 0.4) + (0.667 × 0.2) + (0.555 × 0.3) + (0.444 × 0.1)
      // = 0.1332 + 0.1334 + 0.1665 + 0.0444 = 0.4775
      expect(result).toBe(0.48);
    });

    it('should handle rounding edge case (0.445 rounds to 0.45)', () => {
      const result = calculateOverallConfidence({
        amount: 0.5,
        currency: 0.5,
        business: 0.5,
        date: 0.0,
      });

      // (0.5 × 0.4) + (0.5 × 0.2) + (0.5 × 0.3) + (0.0 × 0.1)
      // = 0.2 + 0.1 + 0.15 + 0.0 = 0.45
      expect(result).toBe(0.45);
    });

    it('should handle precise calculation without floating point errors', () => {
      const result = calculateOverallConfidence({
        amount: 0.1,
        currency: 0.2,
        business: 0.3,
        date: 0.4,
      });

      // (0.1 × 0.4) + (0.2 × 0.2) + (0.3 × 0.3) + (0.4 × 0.1)
      // = 0.04 + 0.04 + 0.09 + 0.04 = 0.21
      expect(result).toBe(0.21);
    });
  });

  describe('Edge Cases', () => {
    it('should handle all components at 0.5', () => {
      const result = calculateOverallConfidence({
        amount: 0.5,
        currency: 0.5,
        business: 0.5,
        date: 0.5,
      });

      // (0.5 × 0.4) + (0.5 × 0.2) + (0.5 × 0.3) + (0.5 × 0.1)
      // = 0.2 + 0.1 + 0.15 + 0.05 = 0.5
      expect(result).toBe(0.5);
    });

    it('should handle very small non-zero values', () => {
      const result = calculateOverallConfidence({
        amount: 0.01,
        currency: 0.01,
        business: 0.01,
        date: 0.01,
      });

      // (0.01 × 0.4) + (0.01 × 0.2) + (0.01 × 0.3) + (0.01 × 0.1)
      // = 0.004 + 0.002 + 0.003 + 0.001 = 0.01
      expect(result).toBe(0.01);
    });

    it('should handle values very close to 1.0', () => {
      const result = calculateOverallConfidence({
        amount: 0.99,
        currency: 0.99,
        business: 0.99,
        date: 0.99,
      });

      // (0.99 × 0.4) + (0.99 × 0.2) + (0.99 × 0.3) + (0.99 × 0.1)
      // = 0.396 + 0.198 + 0.297 + 0.099 = 0.99
      expect(result).toBe(0.99);
    });
  });

  describe('Validation - Missing Components', () => {
    it('should throw error when amount is null', () => {
      expect(() =>
        calculateOverallConfidence({
          amount: null as any,
          currency: 1.0,
          business: 1.0,
          date: 1.0,
        }),
      ).toThrow('Amount confidence is required');
    });

    it('should throw error when currency is null', () => {
      expect(() =>
        calculateOverallConfidence({
          amount: 1.0,
          currency: null as any,
          business: 1.0,
          date: 1.0,
        }),
      ).toThrow('Currency confidence is required');
    });

    it('should throw error when business is null', () => {
      expect(() =>
        calculateOverallConfidence({
          amount: 1.0,
          currency: 1.0,
          business: null as any,
          date: 1.0,
        }),
      ).toThrow('Business confidence is required');
    });

    it('should throw error when date is null', () => {
      expect(() =>
        calculateOverallConfidence({
          amount: 1.0,
          currency: 1.0,
          business: 1.0,
          date: null as any,
        }),
      ).toThrow('Date confidence is required');
    });

    it('should throw error when amount is undefined', () => {
      expect(() =>
        calculateOverallConfidence({
          amount: undefined as any,
          currency: 1.0,
          business: 1.0,
          date: 1.0,
        }),
      ).toThrow('Amount confidence is required');
    });

    it('should throw error when multiple components are null', () => {
      expect(() =>
        calculateOverallConfidence({
          amount: null as any,
          currency: null as any,
          business: 1.0,
          date: 1.0,
        }),
      ).toThrow('Amount confidence is required');
    });
  });

  describe('Validation - Out of Range', () => {
    it('should throw error when amount is negative', () => {
      expect(() =>
        calculateOverallConfidence({
          amount: -0.1,
          currency: 1.0,
          business: 1.0,
          date: 1.0,
        }),
      ).toThrow('Amount confidence must be between 0.0 and 1.0');
    });

    it('should throw error when amount exceeds 1.0', () => {
      expect(() =>
        calculateOverallConfidence({
          amount: 1.1,
          currency: 1.0,
          business: 1.0,
          date: 1.0,
        }),
      ).toThrow('Amount confidence must be between 0.0 and 1.0');
    });

    it('should throw error when currency is negative', () => {
      expect(() =>
        calculateOverallConfidence({
          amount: 1.0,
          currency: -0.5,
          business: 1.0,
          date: 1.0,
        }),
      ).toThrow('Currency confidence must be between 0.0 and 1.0');
    });

    it('should throw error when business exceeds 1.0', () => {
      expect(() =>
        calculateOverallConfidence({
          amount: 1.0,
          currency: 1.0,
          business: 2.0,
          date: 1.0,
        }),
      ).toThrow('Business confidence must be between 0.0 and 1.0');
    });

    it('should throw error when date is negative', () => {
      expect(() =>
        calculateOverallConfidence({
          amount: 1.0,
          currency: 1.0,
          business: 1.0,
          date: -1.0,
        }),
      ).toThrow('Date confidence must be between 0.0 and 1.0');
    });

    it('should throw error with correct component name', () => {
      expect(() =>
        calculateOverallConfidence({
          amount: 1.0,
          currency: 1.0,
          business: 5.0,
          date: 1.0,
        }),
      ).toThrow(/Business confidence/);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle typical invoice match', () => {
      // Exact amount, currency, business match, 2 days apart
      const result = calculateOverallConfidence({
        amount: 1.0,
        currency: 1.0,
        business: 1.0,
        date: 0.93, // ~2 days difference
      });

      // (1.0 × 0.4) + (1.0 × 0.2) + (1.0 × 0.3) + (0.93 × 0.1) = 0.993
      expect(result).toBe(0.99);
    });

    it('should handle receipt with missing business', () => {
      // Good amount/currency, no business ID, same day
      const result = calculateOverallConfidence({
        amount: 1.0,
        currency: 1.0,
        business: 0.5, // Unknown business
        date: 1.0,
      });

      // (1.0 × 0.4) + (1.0 × 0.2) + (0.5 × 0.3) + (1.0 × 0.1) = 0.85
      expect(result).toBe(0.85);
    });

    it('should handle cross-currency near match', () => {
      // Good amount, no currency match, good business/date
      const result = calculateOverallConfidence({
        amount: 0.9,
        currency: 0.0, // Different currency
        business: 1.0,
        date: 1.0,
      });

      // (0.9 × 0.4) + (0.0 × 0.2) + (1.0 × 0.3) + (1.0 × 0.1) = 0.76
      expect(result).toBe(0.76);
    });

    it('should handle delayed receipt (15 days)', () => {
      // Perfect match except date
      const result = calculateOverallConfidence({
        amount: 1.0,
        currency: 1.0,
        business: 1.0,
        date: 0.5, // 15 days difference
      });

      // (1.0 × 0.4) + (1.0 × 0.2) + (1.0 × 0.3) + (0.5 × 0.1) = 0.95
      expect(result).toBe(0.95);
    });
  });
});
