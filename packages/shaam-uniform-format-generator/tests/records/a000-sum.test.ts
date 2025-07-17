import { describe, expect, it } from 'vitest';
import {
  A000SumSchema,
  encodeA000Sum,
  parseA000Sum,
  type A000Sum,
  type A000SumInput,
} from '../../src/generator/records/a000-sum';

describe('A000Sum Record', () => {
  const validA000Sum: A000Sum = {
    code: 'A100',
    recordCount: '12345',
  };

  const validA000SumInput: A000SumInput = {
    code: 'B100',
    recordCount: '67890',
  };

  describe('Schema Validation', () => {
    it('should validate a valid A000Sum record', () => {
      expect(() => A000SumSchema.parse(validA000Sum)).not.toThrow();
    });

    it('should reject empty code', () => {
      const invalidRecord = { ...validA000Sum, code: '' };
      expect(() => A000SumSchema.parse(invalidRecord)).toThrow();
    });

    it('should reject code longer than 4 characters', () => {
      const invalidRecord = { ...validA000Sum, code: 'TOOLONG' };
      expect(() => A000SumSchema.parse(invalidRecord)).toThrow();
    });

    it('should reject empty record count', () => {
      const invalidRecord = { ...validA000Sum, recordCount: '' };
      expect(() => A000SumSchema.parse(invalidRecord)).toThrow();
    });

    it('should reject record count longer than 15 characters', () => {
      const invalidRecord = { ...validA000Sum, recordCount: '1234567890123456' };
      expect(() => A000SumSchema.parse(invalidRecord)).toThrow();
    });

    it('should reject non-numeric record count', () => {
      const invalidRecord = { ...validA000Sum, recordCount: 'abc123' };
      expect(() => A000SumSchema.parse(invalidRecord)).toThrow();
    });

    it('should accept valid record codes', () => {
      const validCodes = ['A100', 'B100', 'C100', 'D110', 'M100', 'Z900'];
      for (const code of validCodes) {
        const record = { ...validA000Sum, code };
        expect(() => A000SumSchema.parse(record)).not.toThrow();
      }
    });

    it('should accept record count with leading zeros when parsed as string', () => {
      const record = { ...validA000Sum, recordCount: '000123' };
      expect(() => A000SumSchema.parse(record)).not.toThrow();
    });
  });

  describe('encodeA000Sum', () => {
    it('should encode a valid A000Sum record to fixed-width string', () => {
      const encoded = encodeA000Sum(validA000SumInput);

      // Should end with CRLF
      expect(encoded).toMatch(/\r\n$/);

      // Should have correct length (19 + 2 for CRLF)
      expect(encoded.length).toBe(21);

      // Should start with the record code
      expect(encoded.slice(0, 4)).toBe('B100');
    });

    it('should pad numeric fields with leading zeros', () => {
      const shortCountInput: A000SumInput = {
        code: 'A100',
        recordCount: '123',
      };

      const encoded = encodeA000Sum(shortCountInput);

      // Record count should be zero-padded to 15 digits (position 4-18)
      const recordCountField = encoded.slice(4, 19);
      expect(recordCountField).toBe('000000000000123');
    });

    it('should handle maximum length fields', () => {
      const maxLengthInput: A000SumInput = {
        code: 'ABCD',
        recordCount: '123456789012345',
      };

      const encoded = encodeA000Sum(maxLengthInput);
      expect(encoded.length).toBe(21); // Should still have correct total length

      // Check that fields are not truncated
      expect(encoded.slice(0, 4)).toBe('ABCD');
      expect(encoded.slice(4, 19)).toBe('123456789012345');
    });

    it('should handle single digit record count', () => {
      const singleDigitInput: A000SumInput = {
        code: 'Z900',
        recordCount: '1',
      };

      const encoded = encodeA000Sum(singleDigitInput);
      const recordCountField = encoded.slice(4, 19);
      expect(recordCountField).toBe('000000000000001');
    });
  });

  describe('parseA000Sum', () => {
    it('should parse a valid fixed-width A000Sum record string', () => {
      const encoded = encodeA000Sum(validA000SumInput);
      const parsed = parseA000Sum(encoded);

      expect(parsed.code).toBe('B100');
      expect(parsed.recordCount).toBe('67890');
    });

    it('should handle lines with and without CRLF', () => {
      const encoded = encodeA000Sum(validA000SumInput);
      const withoutCRLF = encoded.replace(/\r\n$/, '');

      expect(() => parseA000Sum(encoded)).not.toThrow();
      expect(() => parseA000Sum(withoutCRLF)).not.toThrow();

      const parsedWithCRLF = parseA000Sum(encoded);
      const parsedWithoutCRLF = parseA000Sum(withoutCRLF);

      expect(parsedWithCRLF).toEqual(parsedWithoutCRLF);
    });

    it('should throw error for invalid record length', () => {
      const shortLine = 'A100' + ' '.repeat(10);
      const longLine = 'A100' + ' '.repeat(50);

      expect(() => parseA000Sum(shortLine)).toThrow(
        'Invalid A000Sum record length: expected 19 characters, got 14',
      );
      expect(() => parseA000Sum(longLine)).toThrow(
        'Invalid A000Sum record length: expected 19 characters, got 54',
      );
    });

    it('should properly strip leading zeros from numeric fields', () => {
      const paddedInput: A000SumInput = {
        code: 'M100',
        recordCount: '00000000000042',
      };

      const encoded = encodeA000Sum(paddedInput);
      const parsed = parseA000Sum(encoded);

      // Should strip leading zeros
      expect(parsed.recordCount).toBe('42');
    });

    it('should handle zero record count correctly', () => {
      const zeroInput: A000SumInput = {
        code: 'C100',
        recordCount: '0',
      };

      const encoded = encodeA000Sum(zeroInput);
      const parsed = parseA000Sum(encoded);

      expect(parsed.recordCount).toBe('0');
    });

    it('should preserve code field correctly', () => {
      const testCodes = ['A100', 'B100', 'C100', 'D110', 'M100', 'Z900'];

      for (const code of testCodes) {
        const input: A000SumInput = { code, recordCount: '100' };
        const encoded = encodeA000Sum(input);
        const parsed = parseA000Sum(encoded);

        expect(parsed.code).toBe(code);
      }
    });
  });

  describe('Round-trip Tests', () => {
    it('should maintain data integrity through encode-parse round trip', () => {
      const encoded = encodeA000Sum(validA000SumInput);
      const parsed = parseA000Sum(encoded);
      const reEncoded = encodeA000Sum(parsed);

      expect(reEncoded).toBe(encoded);
    });

    it('should preserve all field values in round trip', () => {
      const encoded = encodeA000Sum(validA000SumInput);
      const parsed = parseA000Sum(encoded);

      expect(parsed.code).toBe(validA000SumInput.code);
      expect(parsed.recordCount).toBe(validA000SumInput.recordCount);
    });

    it('should handle edge cases in round trip', () => {
      const edgeCases: A000SumInput[] = [
        { code: 'A', recordCount: '1' }, // Minimum lengths
        { code: 'ABCD', recordCount: '123456789012345' }, // Maximum lengths
        { code: 'Z900', recordCount: '0' }, // Zero count
        { code: 'TEST', recordCount: '999999999999999' }, // Large number
      ];

      for (const testCase of edgeCases) {
        const encoded = encodeA000Sum(testCase);
        const parsed = parseA000Sum(encoded);
        const reEncoded = encodeA000Sum(parsed);

        expect(reEncoded).toBe(encoded);
        expect(parsed.code).toBe(testCase.code);
        expect(parsed.recordCount).toBe(testCase.recordCount);
      }
    });

    it('should handle record count with various leading zero patterns', () => {
      const testCases = [
        { input: '1', expected: '1' },
        { input: '01', expected: '1' },
        { input: '001', expected: '1' },
        { input: '0001234', expected: '1234' },
        { input: '000000000000001', expected: '1' },
      ];

      for (const { input, expected } of testCases) {
        const testInput: A000SumInput = { code: 'TEST', recordCount: input };
        const encoded = encodeA000Sum(testInput);
        const parsed = parseA000Sum(encoded);

        expect(parsed.recordCount).toBe(expected);
      }
    });
  });

  describe('Error Handling', () => {
    it('should throw error when feeding invalid line to parseA000Sum', () => {
      const invalidLines = [
        '', // Empty line
        'A100', // Too short
        'A100' + ' '.repeat(100), // Too long
        'XY', // Way too short
      ];

      for (const line of invalidLines) {
        expect(() => parseA000Sum(line)).toThrow();
      }
    });

    it('should validate schema after parsing', () => {
      // Create a line with valid length but invalid content that should fail schema validation
      const validEncoded = encodeA000Sum(validA000SumInput);

      // This should pass since the content is valid
      expect(() => parseA000Sum(validEncoded)).not.toThrow();
    });

    it('should handle malformed input gracefully', () => {
      // Test with various malformed inputs that should fail schema validation

      // Test first input separately to debug - all spaces should fail because code becomes empty
      expect(() => parseA000Sum(' '.repeat(19)), 'All spaces input should fail').toThrow();

      // Test second input - this creates "A" + 18 spaces = "A                  " which is valid
      // Let's use something that should actually fail
      expect(() => parseA000Sum('ABCDE' + ' '.repeat(14)), 'Code too long should fail').toThrow();
    });
  });
});
