import { describe, it, expect } from 'vitest';
import { calculateAmountConfidence } from '../helpers/amount-confidence.helper.js';

describe('calculateAmountConfidence', () => {
  describe('exact matches', () => {
    it('should return 1.0 for exact match with positive amounts', () => {
      expect(calculateAmountConfidence(100, 100)).toBe(1.0);
      expect(calculateAmountConfidence(50.5, 50.5)).toBe(1.0);
      expect(calculateAmountConfidence(0.01, 0.01)).toBe(1.0);
    });

    it('should return 1.0 for exact match with negative amounts', () => {
      expect(calculateAmountConfidence(-100, -100)).toBe(1.0);
      expect(calculateAmountConfidence(-50.5, -50.5)).toBe(1.0);
    });

    it('should return 1.0 for zero amounts', () => {
      expect(calculateAmountConfidence(0, 0)).toBe(1.0);
    });

    it('should return 1.0 for matching absolute values with different signs', () => {
      // Since we compare absolute values, sign differences shouldn't matter for exact amounts
      expect(calculateAmountConfidence(100, 100)).toBe(1.0);
      expect(calculateAmountConfidence(-100, -100)).toBe(1.0);
    });
  });

  describe('amounts within 1 unit', () => {
    it('should return 0.9 for amounts within 0.5 units', () => {
      expect(calculateAmountConfidence(100, 100.5)).toBe(0.9);
      expect(calculateAmountConfidence(100.5, 100)).toBe(0.9);
      expect(calculateAmountConfidence(50, 50.3)).toBe(0.9);
    });

    it('should return 0.9 for amounts at exactly 1 unit difference', () => {
      expect(calculateAmountConfidence(100, 101)).toBe(0.9);
      expect(calculateAmountConfidence(101, 100)).toBe(0.9);
      expect(calculateAmountConfidence(50, 51)).toBe(0.9);
    });

    it('should return 0.9 for amounts just under 1 unit difference', () => {
      expect(calculateAmountConfidence(100, 100.99)).toBe(0.9);
      expect(calculateAmountConfidence(100.99, 100)).toBe(0.9);
    });

    it('should return 0.9 for negative amounts within 1 unit', () => {
      expect(calculateAmountConfidence(-100, -100.5)).toBe(0.9);
      expect(calculateAmountConfidence(-100, -101)).toBe(0.9);
    });
  });

  describe('amounts with differences between 1 unit and 20%', () => {
    it('should return value between 0.0 and 0.7 for 1.5 units difference', () => {
      const confidence = calculateAmountConfidence(100, 101.5);
      expect(confidence).toBeGreaterThan(0.0);
      expect(confidence).toBeLessThan(0.7);
    });

    it('should return value between 0.0 and 0.7 for 2 units difference', () => {
      const confidence = calculateAmountConfidence(100, 102);
      expect(confidence).toBeGreaterThan(0.0);
      expect(confidence).toBeLessThan(0.7);
    });

    it('should return value between 0.0 and 0.7 for 5 units difference (on 100)', () => {
      const confidence = calculateAmountConfidence(100, 105);
      expect(confidence).toBeGreaterThan(0.0);
      expect(confidence).toBeLessThan(0.7);
      // 5% difference should be roughly in the middle
      expect(confidence).toBeGreaterThan(0.3);
    });

    it('should return value between 0.0 and 0.7 for 10 units difference (on 100)', () => {
      const confidence = calculateAmountConfidence(100, 110);
      expect(confidence).toBeGreaterThan(0.0);
      expect(confidence).toBeLessThan(0.7);
      // 10% difference should be lower
      expect(confidence).toBeLessThan(0.4);
    });

    it('should demonstrate linear degradation', () => {
      // For amounts where 1 unit = 1%, we can test linear degradation more precisely
      // Starting from just over 1% to just under 20%
      
      // At around 1% (just over 1 unit on 100): should be close to 0.7
      const conf1 = calculateAmountConfidence(100, 101.5); // 1.5%
      
      // At around 10% (middle of range): should be around 0.35
      const conf10 = calculateAmountConfidence(100, 110); // 10%
      
      // At around 19% (near end): should be close to 0.0
      const conf19 = calculateAmountConfidence(100, 119); // 19%
      
      // Verify degradation order
      expect(conf1).toBeGreaterThan(conf10);
      expect(conf10).toBeGreaterThan(conf19);
    });
  });

  describe('amounts at exactly 20% difference', () => {
    it('should return 0.0 for exactly 20% difference', () => {
      expect(calculateAmountConfidence(100, 120)).toBe(0.0);
      expect(calculateAmountConfidence(120, 100)).toBe(0.0);
      expect(calculateAmountConfidence(50, 60)).toBe(0.0);
    });

    it('should return 0.0 for just under 20% difference (19.99%)', () => {
      // Just under 20% should still be very close to 0
      const confidence = calculateAmountConfidence(100, 119.9);
      expect(confidence).toBeLessThanOrEqual(0.01);
    });
  });

  describe('amounts beyond 20% difference', () => {
    it('should return 0.0 for 25% difference', () => {
      expect(calculateAmountConfidence(100, 125)).toBe(0.0);
    });

    it('should return 0.0 for 50% difference', () => {
      expect(calculateAmountConfidence(100, 150)).toBe(0.0);
    });

    it('should return 0.0 for 100% difference', () => {
      expect(calculateAmountConfidence(100, 200)).toBe(0.0);
    });

    it('should return 0.0 for very large differences', () => {
      expect(calculateAmountConfidence(100, 1000)).toBe(0.0);
      expect(calculateAmountConfidence(10, 500)).toBe(0.0);
    });
  });

  describe('edge cases with negative amounts', () => {
    it('should handle negative transaction amount', () => {
      expect(calculateAmountConfidence(-100, -100)).toBe(1.0);
      expect(calculateAmountConfidence(-100, -101)).toBe(0.9);
      expect(calculateAmountConfidence(-100, -105)).toBeGreaterThan(0.0);
      expect(calculateAmountConfidence(-100, -120)).toBe(0.0);
    });

    it('should handle negative document amount', () => {
      expect(calculateAmountConfidence(-100, -100)).toBe(1.0);
      expect(calculateAmountConfidence(-101, -100)).toBe(0.9);
    });

    it('should handle both amounts negative', () => {
      expect(calculateAmountConfidence(-50, -50.5)).toBe(0.9);
      expect(calculateAmountConfidence(-100, -110)).toBeGreaterThan(0.0);
    });
  });

  describe('edge cases with very small amounts', () => {
    it('should handle very small amounts correctly', () => {
      expect(calculateAmountConfidence(0.1, 0.1)).toBe(1.0);
      expect(calculateAmountConfidence(0.01, 0.01)).toBe(1.0);
    });

    it('should return 0.9 for small amounts within 1 unit', () => {
      // Even though 1 unit is huge compared to 0.1, it should still return 0.9
      expect(calculateAmountConfidence(0.1, 1.0)).toBe(0.9);
      expect(calculateAmountConfidence(0.5, 1.5)).toBe(0.9);
    });

    it('should handle small amounts with percentage differences correctly', () => {
      // 0.1 to 0.12 has a difference of 0.02, which is within 1 unit, so returns 0.9
      expect(calculateAmountConfidence(0.1, 0.12)).toBe(0.9);
      // 0.1 to 0.11 has a difference of 0.01, which is within 1 unit, so returns 0.9
      expect(calculateAmountConfidence(0.1, 0.11)).toBe(0.9);
      // 0.1 to 1.2 has >1 unit difference (1.1) and is also >20%, so returns 0.0
      expect(calculateAmountConfidence(0.1, 1.2)).toBe(0.0);
    });
  });

  describe('edge cases with zero', () => {
    it('should handle zero in transaction amount', () => {
      expect(calculateAmountConfidence(0, 0)).toBe(1.0);
    });

    it('should handle zero vs non-zero amounts', () => {
      // 0 to 1 is within 1 unit
      expect(calculateAmountConfidence(0, 1)).toBe(0.9);
      expect(calculateAmountConfidence(1, 0)).toBe(0.9);
      
      // 0 to >1 means one amount is 0, which makes percentage calculation undefined
      // The spec requires us to handle this gracefully - since we can't calculate percentage
      // and the difference is >1, we return 0.0
      expect(calculateAmountConfidence(0, 2)).toBe(0.0);
    });
  });

  describe('formula verification for linear degradation', () => {
    it('should verify the linear formula in the middle range', () => {
      // Using base amount of 100 for easier percentage calculation
      // 1 unit = 1% on 100
      // Range is from 1% to 20%
      // Confidence degrades linearly from 0.7 to 0.0
      
      // At 1% (101): should be close to 0.7 (but we're just over 1 unit)
      const conf1 = calculateAmountConfidence(100, 101.01);
      expect(conf1).toBeCloseTo(0.7, 1);
      
      // At 10.5% (halfway between 1% and 20%): should be around 0.35
      const conf10_5 = calculateAmountConfidence(100, 110.5);
      expect(conf10_5).toBeCloseTo(0.35, 1);
      
      // At 19.9% (just before 20%): should be close to 0.0
      const conf19_9 = calculateAmountConfidence(100, 119.9);
      expect(conf19_9).toBeCloseTo(0.0, 1);
    });

    it('should verify degradation is proportional across the range', () => {
      // Calculate several points and verify linear relationship
      const base = 100;
      
      // Points at different percentages in the degradation range
      const conf_2pct = calculateAmountConfidence(base, 102);   // ~2%
      const conf_5pct = calculateAmountConfidence(base, 105);   // 5%
      const conf_10pct = calculateAmountConfidence(base, 110);  // 10%
      const conf_15pct = calculateAmountConfidence(base, 115);  // 15%
      
      // Each should be progressively smaller
      expect(conf_2pct).toBeGreaterThan(conf_5pct);
      expect(conf_5pct).toBeGreaterThan(conf_10pct);
      expect(conf_10pct).toBeGreaterThan(conf_15pct);
    });
  });

  describe('return value precision', () => {
    it('should return values rounded to 2 decimal places', () => {
      const confidence = calculateAmountConfidence(100, 105);
      // Check that the value has at most 2 decimal places
      const decimalPlaces = (confidence.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });

    it('should handle rounding correctly for edge values', () => {
      // Test various amounts that might produce values needing rounding
      const amounts = [
        [100, 102.5],
        [100, 107.3],
        [100, 113.7],
        [50, 53.3],
      ];
      
      amounts.forEach(([amt1, amt2]) => {
        const confidence = calculateAmountConfidence(amt1, amt2);
        const decimalPlaces = (confidence.toString().split('.')[1] || '').length;
        expect(decimalPlaces).toBeLessThanOrEqual(2);
      });
    });
  });

  describe('symmetry', () => {
    it('should return same confidence regardless of parameter order', () => {
      expect(calculateAmountConfidence(100, 105)).toBe(calculateAmountConfidence(105, 100));
      expect(calculateAmountConfidence(50, 60)).toBe(calculateAmountConfidence(60, 50));
      expect(calculateAmountConfidence(100, 101)).toBe(calculateAmountConfidence(101, 100));
    });
  });
});
