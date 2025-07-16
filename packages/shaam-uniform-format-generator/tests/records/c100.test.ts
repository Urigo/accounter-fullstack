import { describe, expect, it } from 'vitest';
import { C100Schema, encodeC100, parseC100, type C100 } from '../../src/generator/records/c100';

describe('C100 Record', () => {
  const validC100: C100 = {
    code: 'C100',
    recordNumber: '1',
    vatId: '123456789',
    documentType: '1', // Will be encoded as '001' then parsed back as '1'
    documentId: 'DOC001',
    documentIssueDate: '20240315',
    documentIssueTime: '1430',
    customerName: 'Test Customer Ltd',
    customerStreet: 'Rothschild Blvd',
    customerHouseNumber: '123',
    customerCity: 'Tel Aviv',
    customerPostCode: '6100000',
    customerCountry: 'Israel',
    customerCountryCode: 'IL',
    customerPhone: '03-1234567',
    customerVatId: '987654321',
    documentValueDate: '20240301',
    foreignCurrencyAmount: '1000.00',
    currencyCode: 'USD',
    amountBeforeDiscount: '1200.00',
    documentDiscount: '200.00',
    amountAfterDiscountExcludingVat: '1000.00',
    vatAmount: '170.00',
    amountIncludingVat: '1170.00',
    withholdingTaxAmount: '0.00',
    customerKey: 'CUST001',
    matchingField: 'MATCH001',
    cancelledAttribute1: '',
    cancelledDocument: 'N',
    cancelledAttribute2: '',
    documentDate: '2024031',
    branchKey: 'BRANCH01',
    cancelledAttribute3: '',
    actionExecutor: 'USER001',
    lineConnectingField: '',
    reserved: '',
  };

  describe('C100Schema validation', () => {
    it('should validate a complete C100 record', () => {
      expect(() => C100Schema.parse(validC100)).not.toThrow();
    });

    it('should require code to be exactly "C100"', () => {
      expect(() => C100Schema.parse({ ...validC100, code: 'C10' })).toThrow();
      expect(() => C100Schema.parse({ ...validC100, code: 'C1000' })).toThrow();
      expect(() => C100Schema.parse({ ...validC100, code: 'D100' })).toThrow();
    });

    it('should validate field lengths', () => {
      expect(() => C100Schema.parse({ ...validC100, recordNumber: '1234567890' })).toThrow();
      expect(() => C100Schema.parse({ ...validC100, vatId: '1234567890' })).toThrow();
      expect(() => C100Schema.parse({ ...validC100, documentType: '1234' })).toThrow();
      expect(() => C100Schema.parse({ ...validC100, documentId: 'x'.repeat(21) })).toThrow();
      expect(() => C100Schema.parse({ ...validC100, customerName: 'x'.repeat(51) })).toThrow();
      expect(() => C100Schema.parse({ ...validC100, customerStreet: 'x'.repeat(51) })).toThrow();
    });

    it('should allow empty values for optional fields', () => {
      const minimalC100: C100 = {
        code: 'C100',
        recordNumber: '1',
        vatId: '123456789',
        documentType: '01', // Required according to CSV
        documentId: 'DOC001', // Required according to CSV
        documentIssueDate: '20240315', // Required according to CSV
        documentIssueTime: '', // Optional
        customerName: '',
        customerStreet: '',
        customerHouseNumber: '',
        customerCity: '',
        customerPostCode: '',
        customerCountry: '',
        customerCountryCode: '',
        customerPhone: '',
        customerVatId: '',
        documentValueDate: '',
        foreignCurrencyAmount: '',
        currencyCode: '',
        amountBeforeDiscount: '',
        documentDiscount: '',
        amountAfterDiscountExcludingVat: '',
        vatAmount: '',
        amountIncludingVat: '',
        withholdingTaxAmount: '',
        customerKey: '',
        matchingField: '',
        cancelledAttribute1: '',
        cancelledDocument: '',
        cancelledAttribute2: '',
        documentDate: '',
        branchKey: '',
        cancelledAttribute3: '',
        actionExecutor: '',
        lineConnectingField: '',
        reserved: '',
      };

      expect(() => C100Schema.parse(minimalC100)).not.toThrow();
    });
  });

  describe('encodeC100', () => {
    it('should encode a valid C100 record to fixed-width format', () => {
      const encoded = encodeC100(validC100);

      // Should end with CRLF
      expect(encoded).toMatch(/\r\n$/);

      // Remove CRLF for length check
      const withoutCrlf = encoded.replace(/\r\n$/, '');
      expect(withoutCrlf).toHaveLength(445);

      // Check specific field positions
      expect(withoutCrlf.slice(0, 4)).toBe('C100'); // Record code - left-aligned
      expect(withoutCrlf.slice(4, 13)).toBe('000000001'); // Record number - zero-padded (numeric)
      expect(withoutCrlf.slice(13, 22)).toBe('123456789'); // VAT ID - zero-padded (numeric)
      expect(withoutCrlf.slice(22, 25)).toBe('001'); // Document type - zero-padded (numeric)
      expect(withoutCrlf.slice(25, 45)).toBe('DOC001              '); // Document ID - left-aligned (alphanumeric)
    });

    it('should handle long fields by truncating', () => {
      const longFields: C100 = {
        ...validC100,
        vatId: '1234567890', // Too long for 9 chars
        documentId: 'x'.repeat(25), // Too long for 20 chars
        customerName: 'Very Long Customer Name That Exceeds The Maximum Length', // Too long for 50 chars
      };

      const encoded = encodeC100(longFields);
      const withoutCrlf = encoded.replace(/\r\n$/, '');

      // Should still be exactly 445 characters
      expect(withoutCrlf).toHaveLength(445);

      // VAT ID should be truncated to 9 chars and zero-padded
      expect(withoutCrlf.slice(13, 22)).toBe('123456789'); // Already 9 chars when truncated from 1234567890

      // Document ID should be truncated to 20 chars and left-aligned
      expect(withoutCrlf.slice(25, 45)).toBe('xxxxxxxxxxxxxxxxxxxx');
    });

    it('should pad short fields correctly', () => {
      const shortFields: C100 = {
        ...validC100,
        recordNumber: '42',
        vatId: '123',
        documentId: 'SHORT',
        customerName: 'Short Name',
      };

      const encoded = encodeC100(shortFields);
      const withoutCrlf = encoded.replace(/\r\n$/, '');

      // Record number should be zero-padded (numeric field)
      expect(withoutCrlf.slice(4, 13)).toBe('000000042');

      // VAT ID should be zero-padded (numeric field)
      expect(withoutCrlf.slice(13, 22)).toBe('000000123');

      // Document ID should be left-aligned with spaces (alphanumeric field)
      expect(withoutCrlf.slice(25, 45)).toBe('SHORT               ');
    });
  });

  describe('parseC100', () => {
    it('should parse a valid encoded C100 record', () => {
      const encoded = encodeC100(validC100);
      const parsed = parseC100(encoded);

      expect(parsed.code).toBe('C100');
      expect(parsed.recordNumber).toBe('1');
      expect(parsed.vatId).toBe('123456789');
      expect(parsed.documentType).toBe('1');
      expect(parsed.documentId).toBe('DOC001');
      expect(parsed.documentIssueDate).toBe('20240315');
      expect(parsed.documentIssueTime).toBe('1430');
      expect(parsed.customerName).toBe('Test Customer Ltd');
      expect(parsed.customerStreet).toBe('Rothschild Blvd');
      expect(parsed.customerCity).toBe('Tel Aviv');
    });

    it('should handle lines without CRLF', () => {
      const encoded = encodeC100(validC100);
      const withoutCrlf = encoded.replace(/\r\n$/, '');
      const parsed = parseC100(withoutCrlf);

      expect(parsed.code).toBe('C100');
      expect(parsed.vatId).toBe('123456789');
    });

    it('should handle padded fields correctly', () => {
      const withPadding: C100 = {
        ...validC100,
        recordNumber: '5',
        vatId: '12345',
        documentId: 'DOC5',
        customerName: 'Short',
      };

      const encoded = encodeC100(withPadding);
      const parsed = parseC100(encoded);

      expect(parsed.recordNumber).toBe('5');
      expect(parsed.vatId).toBe('12345');
      expect(parsed.documentId).toBe('DOC5');
      expect(parsed.customerName).toBe('Short');
    });

    it('should throw error for invalid record length', () => {
      expect(() => parseC100('C100SHORT')).toThrow(
        'Invalid C100 record length: expected 445 characters, got 9',
      );
      expect(() => parseC100('C100' + ' '.repeat(100))).toThrow(
        'Invalid C100 record length: expected 445 characters, got 104',
      );
    });

    it('should throw error for invalid record code', () => {
      const invalidLine = 'D100' + ' '.repeat(441);

      expect(() => parseC100(invalidLine)).toThrow(
        'Invalid C100 record code: expected "C100", got "D100"',
      );
    });

    it('should validate parsed data against schema', () => {
      // Create a line with invalid field data that would pass basic parsing but fail schema validation
      const invalidLine = 'C100' + ' '.repeat(9) + 'x'.repeat(10) + ' '.repeat(432); // VAT ID too long

      expect(() => parseC100(invalidLine)).toThrow();
    });
  });

  describe('round-trip encoding and parsing', () => {
    it('should maintain data integrity through encode-parse cycle', () => {
      const testCases: C100[] = [
        validC100,
        {
          ...validC100,
          recordNumber: '999999999',
          documentType: '5', // Will be encoded as '005' then parsed back as '5'
          cancelledDocument: 'Y',
        },
        {
          ...validC100,
          documentId: 'MINIMAL', // Required field cannot be empty
          customerName: '',
          customerStreet: '',
        },
      ];

      for (const [index, testCase] of testCases.entries()) {
        const encoded = encodeC100(testCase);
        const parsed = parseC100(encoded);

        expect(parsed, `Test case ${index} failed round-trip`).toEqual(testCase);
      }
    });

    it('should handle maximum length fields', () => {
      const maxLengthC100: C100 = {
        code: 'C100',
        recordNumber: '999999999', // 9 chars
        vatId: '123456789', // 9 chars
        documentType: '999', // 3 chars
        documentId: 'x'.repeat(20), // 20 chars
        documentIssueDate: '20241231', // 8 chars
        documentIssueTime: '2359', // 4 chars
        customerName: 'A'.repeat(50), // 50 chars
        customerStreet: 'B'.repeat(50), // 50 chars
        customerHouseNumber: 'C'.repeat(10), // 10 chars
        customerCity: 'D'.repeat(30), // 30 chars
        customerPostCode: 'E'.repeat(8), // 8 chars
        customerCountry: 'F'.repeat(30), // 30 chars
        customerCountryCode: 'GG', // 2 chars
        customerPhone: 'H'.repeat(15), // 15 chars
        customerVatId: '987654321', // 9 chars - numeric
        documentValueDate: '20230101', // 8 chars
        foreignCurrencyAmount: '999999999999.99', // 15 chars
        currencyCode: 'KKK', // 3 chars
        amountBeforeDiscount: '999999999999.99', // 15 chars
        documentDiscount: '999999999999.99', // 15 chars
        amountAfterDiscountExcludingVat: '999999999999.99', // 15 chars
        vatAmount: '999999999999.99', // 15 chars
        amountIncludingVat: '999999999999.99', // 15 chars
        withholdingTaxAmount: '999999999.99', // 12 chars (9 digits + .99)
        customerKey: 'R'.repeat(15), // 15 chars
        matchingField: 'S'.repeat(10), // 10 chars
        cancelledAttribute1: 'T'.repeat(8), // 8 chars
        cancelledDocument: 'U', // 1 char
        cancelledAttribute2: 'V'.repeat(8), // 8 chars
        documentDate: '2024031', // 7 chars - numeric
        branchKey: 'X'.repeat(8), // 8 chars
        cancelledAttribute3: 'Y', // 1 char
        actionExecutor: 'Z'.repeat(13), // 13 chars
        lineConnectingField: '',
        reserved: '',
      };

      const encoded = encodeC100(maxLengthC100);
      const parsed = parseC100(encoded);

      expect(parsed).toEqual(maxLengthC100);
    });
  });

  describe('error handling', () => {
    it('should provide meaningful error messages for validation failures', () => {
      const invalidRecord = { ...validC100, code: 'INVALID' };

      expect(() => C100Schema.parse(invalidRecord)).toThrow();
    });

    it('should handle empty strings in required fields', () => {
      const invalidRecord = { ...validC100, recordNumber: '' };

      expect(() => C100Schema.parse(invalidRecord)).toThrow();
    });

    it('should accept various field values', () => {
      // Schema should accept these valid values
      expect(() => C100Schema.parse({ ...validC100, cancelledDocument: 'Y' })).not.toThrow();
      expect(() => C100Schema.parse({ ...validC100, cancelledDocument: 'N' })).not.toThrow();
      expect(() => C100Schema.parse({ ...validC100, cancelledDocument: '' })).not.toThrow();
    });
  });
});
