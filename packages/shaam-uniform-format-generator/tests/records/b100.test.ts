import { describe, expect, it } from 'vitest';
import { B100Schema, encodeB100, parseB100, type B100 } from '../../src/generator/records/b100';

describe('B100 Record', () => {
  const validB100: B100 = {
    code: 'B100',
    recordNumber: 1,
    vatId: '123456789',
    transactionNumber: 1_234_567_890,
    transactionLineNumber: 1,
    batchNumber: 12_345_678,
    transactionType: 'Sale',
    referenceDocument: 'INV-2023-001',
    referenceDocumentType: '320',
    referenceDocument2: 'REF-2023-001',
    referenceDocumentType2: '300',
    details: 'Payment for services',
    date: '20231215',
    valueDate: '20231215',
    accountKey: 'ACC001',
    counterAccountKey: 'ACC002',
    debitCreditIndicator: '1',
    currencyCode: 'ILS',
    transactionAmount: 1000.0,
    foreignCurrencyAmount: 300.0,
    quantityField: 5.0,
    matchingField1: 'MATCH001',
    matchingField2: 'MATCH002',
    branchId: 'BR001',
    entryDate: '20231215',
    operatorUsername: 'operator1',
    reserved: '',
  };

  describe('B100Schema validation', () => {
    it('should validate a complete B100 record', () => {
      expect(() => B100Schema.parse(validB100)).not.toThrow();
    });

    it('should require code to be exactly "B100"', () => {
      expect(() => B100Schema.parse({ ...validB100, code: 'B10' })).toThrow();
      expect(() => B100Schema.parse({ ...validB100, code: 'B1000' })).toThrow();
      expect(() => B100Schema.parse({ ...validB100, code: 'A100' })).toThrow();
    });

    it('should require non-empty required fields', () => {
      expect(() => B100Schema.parse({ ...validB100, recordNumber: 0 })).toThrow();
      expect(() => B100Schema.parse({ ...validB100, vatId: '' })).toThrow();
      expect(() => B100Schema.parse({ ...validB100, transactionNumber: 0 })).toThrow();
      expect(() => B100Schema.parse({ ...validB100, transactionLineNumber: 0 })).toThrow();
      expect(() => B100Schema.parse({ ...validB100, accountKey: '' })).toThrow();
      // Test with invalid transactionAmount type
      expect(() =>
        B100Schema.parse({ ...validB100, transactionAmount: 'invalid' as unknown as number }),
      ).toThrow();
    });

    it('should allow empty optional fields', () => {
      const minimal: B100 = {
        code: 'B100',
        recordNumber: 1,
        vatId: '123456789',
        transactionNumber: 1_234_567_890,
        transactionLineNumber: 1,
        batchNumber: undefined,
        transactionType: '',
        referenceDocument: '',
        referenceDocumentType: undefined,
        referenceDocument2: '',
        referenceDocumentType2: undefined,
        details: '',
        date: '20231215',
        valueDate: '20231215',
        accountKey: 'ACC001',
        counterAccountKey: '',
        debitCreditIndicator: '1',
        currencyCode: undefined,
        transactionAmount: 1000.0,
        foreignCurrencyAmount: undefined,
        quantityField: undefined,
        matchingField1: '',
        matchingField2: '',
        branchId: '',
        entryDate: '20231215',
        operatorUsername: '',
        reserved: '',
      };
      expect(() => B100Schema.parse(minimal)).not.toThrow();
    });

    it('should validate debit/credit indicator', () => {
      expect(() => B100Schema.parse({ ...validB100, debitCreditIndicator: '1' })).not.toThrow();
      expect(() => B100Schema.parse({ ...validB100, debitCreditIndicator: '2' })).not.toThrow();
      expect(() => B100Schema.parse({ ...validB100, debitCreditIndicator: '0' })).toThrow();
      expect(() => B100Schema.parse({ ...validB100, debitCreditIndicator: '3' })).toThrow();
    });

    it('should validate date format (8 digits)', () => {
      expect(() => B100Schema.parse({ ...validB100, date: '2023121' })).toThrow(); // Too short
      expect(() => B100Schema.parse({ ...validB100, date: '202312150' })).toThrow(); // Too long
      expect(() => B100Schema.parse({ ...validB100, date: '20231a15' })).toThrow(); // Non-numeric
    });

    it('should enforce maximum field lengths', () => {
      expect(() => B100Schema.parse({ ...validB100, recordNumber: 1_000_000_000 })).toThrow();
      expect(() => B100Schema.parse({ ...validB100, vatId: '1234567890' })).toThrow();
      expect(() => B100Schema.parse({ ...validB100, transactionNumber: 10_000_000_000 })).toThrow();
      expect(() => B100Schema.parse({ ...validB100, transactionLineNumber: 100_000 })).toThrow();
      expect(() => B100Schema.parse({ ...validB100, batchNumber: 100_000_000 })).toThrow();
      expect(() => B100Schema.parse({ ...validB100, transactionType: 'x'.repeat(16) })).toThrow();
      expect(() => B100Schema.parse({ ...validB100, referenceDocument: 'x'.repeat(21) })).toThrow();
      expect(() => B100Schema.parse({ ...validB100, details: 'x'.repeat(51) })).toThrow();
      expect(() => B100Schema.parse({ ...validB100, accountKey: 'x'.repeat(16) })).toThrow();
      expect(() => B100Schema.parse({ ...validB100, reserved: 'x'.repeat(26) })).toThrow();
    });
  });

  describe('encodeB100', () => {
    it('should encode a valid B100 record to fixed-width format', () => {
      const encoded = encodeB100(validB100);

      // Should end with CRLF
      expect(encoded).toMatch(/\r\n$/);

      // Remove CRLF for length check
      const withoutCrlf = encoded.replace(/\r\n$/, '');
      expect(withoutCrlf).toHaveLength(317);

      // Check specific field positions
      expect(withoutCrlf.slice(0, 4)).toBe('B100'); // Record code
      expect(withoutCrlf.slice(4, 13)).toBe('000000001'); // Zero-padded record number
      expect(withoutCrlf.slice(13, 22)).toBe('123456789'); // VAT ID
      expect(withoutCrlf.slice(22, 32)).toBe('1234567890'); // Transaction number
      expect(withoutCrlf.slice(32, 37)).toBe('00001'); // Zero-padded transaction line number
    });

    it('should handle numeric fields with zero padding', () => {
      const shortFields: B100 = {
        ...validB100,
        recordNumber: 42,
        transactionNumber: 123,
        transactionLineNumber: 5,
        batchNumber: 99,
      };

      const encoded = encodeB100(shortFields);
      const withoutCrlf = encoded.replace(/\r\n$/, '');

      // Record number should be zero-padded
      expect(withoutCrlf.slice(4, 13)).toBe('000000042');
      // Transaction number should be zero-padded
      expect(withoutCrlf.slice(22, 32)).toBe('0000000123');
      // Transaction line number should be zero-padded
      expect(withoutCrlf.slice(32, 37)).toBe('00005');
      // Batch number should be zero-padded
      expect(withoutCrlf.slice(37, 45)).toBe('00000099');
    });

    it('should handle amount fields with right alignment', () => {
      const encoded = encodeB100(validB100);
      const withoutCrlf = encoded.replace(/\r\n$/, '');

      // Find transaction amount field position (after all previous fields)
      const transactionAmountPos =
        4 + 9 + 9 + 10 + 5 + 8 + 15 + 20 + 3 + 20 + 3 + 50 + 8 + 8 + 15 + 15 + 1 + 3;
      expect(withoutCrlf.slice(transactionAmountPos, transactionAmountPos + 15)).toBe(
        '+00000000100000',
      ); // Monetary field with + sign and no decimal point
    });

    it('should pad empty fields correctly', () => {
      const minimal: B100 = {
        code: 'B100',
        recordNumber: 1,
        vatId: '123456789',
        transactionNumber: 1,
        transactionLineNumber: 1,
        batchNumber: undefined,
        transactionType: '',
        referenceDocument: '',
        referenceDocumentType: undefined,
        referenceDocument2: '',
        referenceDocumentType2: undefined,
        details: '',
        date: '20231215',
        valueDate: '20231215',
        accountKey: 'ACC001',
        counterAccountKey: '',
        debitCreditIndicator: '1',
        currencyCode: undefined,
        transactionAmount: 1000.0,
        foreignCurrencyAmount: undefined,
        quantityField: undefined,
        matchingField1: '',
        matchingField2: '',
        branchId: '',
        entryDate: '20231215',
        operatorUsername: '',
        reserved: '',
      };

      const encoded = encodeB100(minimal);
      const withoutCrlf = encoded.replace(/\r\n$/, '');

      // Should still be exactly 317 characters
      expect(withoutCrlf).toHaveLength(317);

      // Empty batch number should be zero-padded
      expect(withoutCrlf.slice(37, 45)).toBe('00000000');
    });
  });

  describe('parseB100', () => {
    it('should parse a valid encoded B100 record', () => {
      const encoded = encodeB100(validB100);
      const parsed = parseB100(encoded);

      expect(parsed.code).toBe('B100');
      expect(parsed.recordNumber).toBe(1);
      expect(parsed.vatId).toBe('123456789');
      expect(parsed.transactionNumber).toBe(1_234_567_890);
      expect(parsed.transactionLineNumber).toBe(1);
      expect(parsed.accountKey).toBe('ACC001');
      expect(parsed.debitCreditIndicator).toBe('1');
      expect(parsed.date).toBe('20231215');
      expect(parsed.transactionAmount).toBe(1000.0);
    });

    it('should handle lines without CRLF', () => {
      const encoded = encodeB100(validB100);
      const withoutCrlf = encoded.replace(/\r\n$/, '');
      const parsed = parseB100(withoutCrlf);

      expect(parsed.code).toBe(validB100.code);
      expect(parsed.recordNumber).toBe(validB100.recordNumber);
    });

    it('should throw on invalid line length', () => {
      const shortLine = 'B100   1123456789';
      expect(() => parseB100(shortLine)).toThrow('Invalid B100 record length');
    });

    it('should throw on invalid record code', () => {
      const invalidCode = 'A100' + ' '.repeat(313);
      expect(() => parseB100(invalidCode)).toThrow('Invalid B100 record code');
    });

    it('should strip leading zeros from numeric fields correctly', () => {
      // Create a line with zero-padded numeric fields
      const paddedLine =
        'B100' + // code (4)
        '000000042' + // recordNumber (9)
        '000000123' + // vatId (9)
        '0000000456' + // transactionNumber (10)
        '00005' + // transactionLineNumber (5)
        '00000099' + // batchNumber (8)
        ' '.repeat(15) + // transactionType (15)
        ' '.repeat(20) + // referenceDocument (20)
        '000' + // referenceDocumentType (3)
        ' '.repeat(20) + // referenceDocument2 (20)
        '000' + // referenceDocumentType2 (3)
        ' '.repeat(50) + // details (50)
        '20231215' + // date (8)
        '20231215' + // valueDate (8)
        'ACC001         ' + // accountKey (15)
        ' '.repeat(15) + // counterAccountKey (15)
        '1' + // debitCreditIndicator (1)
        '   ' + // currencyCode (3)
        '+00000000100000' + // transactionAmount (15) - monetary field
        ' '.repeat(15) + // foreignCurrencyAmount (15)
        ' '.repeat(12) + // quantityField (12)
        ' '.repeat(10) + // matchingField1 (10)
        ' '.repeat(10) + // matchingField2 (10)
        ' '.repeat(7) + // branchId (7)
        '20231215' + // entryDate (8)
        ' '.repeat(9) + // operatorUsername (9)
        ' '.repeat(25); // reserved (25)

      expect(paddedLine.length).toBe(317); // Verify correct length

      const parsed = parseB100(paddedLine);

      expect(parsed.recordNumber).toBe(42);
      expect(parsed.vatId).toBe('123');
      expect(parsed.transactionNumber).toBe(456);
      expect(parsed.transactionLineNumber).toBe(5);
      expect(parsed.batchNumber).toBe(99);
      expect(parsed.referenceDocumentType).toBe(undefined);
      expect(parsed.referenceDocumentType2).toBe(undefined);
    });

    it('should trim whitespace from parsed fields', () => {
      const encoded = encodeB100(validB100);
      const parsed = parseB100(encoded);

      // All string fields should be trimmed
      expect(parsed.transactionType).toBe('Sale');
      expect(parsed.referenceDocument).toBe('INV-2023-001');
      expect(parsed.details).toBe('Payment for services');
      expect(parsed.accountKey).toBe('ACC001');
    });
  });

  describe('round-trip encoding/parsing', () => {
    it('should maintain data integrity through encode/parse cycle', () => {
      const original = validB100;
      const encoded = encodeB100(original);
      const parsed = parseB100(encoded);

      expect(parsed).toEqual(original);
    });

    it('should work with various field values', () => {
      const testCases: B100[] = [
        {
          ...validB100,
          recordNumber: 999_999_999,
          transactionNumber: 9_999_999_999,
          transactionLineNumber: 99_999,
          debitCreditIndicator: '2',
        },
        {
          ...validB100,
          recordNumber: 1,
          transactionNumber: 1,
          transactionLineNumber: 1,
          batchNumber: undefined,
          transactionType: '',
          referenceDocument: '',
          details: '',
          counterAccountKey: '',
          currencyCode: undefined,
          foreignCurrencyAmount: undefined,
          quantityField: undefined,
          matchingField1: '',
          matchingField2: '',
          branchId: '',
          operatorUsername: '',
          reserved: '',
        },
      ];

      for (const testCase of testCases) {
        const encoded = encodeB100(testCase);
        const parsed = parseB100(encoded);
        expect(parsed).toEqual(testCase);
      }
    });

    it('should preserve empty optional fields', () => {
      const withEmptyFields: B100 = {
        ...validB100,
        batchNumber: undefined,
        transactionType: '',
        referenceDocument: '',
        referenceDocumentType: undefined,
        referenceDocument2: '',
        referenceDocumentType2: undefined,
        details: '',
        counterAccountKey: '',
        currencyCode: undefined,
        foreignCurrencyAmount: undefined,
        quantityField: undefined,
        matchingField1: '',
        matchingField2: '',
        branchId: '',
        operatorUsername: '',
        reserved: '',
      };

      const encoded = encodeB100(withEmptyFields);
      const parsed = parseB100(encoded);

      expect(parsed.batchNumber).toBe(undefined);
      expect(parsed.transactionType).toBe('');
      expect(parsed.reserved).toBe('');
      expect(parsed).toEqual(withEmptyFields);
    });
  });

  describe('error cases', () => {
    it('should handle malformed input gracefully', () => {
      expect(() => parseB100('')).toThrow();
      expect(() => parseB100('invalid')).toThrow();
      expect(() => parseB100('B' + ' '.repeat(400))).toThrow();
    });

    it('should validate against schema after parsing', () => {
      // Create a line with invalid debit/credit indicator
      const invalidLine =
        'B100' +
        '000000001' +
        '123456789' +
        '1234567890' +
        '00001' +
        '00000000' +
        ' '.repeat(15) +
        ' '.repeat(20) +
        '000' +
        ' '.repeat(20) +
        '000' +
        ' '.repeat(50) +
        '20231215' +
        '20231215' +
        'ACC001         ' +
        ' '.repeat(15) +
        '9' + // Invalid debit/credit indicator
        ' '.repeat(3) +
        '        1000.00' +
        ' '.repeat(15) +
        ' '.repeat(12) +
        ' '.repeat(10) +
        ' '.repeat(10) +
        ' '.repeat(7) +
        '20231215' +
        ' '.repeat(9) +
        ' '.repeat(25);

      expect(() => parseB100(invalidLine)).toThrow();
    });
  });
});
