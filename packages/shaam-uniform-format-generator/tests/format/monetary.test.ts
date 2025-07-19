/**
 * Tests for monetary amount formatting utilities
 */

import { describe, expect, it } from 'vitest';
import {
  formatMonetaryAmount,
  formatOptionalMonetaryAmount,
  parseMonetaryAmount,
  parseOptionalMonetaryAmount,
} from '../../src/generator/format/monetary';

describe('Monetary Amount Formatting', () => {
  describe('formatMonetaryAmount', () => {
    it('should format positive amounts correctly', () => {
      expect(formatMonetaryAmount(12.4)).toBe('+00000000001240');
      expect(formatMonetaryAmount(1_234_567_890.99)).toBe('+00123456789099');
      expect(formatMonetaryAmount(0.01)).toBe('+00000000000001');
      expect(formatMonetaryAmount(0.99)).toBe('+00000000000099');
      expect(formatMonetaryAmount(1)).toBe('+00000000000100');
    });

    it('should format negative amounts correctly', () => {
      expect(formatMonetaryAmount(-12.4)).toBe('-00000000001240');
      expect(formatMonetaryAmount(-1_234_567_890.99)).toBe('-00123456789099');
      expect(formatMonetaryAmount(-0.01)).toBe('-00000000000001');
      expect(formatMonetaryAmount(-0.99)).toBe('-00000000000099');
      expect(formatMonetaryAmount(-1)).toBe('-00000000000100');
    });

    it('should format zero correctly', () => {
      expect(formatMonetaryAmount(0)).toBe('+00000000000000');
      expect(formatMonetaryAmount(-0)).toBe('+00000000000000');
    });

    it('should handle floating point precision correctly', () => {
      expect(formatMonetaryAmount(0.1 + 0.2)).toBe('+00000000000030'); // 0.3
      expect(formatMonetaryAmount(1.005)).toBe('+00000000000100'); // Should round to 1.00 (not 1.01)
    });

    it('should return exactly 15 characters', () => {
      expect(formatMonetaryAmount(12.4)).toHaveLength(15);
      expect(formatMonetaryAmount(-12.4)).toHaveLength(15);
      expect(formatMonetaryAmount(0)).toHaveLength(15);
      expect(formatMonetaryAmount(1_234_567_890.99)).toHaveLength(15);
    });
  });

  describe('parseMonetaryAmount', () => {
    it('should parse positive amounts correctly', () => {
      expect(parseMonetaryAmount('+00000000001240')).toBe(12.4);
      expect(parseMonetaryAmount('+00123456789099')).toBe(1_234_567_890.99);
      expect(parseMonetaryAmount('+00000000000001')).toBe(0.01);
      expect(parseMonetaryAmount('+00000000000099')).toBe(0.99);
      expect(parseMonetaryAmount('+00000000000100')).toBe(1);
    });

    it('should parse negative amounts correctly', () => {
      expect(parseMonetaryAmount('-00000000001240')).toBe(-12.4);
      expect(parseMonetaryAmount('-00123456789099')).toBe(-1_234_567_890.99);
      expect(parseMonetaryAmount('-00000000000001')).toBe(-0.01);
      expect(parseMonetaryAmount('-00000000000099')).toBe(-0.99);
      expect(parseMonetaryAmount('-00000000000100')).toBe(-1);
    });

    it('should parse zero correctly', () => {
      expect(parseMonetaryAmount('+00000000000000')).toBe(0);
      expect(parseMonetaryAmount('-00000000000000')).toBe(0); // -0 should be 0
    });

    it('should throw on invalid input length', () => {
      expect(() => parseMonetaryAmount('123')).toThrow(
        'Invalid monetary string: expected 15 characters',
      );
      expect(() => parseMonetaryAmount('+0000000000124')).toThrow(
        'Invalid monetary string: expected 15 characters',
      );
      expect(() => parseMonetaryAmount('')).toThrow(
        'Invalid monetary string: expected 15 characters',
      );
    });

    it('should throw on invalid sign', () => {
      expect(() => parseMonetaryAmount('000000000001240')).toThrow(
        'Invalid monetary string: first character must be + or -',
      );
      expect(() => parseMonetaryAmount('X00000000001240')).toThrow(
        'Invalid monetary string: first character must be + or -',
      );
    });

    it('should throw on non-digit characters', () => {
      expect(() => parseMonetaryAmount('+0000000000124X')).toThrow(
        'Invalid monetary string: last 14 characters must be digits',
      );
      expect(() => parseMonetaryAmount('+ABCDEFGHIJKLMN')).toThrow(
        'Invalid monetary string: last 14 characters must be digits',
      );
    });
  });

  describe('round-trip conversion', () => {
    it('should maintain data integrity through format/parse cycle', () => {
      const testValues = [0, 12.4, -12.4, 0.01, -0.01, 1_234_567_890.99, -1_234_567_890.99];

      for (const value of testValues) {
        const formatted = formatMonetaryAmount(value);
        const parsed = parseMonetaryAmount(formatted);
        expect(parsed).toBe(value);
      }
    });
  });

  describe('formatOptionalMonetaryAmount', () => {
    it('should format defined values', () => {
      expect(formatOptionalMonetaryAmount(12.4)).toBe('+00000000001240');
      expect(formatOptionalMonetaryAmount(-12.4)).toBe('-00000000001240');
      expect(formatOptionalMonetaryAmount(0)).toBe('+00000000000000');
    });

    it('should return empty string for undefined/null values', () => {
      expect(formatOptionalMonetaryAmount(undefined)).toBe('');
      expect(formatOptionalMonetaryAmount(null)).toBe('');
    });
  });

  describe('parseOptionalMonetaryAmount', () => {
    it('should parse valid strings', () => {
      expect(parseOptionalMonetaryAmount('+00000000001240')).toBe(12.4);
      expect(parseOptionalMonetaryAmount('-00000000001240')).toBe(-12.4);
      expect(parseOptionalMonetaryAmount('+00000000000000')).toBe(0);
    });

    it('should return undefined for empty strings', () => {
      expect(parseOptionalMonetaryAmount('')).toBeUndefined();
      expect(parseOptionalMonetaryAmount('   ')).toBeUndefined();
    });

    it('should throw on invalid strings', () => {
      expect(() => parseOptionalMonetaryAmount('invalid')).toThrow();
    });
  });
});
