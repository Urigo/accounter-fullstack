import { describe, expect, it } from 'vitest';
import { D120Schema, encodeD120, parseD120, type D120 } from '../../src/generator/records/d120';

describe('D120 Record', () => {
  const validD120: D120 = {
    code: 'D120',
    recordNumber: '1',
    vatId: '123456789',
    documentType: '123',
    documentNumber: 'DOC123',
    lineNumber: '1',
    paymentMethod: '1',
    bankNumber: '12',
    branchNumber: '345',
    accountNumber: '678901',
    checkNumber: '1234',
    paymentDueDate: '20250101',
    lineAmount: '100.00',
    acquirerCode: '1',
    cardBrand: 'VISA',
    creditTransactionType: '1',
    firstPaymentAmount: '',
    installmentsCount: '',
    additionalPaymentAmount: '',
    reserved1: '',
    branchId: 'BR001',
    reserved2: '',
    documentDate: '20250101',
    headerLinkField: '1',
    reserved: '',
  };

  describe('D120Schema', () => {
    it('should validate a correct D120 record', () => {
      expect(() => D120Schema.parse(validD120)).not.toThrow();
    });

    it('should reject invalid code', () => {
      const invalid = { ...validD120, code: 'INVALID' };
      expect(() => D120Schema.parse(invalid)).toThrow();
    });

    it('should accept empty optional fields', () => {
      const minimalD120: D120 = {
        code: 'D120',
        recordNumber: '1',
        vatId: '123456789',
        documentType: '',
        documentNumber: '',
        lineNumber: '',
        paymentMethod: '',
        bankNumber: '',
        branchNumber: '',
        accountNumber: '',
        checkNumber: '',
        paymentDueDate: '',
        lineAmount: '',
        acquirerCode: '',
        cardBrand: '',
        creditTransactionType: '',
        firstPaymentAmount: '',
        installmentsCount: '',
        additionalPaymentAmount: '',
        reserved1: '',
        branchId: '',
        reserved2: '',
        documentDate: '',
        headerLinkField: '',
        reserved: '',
      };
      expect(() => D120Schema.parse(minimalD120)).not.toThrow();
    });
  });

  describe('encodeD120', () => {
    it('should encode a D120 record to fixed-width format', () => {
      const encoded = encodeD120(validD120);

      // Should end with CRLF
      expect(encoded).toMatch(/\r\n$/);

      // Should be correct length (222 chars + 2 for CRLF)
      expect(encoded.length).toBe(224);

      // Should start with properly padded code
      expect(encoded.substring(0, 4)).toBe('D120');
    });

    it('should pad fields correctly', () => {
      const testRecord: D120 = {
        ...validD120,
        recordNumber: '42',
        vatId: '123',
        documentNumber: 'SHORT',
      };

      const encoded = encodeD120(testRecord);

      // Record number should be right-padded to 9 chars
      expect(encoded.substring(4, 13)).toBe('       42');

      // VAT ID should be left-padded to 9 chars
      expect(encoded.substring(13, 22)).toBe('123      ');

      // Document number should be left-padded to 20 chars
      expect(encoded.substring(25, 45)).toBe('SHORT               ');
    });
  });

  describe('parseD120', () => {
    it('should parse a valid encoded D120 record', () => {
      const encoded = encodeD120(validD120);
      const parsed = parseD120(encoded);

      expect(parsed.code).toBe(validD120.code);
      expect(parsed.recordNumber).toBe(validD120.recordNumber);
      expect(parsed.vatId).toBe(validD120.vatId);
      expect(parsed.documentType).toBe(validD120.documentType);
      expect(parsed.documentNumber).toBe(validD120.documentNumber);
    });

    it('should handle CRLF correctly', () => {
      const encoded = encodeD120(validD120);
      const withoutCRLF = encoded.replace(/\r\n$/, '');

      // Both should parse successfully
      expect(() => parseD120(encoded)).not.toThrow();
      expect(() => parseD120(withoutCRLF)).not.toThrow();
    });

    it('should throw error for incorrect length', () => {
      expect(() => parseD120('short')).toThrow('Invalid D120 record length');
      expect(() => parseD120('a'.repeat(300))).toThrow('Invalid D120 record length');
    });

    it('should throw error for invalid code', () => {
      const invalidLine = 'XXXX' + ' '.repeat(218); // 4 + 218 = 222
      expect(() => parseD120(invalidLine)).toThrow('Invalid D120 record code');
    });

    it('should trim field values correctly', () => {
      // Create a line with padded values
      const paddedLine =
        'D120' + // code (4)
        '       42' + // recordNumber (9) - right padded
        '123      ' + // vatId (9) - left padded
        ' '.repeat(3 + 20 + 4 + 1 + 10 + 10 + 15 + 10 + 8 + 15 + 1 + 20 + 1 + 7 + 8 + 7 + 60); // rest

      expect(paddedLine.length).toBe(222); // Ensure our test line is correct length

      const parsed = parseD120(paddedLine);
      expect(parsed.recordNumber).toBe('42');
      expect(parsed.vatId).toBe('123');
    });
  });

  describe('Round-trip encoding/parsing', () => {
    it('should maintain data integrity through encode/parse cycle', () => {
      const original = validD120;
      const encoded = encodeD120(original);
      const parsed = parseD120(encoded);

      expect(parsed).toEqual(original);
    });

    it('should handle minimal record correctly', () => {
      const minimal: D120 = {
        code: 'D120',
        recordNumber: '1',
        vatId: '123456789',
        documentType: '',
        documentNumber: '',
        lineNumber: '',
        paymentMethod: '',
        bankNumber: '',
        branchNumber: '',
        accountNumber: '',
        checkNumber: '',
        paymentDueDate: '',
        lineAmount: '',
        acquirerCode: '',
        cardBrand: '',
        creditTransactionType: '',
        firstPaymentAmount: '',
        installmentsCount: '',
        additionalPaymentAmount: '',
        reserved1: '',
        branchId: '',
        reserved2: '',
        documentDate: '',
        headerLinkField: '',
        reserved: '',
      };

      const encoded = encodeD120(minimal);
      const parsed = parseD120(encoded);

      expect(parsed).toEqual(minimal);
    });

    it('should handle records with maximum field lengths', () => {
      const maxLength: D120 = {
        code: 'D120',
        recordNumber: '123456789',
        vatId: '987654321',
        documentType: '999',
        documentNumber: 'A'.repeat(20),
        lineNumber: '9999',
        paymentMethod: '9',
        bankNumber: '1234567890',
        branchNumber: '0987654321',
        accountNumber: 'B'.repeat(15),
        checkNumber: 'C'.repeat(10),
        paymentDueDate: '20251231',
        lineAmount: 'D'.repeat(15),
        acquirerCode: '6',
        cardBrand: 'E'.repeat(20),
        creditTransactionType: '5',
        firstPaymentAmount: '',
        installmentsCount: '',
        additionalPaymentAmount: '',
        reserved1: '',
        branchId: 'F'.repeat(7),
        reserved2: '',
        documentDate: '20251231',
        headerLinkField: '9999999',
        reserved: 'G'.repeat(60),
      };

      const encoded = encodeD120(maxLength);
      const parsed = parseD120(encoded);

      expect(parsed).toEqual(maxLength);
    });
  });
});
