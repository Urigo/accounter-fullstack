import { describe, expect, it } from 'vitest';
import { calculateDateConfidence } from '../helpers/date-confidence.helper.js';

describe('calculateDateConfidence', () => {
  describe('same day', () => {
    it('should return 1.0 for identical dates', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const result = calculateDateConfidence(date, date);
      expect(result).toBe(1.0);
    });

    it('should return 1.0 for same day with different times', () => {
      const date1 = new Date('2024-01-15T08:00:00Z');
      const date2 = new Date('2024-01-15T18:30:00Z');
      const result = calculateDateConfidence(date1, date2);
      expect(result).toBe(1.0);
    });

    it('should return 1.0 for same day at different hours', () => {
      const date1 = new Date('2024-01-15T00:00:00');
      const date2 = new Date('2024-01-15T23:59:59');
      const result = calculateDateConfidence(date1, date2);
      expect(result).toBe(1.0);
    });
  });

  describe('specific day differences', () => {
    it('should return ~0.97 for 1 day difference', () => {
      const date1 = new Date('2024-01-15');
      const date2 = new Date('2024-01-16');
      const result = calculateDateConfidence(date1, date2);
      expect(result).toBeCloseTo(0.97, 2);
      expect(result).toBe(0.97);
    });

    it('should return ~0.77 for 7 days difference', () => {
      const date1 = new Date('2024-01-15');
      const date2 = new Date('2024-01-22');
      const result = calculateDateConfidence(date1, date2);
      expect(result).toBeCloseTo(0.77, 2);
      expect(result).toBe(0.77);
    });

    it('should return 0.5 for 15 days difference', () => {
      const date1 = new Date('2024-01-15');
      const date2 = new Date('2024-01-30');
      const result = calculateDateConfidence(date1, date2);
      expect(result).toBe(0.5);
    });

    it('should return ~0.03 for 29 days difference', () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-30');
      const result = calculateDateConfidence(date1, date2);
      expect(result).toBeCloseTo(0.03, 2);
      expect(result).toBe(0.03);
    });

    it('should return 0.0 for exactly 30 days difference', () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-31');
      const result = calculateDateConfidence(date1, date2);
      expect(result).toBe(0.0);
    });

    it('should return 0.0 for 100 days difference', () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-04-10');
      const result = calculateDateConfidence(date1, date2);
      expect(result).toBe(0.0);
    });

    it('should return 0.0 for 365 days difference', () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2025-01-01');
      const result = calculateDateConfidence(date1, date2);
      expect(result).toBe(0.0);
    });
  });

  describe('order independence', () => {
    it('should return same result regardless of parameter order', () => {
      const date1 = new Date('2024-01-15');
      const date2 = new Date('2024-01-25');

      const result1 = calculateDateConfidence(date1, date2);
      const result2 = calculateDateConfidence(date2, date1);

      expect(result1).toBe(result2);
    });

    it('should work with date2 before date1', () => {
      const date1 = new Date('2024-01-30');
      const date2 = new Date('2024-01-15');

      const result = calculateDateConfidence(date1, date2);
      expect(result).toBe(0.5);
    });

    it('should handle various orderings with same result', () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-08');

      expect(calculateDateConfidence(date1, date2)).toBe(
        calculateDateConfidence(date2, date1),
      );
    });
  });

  describe('linear degradation formula', () => {
    it('should follow linear formula: 1.0 - (days_diff / 30)', () => {
      const testCases = [
        { days: 0, expected: 1.0 },
        { days: 3, expected: 0.9 },
        { days: 6, expected: 0.8 },
        { days: 9, expected: 0.7 },
        { days: 12, expected: 0.6 },
        { days: 15, expected: 0.5 },
        { days: 18, expected: 0.4 },
        { days: 21, expected: 0.3 },
        { days: 24, expected: 0.2 },
        { days: 27, expected: 0.1 },
        { days: 30, expected: 0.0 },
      ];

      testCases.forEach(({ days, expected }) => {
        const date1 = new Date('2024-01-01');
        const date2 = new Date(date1);
        date2.setDate(date1.getDate() + days);

        const result = calculateDateConfidence(date1, date2);
        expect(result).toBe(expected);
      });
    });

    it('should verify degradation is proportional', () => {
      const date1 = new Date('2024-01-01');

      const result5Days = calculateDateConfidence(date1, new Date('2024-01-06'));
      const result10Days = calculateDateConfidence(date1, new Date('2024-01-11'));
      const result20Days = calculateDateConfidence(date1, new Date('2024-01-21'));

      // Verify the relationship: each 5 days reduces confidence by ~0.17
      expect(result5Days - result10Days).toBeCloseTo(0.16, 1);
      expect(result10Days - result20Days).toBeCloseTo(0.33, 1);
    });
  });

  describe('different time zones', () => {
    it('should handle dates with different time zones correctly', () => {
      // Same calendar day in different time zones
      const date1 = new Date('2024-01-15T23:00:00-05:00'); // Eastern time
      const date2 = new Date('2024-01-15T20:00:00-08:00'); // Pacific time
      const result = calculateDateConfidence(date1, date2);
      expect(result).toBe(1.0);
    });

    it('should calculate difference based on UTC calendar dates', () => {
      const date1 = new Date('2024-01-15T02:00:00+02:00');
      const date2 = new Date('2024-01-16T02:00:00+02:00');
      const result = calculateDateConfidence(date1, date2);
      expect(result).toBe(0.97);
    });
  });

  describe('leap years', () => {
    it('should handle leap year dates correctly', () => {
      const date1 = new Date('2024-02-28');
      const date2 = new Date('2024-02-29'); // Leap day
      const result = calculateDateConfidence(date1, date2);
      expect(result).toBe(0.97);
    });

    it('should calculate across leap day correctly', () => {
      const date1 = new Date('2024-02-15');
      const date2 = new Date('2024-03-16'); // 30 days later (leap year)
      const result = calculateDateConfidence(date1, date2);
      expect(result).toBe(0.0);
    });

    it('should handle non-leap year February', () => {
      const date1 = new Date('2023-02-01');
      const date2 = new Date('2023-03-03'); // 30 days later (non-leap year)
      const result = calculateDateConfidence(date1, date2);
      expect(result).toBe(0.0);
    });
  });

  describe('month boundaries', () => {
    it('should handle dates across month boundaries', () => {
      const date1 = new Date('2024-01-31');
      const date2 = new Date('2024-02-15');
      const result = calculateDateConfidence(date1, date2);
      expect(result).toBe(0.5);
    });

    it('should handle dates across year boundaries', () => {
      const date1 = new Date('2023-12-25');
      const date2 = new Date('2024-01-09');
      const result = calculateDateConfidence(date1, date2);
      expect(result).toBe(0.5);
    });
  });

  describe('edge cases', () => {
    it('should handle very old dates', () => {
      const date1 = new Date('1990-01-01');
      const date2 = new Date('1990-01-16');
      const result = calculateDateConfidence(date1, date2);
      expect(result).toBe(0.5);
    });

    it('should handle future dates', () => {
      const date1 = new Date('2030-06-15');
      const date2 = new Date('2030-06-30');
      const result = calculateDateConfidence(date1, date2);
      expect(result).toBe(0.5);
    });

    it('should handle dates at different times of day', () => {
      const date1 = new Date('2024-01-15T10:00:00');
      const date2 = new Date('2024-01-22T14:00:00');
      const result = calculateDateConfidence(date1, date2);
      expect(result).toBe(0.77);
    });
  });

  describe('precision and rounding', () => {
    it('should round to exactly 2 decimal places', () => {
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-02');
      const result = calculateDateConfidence(date1, date2);

      // Check that result has at most 2 decimal places
      expect(result.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(2);
    });

    it('should return values between 0.0 and 1.0', () => {
      const testDates = [
        [new Date('2024-01-01'), new Date('2024-01-01')], // 0 days
        [new Date('2024-01-01'), new Date('2024-01-11')], // 10 days
        [new Date('2024-01-01'), new Date('2024-01-21')], // 20 days
        [new Date('2024-01-01'), new Date('2024-02-01')], // 31 days
      ];

      testDates.forEach(([d1, d2]) => {
        const result = calculateDateConfidence(d1, d2);
        expect(result).toBeGreaterThanOrEqual(0.0);
        expect(result).toBeLessThanOrEqual(1.0);
      });
    });

    it('should handle fractional day calculations correctly', () => {
      // 2 days difference
      const date1 = new Date('2024-01-01');
      const date2 = new Date('2024-01-03');
      const result = calculateDateConfidence(date1, date2);

      // 1 - (2/30) = 1 - 0.0667 = 0.9333, rounded to 0.93
      expect(result).toBe(0.93);
    });
  });

  describe('return value validation', () => {
    it('should only return 0.0, 1.0, or values rounded to 2 decimals', () => {
      const results = [
        calculateDateConfidence(new Date('2024-01-01'), new Date('2024-01-01')), // 1.0
        calculateDateConfidence(new Date('2024-01-01'), new Date('2024-01-02')), // 0.97
        calculateDateConfidence(new Date('2024-01-01'), new Date('2024-01-16')), // 0.5
        calculateDateConfidence(new Date('2024-01-01'), new Date('2024-02-01')), // 0.0
      ];

      results.forEach(result => {
        const decimalPlaces = result.toString().split('.')[1]?.length || 0;
        expect(decimalPlaces).toBeLessThanOrEqual(2);
      });
    });

    it('should maintain consistency across multiple calls', () => {
      const date1 = new Date('2024-01-15');
      const date2 = new Date('2024-01-25');

      const result1 = calculateDateConfidence(date1, date2);
      const result2 = calculateDateConfidence(date1, date2);
      const result3 = calculateDateConfidence(date1, date2);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });
  });
});
