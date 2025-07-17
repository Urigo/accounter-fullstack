import { describe, expect, it } from 'vitest';
import { encodeFixedWidth, formatField } from '../../src/generator/format/encoder';

describe('Encoder utilities', () => {
  describe('formatField', () => {
    it('should left-align by default with space padding', () => {
      expect(formatField('test', 8, 'left')).toBe('test    ');
      expect(formatField('hello', 10, 'left')).toBe('hello     ');
    });

    it('should right-align with space padding', () => {
      expect(formatField('test', 8, 'right')).toBe('    test');
      expect(formatField('hello', 10, 'right')).toBe('     hello');
    });

    it('should use custom padding character for left alignment', () => {
      expect(formatField('123', 6, 'left', '0')).toBe('123000');
      expect(formatField('abc', 5, 'left', '-')).toBe('abc--');
    });

    it('should use custom padding character for right alignment', () => {
      expect(formatField('123', 6, 'right', '0')).toBe('000123');
      expect(formatField('abc', 5, 'right', '-')).toBe('--abc');
    });

    it('should truncate if value is longer than width', () => {
      expect(formatField('verylongstring', 5, 'left')).toBe('veryl');
      expect(formatField('verylongstring', 5, 'right')).toBe('veryl');
    });

    it('should handle empty string', () => {
      expect(formatField('', 3, 'left')).toBe('   ');
      expect(formatField('', 3, 'right')).toBe('   ');
      expect(formatField('', 3, 'left', 'x')).toBe('xxx');
      expect(formatField('', 3, 'right', 'x')).toBe('xxx');
    });

    it('should handle zero width', () => {
      expect(formatField('test', 0, 'left')).toBe('');
      expect(formatField('test', 0, 'right')).toBe('');
    });
  });

  describe('encodeFixedWidth', () => {
    it('should encode string values with left alignment by default', () => {
      expect(encodeFixedWidth('test', 8)).toBe('test    ');
      expect(encodeFixedWidth('hello', 10)).toBe('hello     ');
    });

    it('should encode number values', () => {
      expect(encodeFixedWidth(123, 6)).toBe('123   ');
      expect(encodeFixedWidth(45.67, 8)).toBe('45.67   ');
    });

    it('should support right alignment', () => {
      expect(encodeFixedWidth('test', 8, ' ', 'right')).toBe('    test');
      expect(encodeFixedWidth(123, 6, ' ', 'right')).toBe('   123');
    });

    it('should support custom padding characters', () => {
      expect(encodeFixedWidth('123', 6, '0')).toBe('123000');
      expect(encodeFixedWidth('123', 6, '0', 'right')).toBe('000123');
    });

    it('should handle boolean values', () => {
      expect(encodeFixedWidth('true', 6)).toBe('true  ');
      expect(encodeFixedWidth('false', 6)).toBe('false ');
    });

    it('should handle special string values', () => {
      expect(encodeFixedWidth('null', 6)).toBe('null  ');
      expect(encodeFixedWidth('undefined', 10)).toBe('undefined ');
    });

    it('should truncate long values', () => {
      expect(encodeFixedWidth('verylongstring', 5)).toBe('veryl');
      expect(encodeFixedWidth(1_234_567, 4)).toBe('1234');
    });
  });
});
