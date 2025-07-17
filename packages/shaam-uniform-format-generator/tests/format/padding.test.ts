import { describe, expect, it } from 'vitest';
import { padLeft, padRight } from '../../src/format/padding';

describe('Padding utilities', () => {
  describe('padLeft', () => {
    it('should pad string on the left with spaces by default', () => {
      expect(padLeft('test', 8)).toBe('    test');
      expect(padLeft('hello', 10)).toBe('     hello');
    });

    it('should pad string on the left with custom character', () => {
      expect(padLeft('123', 6, '0')).toBe('000123');
      expect(padLeft('abc', 5, '-')).toBe('--abc');
    });

    it('should truncate string if longer than width', () => {
      expect(padLeft('verylongstring', 5)).toBe('veryl');
      expect(padLeft('truncated', 4)).toBe('trun');
    });

    it('should return original string if same length as width', () => {
      expect(padLeft('exact', 5)).toBe('exact');
    });

    it('should handle empty string', () => {
      expect(padLeft('', 3)).toBe('   ');
      expect(padLeft('', 3, 'x')).toBe('xxx');
    });

    it('should handle zero width', () => {
      expect(padLeft('test', 0)).toBe('');
    });

    it('should handle single character', () => {
      expect(padLeft('a', 5)).toBe('    a');
      expect(padLeft('a', 5, '0')).toBe('0000a');
    });
  });

  describe('padRight', () => {
    it('should pad string on the right with spaces by default', () => {
      expect(padRight('test', 8)).toBe('test    ');
      expect(padRight('hello', 10)).toBe('hello     ');
    });

    it('should pad string on the right with custom character', () => {
      expect(padRight('123', 6, '0')).toBe('123000');
      expect(padRight('abc', 5, '-')).toBe('abc--');
    });

    it('should truncate string if longer than width', () => {
      expect(padRight('verylongstring', 5)).toBe('veryl');
      expect(padRight('truncated', 4)).toBe('trun');
    });

    it('should return original string if same length as width', () => {
      expect(padRight('exact', 5)).toBe('exact');
    });

    it('should handle empty string', () => {
      expect(padRight('', 3)).toBe('   ');
      expect(padRight('', 3, 'x')).toBe('xxx');
    });

    it('should handle zero width', () => {
      expect(padRight('test', 0)).toBe('');
    });

    it('should handle single character', () => {
      expect(padRight('a', 5)).toBe('a    ');
      expect(padRight('a', 5, '0')).toBe('a0000');
    });
  });
});
