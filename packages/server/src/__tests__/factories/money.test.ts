import { describe, it, expect } from 'vitest';
import { formatNumeric, formatMoney, formatDecimal, parseNumeric } from './money.js';

describe('Factory Helpers: Money', () => {
  describe('formatNumeric', () => {
    it('should format positive integers', () => {
      expect(formatNumeric(100)).toBe('100');
      expect(formatNumeric(42)).toBe('42');
    });

    it('should format negative integers', () => {
      expect(formatNumeric(-100)).toBe('-100');
      expect(formatNumeric(-42)).toBe('-42');
    });

    it('should format positive decimals', () => {
      expect(formatNumeric(100.5)).toBe('100.5');
      expect(formatNumeric(42.99)).toBe('42.99');
    });

    it('should format negative decimals', () => {
      expect(formatNumeric(-100.5)).toBe('-100.5');
      expect(formatNumeric(-42.99)).toBe('-42.99');
    });

    it('should format zero', () => {
      expect(formatNumeric(0)).toBe('0');
      expect(formatNumeric(-0)).toBe('0');
    });

    it('should accept string inputs', () => {
      expect(formatNumeric('100')).toBe('100');
      expect(formatNumeric('100.50')).toBe('100.50');
      expect(formatNumeric('-42.99')).toBe('-42.99');
    });

    it('should trim whitespace from string inputs', () => {
      expect(formatNumeric('  100  ')).toBe('100');
      expect(formatNumeric('  -42.99  ')).toBe('-42.99');
    });

    it('should throw on invalid string input', () => {
      expect(() => formatNumeric('abc')).toThrow('Invalid numeric string');
      expect(() => formatNumeric('12.34.56')).toThrow('Invalid numeric string');
      expect(() => formatNumeric('')).toThrow('Invalid numeric string');
    });

    it('should throw on NaN', () => {
      expect(() => formatNumeric(NaN)).toThrow('Invalid numeric value');
    });

    it('should throw on Infinity', () => {
      expect(() => formatNumeric(Infinity)).toThrow('Invalid numeric value');
      expect(() => formatNumeric(-Infinity)).toThrow('Invalid numeric value');
    });

    it('should preserve precision', () => {
      expect(formatNumeric(123.456789)).toBe('123.456789');
      expect(formatNumeric('999.123456789')).toBe('999.123456789');
    });
  });

  describe('formatMoney', () => {
    it('should format money amounts', () => {
      expect(formatMoney(10050)).toBe('10050');
      expect(formatMoney(-2599)).toBe('-2599');
    });

    it('should accept string inputs', () => {
      expect(formatMoney('10050')).toBe('10050');
      expect(formatMoney('-2599')).toBe('-2599');
    });

    it('should handle zero', () => {
      expect(formatMoney(0)).toBe('0');
    });

    it('should handle large amounts', () => {
      expect(formatMoney(1000000)).toBe('1000000');
      expect(formatMoney('999999999')).toBe('999999999');
    });
  });

  describe('formatDecimal', () => {
    it('should format with default 2 decimals', () => {
      expect(formatDecimal(100.5)).toBe('100.50');
      expect(formatDecimal(42)).toBe('42.00');
    });

    it('should format with custom decimals', () => {
      expect(formatDecimal(100.5, 0)).toBe('101');
      expect(formatDecimal(100.5, 1)).toBe('100.5');
      expect(formatDecimal(100.5, 3)).toBe('100.500');
    });

    it('should round when necessary', () => {
      expect(formatDecimal(42.123456, 2)).toBe('42.12');
      expect(formatDecimal(42.126, 2)).toBe('42.13');
    });

    it('should handle negative numbers', () => {
      expect(formatDecimal(-100.5, 2)).toBe('-100.50');
      expect(formatDecimal(-42.99, 1)).toBe('-43.0');
    });

    it('should handle zero decimals', () => {
      expect(formatDecimal(100.5, 0)).toBe('101');
      expect(formatDecimal(100.4, 0)).toBe('100');
    });

    it('should throw on invalid decimals parameter', () => {
      expect(() => formatDecimal(100, -1)).toThrow('Invalid decimals');
      expect(() => formatDecimal(100, 1.5)).toThrow('Invalid decimals');
    });

    it('should throw on invalid amount', () => {
      expect(() => formatDecimal(NaN, 2)).toThrow('Invalid decimal amount');
      expect(() => formatDecimal(Infinity, 2)).toThrow('Invalid decimal amount');
    });

    it('should handle large decimal places', () => {
      expect(formatDecimal(1.23456789, 8)).toBe('1.23456789');
    });
  });

  describe('parseNumeric', () => {
    it('should parse integer strings', () => {
      expect(parseNumeric('100')).toBe(100);
      expect(parseNumeric('-42')).toBe(-42);
    });

    it('should parse decimal strings', () => {
      expect(parseNumeric('100.50')).toBe(100.5);
      expect(parseNumeric('-42.99')).toBe(-42.99);
    });

    it('should parse zero', () => {
      expect(parseNumeric('0')).toBe(0);
      // -0 is normalized to +0
      expect(parseNumeric('-0')).toBe(0);
    });

    it('should throw on invalid strings', () => {
      expect(() => parseNumeric('abc')).toThrow('Cannot parse numeric value');
      expect(() => parseNumeric('')).toThrow('Cannot parse numeric value');
      expect(() => parseNumeric('12.34.56')).toThrow('Cannot parse numeric value');
    });

    it('should parse scientific notation', () => {
      expect(parseNumeric('1e3')).toBe(1000);
      expect(parseNumeric('1.5e2')).toBe(150);
    });

    it('should handle whitespace', () => {
      expect(parseNumeric('  100  ')).toBe(100);
    });
  });

  describe('round-trip conversion', () => {
    it('should preserve values through format and parse', () => {
      const testValues = [0, 100, -42, 100.5, -42.99, 1234.56789];

      testValues.forEach(value => {
        const formatted = formatNumeric(value);
        const parsed = parseNumeric(formatted);
        expect(parsed).toBe(value);
      });
    });

    it('should preserve string precision', () => {
      const value = '123.456789';
      const formatted = formatNumeric(value);
      expect(formatted).toBe(value);
    });
  });
});
