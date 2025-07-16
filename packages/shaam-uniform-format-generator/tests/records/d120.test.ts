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
    lineAmount: '100',
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
        documentType: '123', // Required according to CSV spec
        documentNumber: 'DOC001', // Required according to CSV spec
        lineNumber: '1', // Required according to CSV spec
        paymentMethod: '1', // Required according to CSV spec
        bankNumber: '', // Optional/conditional
        branchNumber: '', // Optional/conditional
        accountNumber: '', // Optional/conditional
        checkNumber: '', // Optional/conditional
        paymentDueDate: '', // Optional
        lineAmount: '100', // Required according to CSV spec
        acquirerCode: '', // Optional
        cardBrand: '', // Optional
        creditTransactionType: '', // Optional
        firstPaymentAmount: '', // Deprecated
        installmentsCount: '', // Deprecated
        additionalPaymentAmount: '', // Deprecated
        reserved1: '', // Deprecated
        branchId: '', // Conditionally required
        reserved2: '', // Deprecated
        documentDate: '20250101', // Required according to CSV spec
        headerLinkField: '', // Optional
        reserved: '', // Optional
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

      // Record number should be zero-padded to 9 chars (numeric field per CSV spec)
      expect(encoded.substring(4, 13)).toBe('000000042');

      // VAT ID should be zero-padded to 9 chars (numeric field per CSV spec)
      expect(encoded.substring(13, 22)).toBe('000000123');

      // Document number should be left-padded to 20 chars (alphanumeric field)
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
      // Create a line with padded values according to CSV spec format
      const paddedLine =
        'D120' + // code (4)
        '000000042' + // recordNumber (9) - zero-padded numeric
        '000000123' + // vatId (9) - zero-padded numeric
        '001' + // documentType (3) - zero-padded numeric
        'DOC001              ' + // documentNumber (20) - left-aligned alphanumeric
        '0001' + // lineNumber (4) - zero-padded numeric
        '1' + // paymentMethod (1) - numeric
        '0000000012' + // bankNumber (10) - zero-padded numeric
        '0000000345' + // branchNumber (10) - zero-padded numeric
        '000000000678901' + // accountNumber (15) - zero-padded numeric
        '0000001234' + // checkNumber (10) - zero-padded numeric
        '20250101' + // paymentDueDate (8) - zero-padded numeric
        '100.00         ' + // lineAmount (15) - left-aligned alphanumeric
        '1' + // acquirerCode (1) - numeric
        'VISA                ' + // cardBrand (20) - left-aligned alphanumeric
        '1' + // creditTransactionType (1) - numeric
        '' + // firstPaymentAmount (0) - deprecated
        '' + // installmentsCount (0) - deprecated
        '' + // additionalPaymentAmount (0) - deprecated
        '' + // reserved1 (0) - deprecated
        'BR001  ' + // branchId (7) - left-aligned alphanumeric
        '' + // reserved2 (0) - deprecated
        '20250101' + // documentDate (8) - zero-padded numeric
        '0000001' + // headerLinkField (7) - zero-padded numeric
        ' '.repeat(60); // reserved (60) - left-aligned alphanumeric

      expect(paddedLine.length).toBe(222); // Ensure our test line is correct length

      const parsed = parseD120(paddedLine);

      // Numeric fields should have leading zeros stripped when parsed
      expect(parsed.recordNumber).toBe('42');
      expect(parsed.vatId).toBe('123');
      expect(parsed.documentType).toBe('1');
      expect(parsed.documentNumber).toBe('DOC001');
      expect(parsed.lineNumber).toBe('1');
      expect(parsed.paymentMethod).toBe('1');
      expect(parsed.bankNumber).toBe('12');
      expect(parsed.branchNumber).toBe('345');
      expect(parsed.accountNumber).toBe('678901');
      expect(parsed.checkNumber).toBe('1234');
      expect(parsed.paymentDueDate).toBe('20250101');
      expect(parsed.lineAmount).toBe('100.00');
      expect(parsed.acquirerCode).toBe('1');
      expect(parsed.cardBrand).toBe('VISA');
      expect(parsed.creditTransactionType).toBe('1');
      expect(parsed.branchId).toBe('BR001');
      expect(parsed.documentDate).toBe('20250101');
      expect(parsed.headerLinkField).toBe('1');
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
        documentType: '123', // Required according to CSV spec
        documentNumber: 'DOC001', // Required according to CSV spec
        lineNumber: '1', // Required according to CSV spec
        paymentMethod: '1', // Required according to CSV spec
        bankNumber: '', // Optional/conditional
        branchNumber: '', // Optional/conditional
        accountNumber: '', // Optional/conditional
        checkNumber: '', // Optional/conditional
        paymentDueDate: '', // Optional
        lineAmount: '100', // Required according to CSV spec
        acquirerCode: '', // Optional
        cardBrand: '', // Optional
        creditTransactionType: '', // Optional
        firstPaymentAmount: '', // Deprecated
        installmentsCount: '', // Deprecated
        additionalPaymentAmount: '', // Deprecated
        reserved1: '', // Deprecated
        branchId: '', // Conditionally required
        reserved2: '', // Deprecated
        documentDate: '20250101', // Required according to CSV spec
        headerLinkField: '', // Optional
        reserved: '',
      };

      const encoded = encodeD120(minimal);
      const parsed = parseD120(encoded);

      expect(parsed).toEqual(minimal);
    });

    it('should handle records with maximum field lengths', () => {
      const maxLength: D120 = {
        code: 'D120',
        recordNumber: '999999',
        vatId: '999999999',
        documentType: '999',
        documentNumber: 'A'.repeat(20),
        lineNumber: '9999',
        paymentMethod: '9',
        bankNumber: '999',
        branchNumber: '999',
        accountNumber: '123456789012345',
        checkNumber: '1234567890',
        paymentDueDate: '20251231',
        lineAmount: '9999999999999', // 13 digits max according to schema
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
