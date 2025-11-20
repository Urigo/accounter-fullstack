import { describe, it, expect } from 'vitest';
import { iso, isoToday, addDays } from './dates.js';

describe('Factory Helpers: Dates', () => {
  describe('iso', () => {
    it('should parse date-only string as UTC midnight', () => {
      const date = iso('2024-01-15');
      expect(date.toISOString()).toBe('2024-01-15T00:00:00.000Z');
    });

    it('should parse full ISO timestamp', () => {
      const date = iso('2024-01-15T14:30:00.000Z');
      expect(date.toISOString()).toBe('2024-01-15T14:30:00.000Z');
    });

    it('should parse ISO timestamp with timezone offset', () => {
      const date = iso('2024-01-15T14:30:00+02:00');
      expect(date.toISOString()).toBe('2024-01-15T12:30:00.000Z');
    });

    it('should throw on empty string', () => {
      expect(() => iso('')).toThrow('Invalid date string');
    });

    it('should throw on invalid date', () => {
      expect(() => iso('not-a-date')).toThrow('Invalid date string');
    });

    it('should throw on null/undefined', () => {
      expect(() => iso(null as any)).toThrow('Invalid date string');
      expect(() => iso(undefined as any)).toThrow('Invalid date string');
    });

    it('should throw on invalid date format', () => {
      expect(() => iso('2024-13-01')).toThrow('Invalid date string');
      expect(() => iso('2024-01-32')).toThrow('Invalid date string');
    });

    it('should handle leap year dates', () => {
      const date = iso('2024-02-29');
      expect(date.toISOString()).toBe('2024-02-29T00:00:00.000Z');
    });

    it('should throw on invalid leap year date', () => {
      expect(() => iso('2023-02-29')).toThrow('Invalid date string');
    });

    it('should parse various valid date formats', () => {
      const dates = [
        '2024-01-01',
        '2024-12-31',
        '2024-06-15T12:00:00Z',
        '2024-06-15T12:00:00.123Z',
      ];

      dates.forEach(dateStr => {
        const date = iso(dateStr);
        expect(date).toBeInstanceOf(Date);
        expect(date.getTime()).not.toBeNaN();
      });
    });
  });

  describe('isoToday', () => {
    it('should return date in YYYY-MM-DD format', () => {
      const today = isoToday();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should return a valid date string', () => {
      const today = isoToday();
      const date = iso(today);
      expect(date).toBeInstanceOf(Date);
    });

    it('should be consistent within same millisecond', () => {
      const today1 = isoToday();
      const today2 = isoToday();
      expect(today1).toBe(today2);
    });
  });

  describe('addDays', () => {
    it('should add positive days', () => {
      const tomorrow = addDays('2024-01-15', 1);
      expect(tomorrow).toBe('2024-01-16');
    });

    it('should add negative days', () => {
      const yesterday = addDays('2024-01-15', -1);
      expect(yesterday).toBe('2024-01-14');
    });

    it('should handle month boundaries', () => {
      const nextMonth = addDays('2024-01-31', 1);
      expect(nextMonth).toBe('2024-02-01');
    });

    it('should handle year boundaries', () => {
      const nextYear = addDays('2024-12-31', 1);
      expect(nextYear).toBe('2025-01-01');
    });

    it('should handle leap year', () => {
      const afterLeapDay = addDays('2024-02-28', 1);
      expect(afterLeapDay).toBe('2024-02-29');
    });

    it('should handle adding zero days', () => {
      const same = addDays('2024-01-15', 0);
      expect(same).toBe('2024-01-15');
    });

    it('should handle adding multiple days', () => {
      const future = addDays('2024-01-15', 30);
      expect(future).toBe('2024-02-14');
    });

    it('should handle subtracting multiple days', () => {
      const past = addDays('2024-02-14', -30);
      expect(past).toBe('2024-01-15');
    });

    it('should throw on invalid date string', () => {
      expect(() => addDays('invalid', 1)).toThrow('Invalid date string');
    });
  });
});
