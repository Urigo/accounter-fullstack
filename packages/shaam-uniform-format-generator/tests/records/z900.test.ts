import { describe, expect, it } from 'vitest';
import { SHAAM_VERSION } from '../../src/constants';
import { encodeZ900, parseZ900, Z900Schema, type Z900 } from '../../src/generator/records/z900';

describe('Z900 Record', () => {
  const validZ900: Z900 = {
    code: 'Z900',
    recordNumber: 123,
    vatId: '987654321',
    uniqueId: 123_456_789_012_345,
    totalRecords: 1000,
    reserved: '',
  };

  describe('Z900Schema validation', () => {
    it('should validate a correct Z900 record', () => {
      expect(() => Z900Schema.parse(validZ900)).not.toThrow();
    });

    it('should require code to be exactly "Z900"', () => {
      const invalidRecord = { ...validZ900, code: 'Z800' };
      expect(() => Z900Schema.parse(invalidRecord)).toThrow();
    });

    it('should require recordNumber to be non-empty and max 9 characters', () => {
      expect(() => Z900Schema.parse({ ...validZ900, recordNumber: 0 })).toThrow();
      expect(() => Z900Schema.parse({ ...validZ900, recordNumber: 1_000_000_000 })).toThrow();
      expect(() => Z900Schema.parse({ ...validZ900, recordNumber: 123_456_789 })).not.toThrow();
    });

    it('should require vatId to be non-empty and max 9 characters', () => {
      expect(() => Z900Schema.parse({ ...validZ900, vatId: '' })).toThrow();
      expect(() => Z900Schema.parse({ ...validZ900, vatId: '1234567890' })).toThrow();
      expect(() => Z900Schema.parse({ ...validZ900, vatId: '123456789' })).not.toThrow();
    });

    it('should require uniqueId to be non-empty and max 15 characters', () => {
      expect(() => Z900Schema.parse({ ...validZ900, uniqueId: 0 })).toThrow();
      expect(() => Z900Schema.parse({ ...validZ900, uniqueId: 1_000_000_000_000_000 })).toThrow();
      expect(() => Z900Schema.parse({ ...validZ900, uniqueId: 123_456_789_012_345 })).not.toThrow();
    });

    it('should require totalRecords to be non-empty and max 15 characters', () => {
      expect(() => Z900Schema.parse({ ...validZ900, totalRecords: 0 })).toThrow();
      expect(() =>
        Z900Schema.parse({ ...validZ900, totalRecords: 1_000_000_000_000_000 }),
      ).toThrow();
      expect(() =>
        Z900Schema.parse({ ...validZ900, totalRecords: 123_456_789_012_345 }),
      ).not.toThrow();
    });

    it('should validate reserved field', () => {
      expect(() => Z900Schema.parse({ ...validZ900, reserved: '' })).not.toThrow();
      expect(() => Z900Schema.parse({ ...validZ900, reserved: 'Reserved data' })).not.toThrow();
      expect(() => Z900Schema.parse({ ...validZ900, reserved: 'A'.repeat(50) })).not.toThrow();
      expect(() => Z900Schema.parse({ ...validZ900, reserved: 'A'.repeat(51) })).toThrow();
    });

    it('should set default empty string for reserved field when missing', () => {
      const { reserved: _reserved, ...recordWithoutReserved } = validZ900;
      const parsed = Z900Schema.parse(recordWithoutReserved);
      expect(parsed.reserved).toBe('');
    });
  });

  describe('encodeZ900', () => {
    it('should encode a Z900 record to fixed-width format', () => {
      const encoded = encodeZ900(validZ900);

      // Should end with CRLF
      expect(encoded).toMatch(/\r\n$/);

      // Remove CRLF for length check
      const withoutCRLF = encoded.replace(/\r\n$/, '');
      expect(withoutCRLF).toHaveLength(110);

      // Check field positions and padding
      expect(withoutCRLF.slice(0, 4)).toBe('Z900'); // code (4)
      expect(withoutCRLF.slice(4, 13)).toBe('000000123'); // recordNumber zero-padded (9)
      expect(withoutCRLF.slice(13, 22)).toBe('987654321'); // vatId zero-padded (9)
      expect(withoutCRLF.slice(22, 37)).toBe('123456789012345'); // uniqueId zero-padded (15)
      expect(withoutCRLF.slice(37, 45)).toBe(SHAAM_VERSION); // static SHAAM version (8)
      expect(withoutCRLF.slice(45, 60)).toBe('000000000001000'); // totalRecords zero-padded (15)
      expect(withoutCRLF.slice(60, 110)).toBe(' '.repeat(50)); // reserved left-aligned (50)
    });

    it('should handle maximum length fields', () => {
      const maxLengthRecord: Z900 = {
        code: 'Z900',
        recordNumber: 123_456_789, // 9 digits
        vatId: '123456789', // 9 chars
        uniqueId: 123_456_789_012_345, // 15 digits
        totalRecords: 123_456_789_012_345, // 15 digits
        reserved: 'A'.repeat(50), // 50 chars
      };

      const encoded = encodeZ900(maxLengthRecord);
      const withoutCRLF = encoded.replace(/\r\n$/, '');
      expect(withoutCRLF).toHaveLength(110);

      expect(withoutCRLF.slice(0, 4)).toBe('Z900');
      expect(withoutCRLF.slice(4, 13)).toBe('123456789');
      expect(withoutCRLF.slice(13, 22)).toBe('123456789');
      expect(withoutCRLF.slice(22, 37)).toBe('123456789012345');
      expect(withoutCRLF.slice(37, 45)).toBe(SHAAM_VERSION);
      expect(withoutCRLF.slice(45, 60)).toBe('123456789012345');
      expect(withoutCRLF.slice(60, 110)).toBe('A'.repeat(50));
    });

    it('should truncate fields that exceed maximum length', () => {
      const oversizedRecord: Z900 = {
        code: 'Z900',
        recordNumber: 999_999_999, // max 9 digits
        vatId: '1234567890', // 10 chars (max 9)
        uniqueId: 999_999_999_999_999, // max 15 digits
        totalRecords: 999_999_999_999_999, // max 15 digits
        reserved: 'A'.repeat(60), // 60 chars (max 50)
      };

      const encoded = encodeZ900(oversizedRecord);
      const withoutCRLF = encoded.replace(/\r\n$/, '');
      expect(withoutCRLF).toHaveLength(110);

      expect(withoutCRLF.slice(4, 13)).toBe('999999999'); // max 9 digits
      expect(withoutCRLF.slice(13, 22)).toBe('123456789'); // truncated
      expect(withoutCRLF.slice(22, 37)).toBe('999999999999999'); // max 15 digits
      expect(withoutCRLF.slice(37, 45)).toBe(SHAAM_VERSION); // always the constant
      expect(withoutCRLF.slice(45, 60)).toBe('999999999999999'); // max 15 digits
      expect(withoutCRLF.slice(60, 110)).toBe('A'.repeat(50)); // truncated
    });
  });

  describe('parseZ900', () => {
    it('should parse a valid Z900 record line', () => {
      const line =
        'Z900000000123987654321123456789012345' +
        SHAAM_VERSION +
        '000000000001000' +
        ' '.repeat(50) +
        '\r\n';
      const parsed = parseZ900(line);

      expect(parsed).toEqual({
        code: 'Z900',
        recordNumber: 123,
        vatId: '987654321',
        uniqueId: 123_456_789_012_345,
        totalRecords: 1000,
        reserved: '',
      });
    });

    it('should parse line without CRLF', () => {
      const line =
        'Z900000000123987654321123456789012345' +
        SHAAM_VERSION +
        '000000000001000' +
        ' '.repeat(50);
      const parsed = parseZ900(line);

      expect(parsed.code).toBe('Z900');
      expect(parsed.recordNumber).toBe(123);
    });

    it('should throw error for invalid line length', () => {
      const shortLine = 'Z900' + ' '.repeat(50);
      expect(() => parseZ900(shortLine)).toThrow(
        'Invalid Z900 record length: expected 110 characters, got 54',
      );

      const longLine = 'Z900' + ' '.repeat(200);
      expect(() => parseZ900(longLine)).toThrow(
        'Invalid Z900 record length: expected 110 characters, got 204',
      );
    });

    it('should throw error for invalid record code', () => {
      const invalidLine = 'Z800' + ' '.repeat(106) + '\r\n';
      expect(() => parseZ900(invalidLine)).toThrow(
        'Invalid Z900 record code: expected "Z900", got "Z800"',
      );
    });

    it('should throw error for invalid SHAAM version', () => {
      const invalidLine =
        'Z900000000123987654321123456789012345INVALID 000000000001000' + ' '.repeat(50) + '\r\n';
      expect(() => parseZ900(invalidLine)).toThrow('Invalid SHAAM version');
    });

    it('should handle fields with trailing spaces correctly', () => {
      const line =
        'Z900000000123000123456000000000123456' +
        SHAAM_VERSION +
        '000000000009999' +
        ' '.repeat(50) +
        '\r\n';
      const parsed = parseZ900(line);

      expect(parsed.vatId).toBe('123456');
      expect(parsed.uniqueId).toBe(123_456);
      expect(parsed.totalRecords).toBe(9999);
      expect(parsed.reserved).toBe('');
    });
  });

  describe('Round-trip encoding and parsing', () => {
    it('should maintain data integrity through encode -> parse cycle', () => {
      const original = validZ900;
      const encoded = encodeZ900(original);
      const parsed = parseZ900(encoded);

      expect(parsed).toEqual(original);
    });

    it('should handle round-trip with maximum length fields', () => {
      const original: Z900 = {
        code: 'Z900',
        recordNumber: 999_999_999,
        vatId: '999888777',
        uniqueId: 999_888_777_666_555,
        totalRecords: 999_888_777_666_555,
        reserved: 'A'.repeat(50),
      };

      const encoded = encodeZ900(original);
      const parsed = parseZ900(encoded);

      expect(parsed).toEqual(original);
    });

    it('should handle round-trip with minimal fields', () => {
      const original: Z900 = {
        code: 'Z900',
        recordNumber: 1,
        vatId: '1',
        uniqueId: 1,
        totalRecords: 1,
        reserved: '',
      };

      const encoded = encodeZ900(original);
      const parsed = parseZ900(encoded);

      expect(parsed).toEqual(original);
    });
  });

  describe('Error handling', () => {
    it('should throw validation error for invalid parsed data', () => {
      // Create a line that parses but fails schema validation
      const invalidLine = 'Z900         ' + ' '.repeat(97); // empty recordNumber
      expect(() => parseZ900(invalidLine)).toThrow();
    });
  });
});
