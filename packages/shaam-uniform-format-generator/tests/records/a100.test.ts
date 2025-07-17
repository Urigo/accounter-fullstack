import { describe, expect, it } from 'vitest';
import { A100Schema, encodeA100, parseA100, type A100 } from '../../src/generator/records/a100';

describe('A100 Record', () => {
  const validA100: A100 = {
    code: 'A100',
    recordNumber: '1',
    vatId: '123456789',
    primaryIdentifier: '12345678901234',
    systemConstant: '&OF1.31&',
    reserved: '',
  };

  describe('A100Schema validation', () => {
    it('should validate a complete A100 record', () => {
      expect(() => A100Schema.parse(validA100)).not.toThrow();
    });

    it('should require code to be exactly "A100"', () => {
      expect(() => A100Schema.parse({ ...validA100, code: 'A10' })).toThrow();
      expect(() => A100Schema.parse({ ...validA100, code: 'A1000' })).toThrow();
      expect(() => A100Schema.parse({ ...validA100, code: 'B100' })).toThrow();
    });

    it('should require non-empty recordNumber', () => {
      expect(() => A100Schema.parse({ ...validA100, recordNumber: '' })).toThrow();
    });

    it('should require non-empty vatId', () => {
      expect(() => A100Schema.parse({ ...validA100, vatId: '' })).toThrow();
    });

    it('should require non-empty primaryIdentifier', () => {
      expect(() => A100Schema.parse({ ...validA100, primaryIdentifier: '' })).toThrow();
    });

    it('should allow empty reserved field', () => {
      const valid = { ...validA100, reserved: '' };
      expect(() => A100Schema.parse(valid)).not.toThrow();
    });

    it('should enforce maximum field lengths', () => {
      expect(() => A100Schema.parse({ ...validA100, recordNumber: '1234567890' })).toThrow();
      expect(() => A100Schema.parse({ ...validA100, vatId: '1234567890' })).toThrow();
      expect(() =>
        A100Schema.parse({ ...validA100, primaryIdentifier: '1234567890123456' }),
      ).toThrow();
      expect(() => A100Schema.parse({ ...validA100, reserved: 'x'.repeat(51) })).toThrow();
    });
  });

  describe('encodeA100', () => {
    it('should encode a valid A100 record to fixed-width format', () => {
      const encoded = encodeA100(validA100);

      // Should end with CRLF
      expect(encoded).toMatch(/\r\n$/);

      // Remove CRLF for length check
      const withoutCrlf = encoded.replace(/\r\n$/, '');
      expect(withoutCrlf).toHaveLength(95);

      // Check specific field positions
      expect(withoutCrlf.slice(0, 4)).toBe('A100'); // Record code
      expect(withoutCrlf.slice(4, 13)).toBe('000000001'); // Zero-padded record number (numeric field)
      expect(withoutCrlf.slice(13, 22)).toBe('123456789'); // Zero-padded VAT ID (already 9 digits)
      expect(withoutCrlf.slice(22, 37)).toBe('012345678901234'); // Zero-padded primary identifier (numeric field)
      expect(withoutCrlf.slice(37, 45)).toBe('&OF1.31&'); // System constant
    });

    it('should handle long fields by truncating', () => {
      const longFields: A100 = {
        ...validA100,
        vatId: '1234567890', // Too long for 9 chars
        primaryIdentifier: '1234567890123456', // Too long for 15 chars
      };

      const encoded = encodeA100(longFields);
      const withoutCrlf = encoded.replace(/\r\n$/, '');

      // Should still be exactly 95 characters
      expect(withoutCrlf).toHaveLength(95);

      // VAT ID should be truncated to 9 chars and zero-padded
      expect(withoutCrlf.slice(13, 22)).toBe('123456789');

      // Primary identifier should be truncated to 15 chars and zero-padded
      expect(withoutCrlf.slice(22, 37)).toBe('123456789012345');

      // System constant should always be the constant
      expect(withoutCrlf.slice(37, 45)).toBe('&OF1.31&');
    });

    it('should pad short fields correctly', () => {
      const shortFields: A100 = {
        ...validA100,
        recordNumber: '42',
        vatId: '123',
        primaryIdentifier: '456',
      };

      const encoded = encodeA100(shortFields);
      const withoutCrlf = encoded.replace(/\r\n$/, '');

      // Record number should be zero-padded (numeric field)
      expect(withoutCrlf.slice(4, 13)).toBe('000000042');

      // VAT ID should be zero-padded (numeric field)
      expect(withoutCrlf.slice(13, 22)).toBe('000000123');

      // Primary identifier should be zero-padded (numeric field)
      expect(withoutCrlf.slice(22, 37)).toBe('000000000000456');

      // System constant should always be the constant
      expect(withoutCrlf.slice(37, 45)).toBe('&OF1.31&');
    });
  });

  describe('parseA100', () => {
    it('should parse a valid encoded A100 record', () => {
      const encoded = encodeA100(validA100);
      const parsed = parseA100(encoded);

      expect(parsed.code).toBe('A100');
      expect(parsed.recordNumber).toBe('1');
      expect(parsed.vatId).toBe('123456789');
      expect(parsed.primaryIdentifier).toBe('12345678901234');
      expect(parsed.systemConstant).toBe('&OF1.31&');
      expect(parsed.reserved).toBe('');
    });

    it('should handle lines without CRLF', () => {
      const encoded = encodeA100(validA100);
      const withoutCrlf = encoded.replace(/\r\n$/, '');
      const parsed = parseA100(withoutCrlf);

      expect(parsed).toEqual(validA100);
    });

    it('should throw on invalid line length', () => {
      const shortLine = 'A100   1123456789';
      expect(() => parseA100(shortLine)).toThrow('Invalid A100 record length');
    });

    it('should throw on invalid record code', () => {
      const invalidCode = 'B100' + ' '.repeat(91);
      expect(() => parseA100(invalidCode)).toThrow('Invalid A100 record code');
    });

    it('should throw on invalid system constant', () => {
      const invalidVersion =
        'A100' + // code (4)
        '        1' + // recordNumber (9)
        '123456789' + // vatId (9)
        '12345678901234 ' + // primaryIdentifier (15)
        'INVALID ' + // invalid systemConstant (8)
        ' '.repeat(50); // reserved (50)

      expect(() => parseA100(invalidVersion)).toThrow('Invalid system constant');
    });

    it('should trim whitespace from parsed fields', () => {
      const paddedLine =
        'A100' + // code (4)
        '000000042' + // recordNumber (9) - zero-padded
        '000000123' + // vatId (9) - zero-padded
        '000000000000123' + // primaryIdentifier (15) - zero-padded
        '&OF1.31&' + // systemConstant (8)
        ' '.repeat(50); // reserved (50)

      expect(paddedLine.length).toBe(95); // Verify correct length

      const parsed = parseA100(paddedLine);

      expect(parsed.recordNumber).toBe('42');
      expect(parsed.vatId).toBe('123');
      expect(parsed.primaryIdentifier).toBe('123');
      expect(parsed.reserved).toBe('');
    });
  });

  describe('round-trip encoding/parsing', () => {
    it('should maintain data integrity through encode/parse cycle', () => {
      const original = validA100;
      const encoded = encodeA100(original);
      const parsed = parseA100(encoded);

      expect(parsed).toEqual(original);
    });

    it('should work with various field values', () => {
      const testCases: A100[] = [
        {
          code: 'A100',
          recordNumber: '999999999',
          vatId: '999888777',
          primaryIdentifier: '123456789012345',
          systemConstant: '&OF1.31&',
          reserved: 'Some reserved content',
        },
        {
          code: 'A100',
          recordNumber: '1',
          vatId: '1',
          primaryIdentifier: '1',
          systemConstant: '&OF1.31&',
          reserved: '',
        },
      ];

      for (const testCase of testCases) {
        const encoded = encodeA100(testCase);
        const parsed = parseA100(encoded);
        expect(parsed).toEqual(testCase);
      }
    });

    it('should preserve empty reserved field', () => {
      const withEmptyReserved: A100 = {
        ...validA100,
        reserved: '',
      };

      const encoded = encodeA100(withEmptyReserved);
      const parsed = parseA100(encoded);

      expect(parsed.reserved).toBe('');
      expect(parsed).toEqual(withEmptyReserved);
    });
  });

  describe('error cases', () => {
    it('should handle malformed input gracefully', () => {
      expect(() => parseA100('')).toThrow();
      expect(() => parseA100('invalid')).toThrow();
      expect(() => parseA100('A' + ' '.repeat(100))).toThrow();
    });
  });
});
