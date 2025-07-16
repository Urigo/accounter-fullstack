import { describe, expect, it } from 'vitest';
import { B110Schema, encodeB110, parseB110, type B110 } from '../../src/generator/records/b110';

describe('B110 Record', () => {
  const validB110: B110 = {
    code: 'B110',
    recordNumber: '1',
    vatId: '123456789',
    accountKey: 'ACC001',
    accountName: 'Cash Account',
    trialBalanceCode: 'TB001',
    trialBalanceCodeDescription: 'Current Assets',
    customerSupplierAddressStreet: '123 Main Street',
    customerSupplierAddressHouseNumber: '123A',
    customerSupplierAddressCity: 'Tel Aviv',
    customerSupplierAddressZip: '12345',
    customerSupplierAddressCountry: 'Israel',
    countryCode: 'IL',
    parentAccountKey: 'PARENT001',
    accountOpeningBalance: '10000.00',
    totalDebits: '50000.00',
    totalCredits: '40000.00',
    accountingClassificationCode: '1100',
    supplierCustomerTaxId: '987654321',
    branchId: 'BR001',
    openingBalanceForeignCurrency: '3000.00',
    foreignCurrencyCode: 'USD',
    reserved: '',
  };

  describe('B110Schema validation', () => {
    it('should validate a complete B110 record', () => {
      expect(() => B110Schema.parse(validB110)).not.toThrow();
    });

    it('should require code to be exactly "B110"', () => {
      expect(() => B110Schema.parse({ ...validB110, code: 'B11' })).toThrow();
      expect(() => B110Schema.parse({ ...validB110, code: 'B1100' })).toThrow();
      expect(() => B110Schema.parse({ ...validB110, code: 'A110' })).toThrow();
    });

    it('should require non-empty required fields', () => {
      expect(() => B110Schema.parse({ ...validB110, recordNumber: '' })).toThrow();
      expect(() => B110Schema.parse({ ...validB110, vatId: '' })).toThrow();
      expect(() => B110Schema.parse({ ...validB110, accountKey: '' })).toThrow();
      expect(() => B110Schema.parse({ ...validB110, accountName: '' })).toThrow();
      expect(() => B110Schema.parse({ ...validB110, trialBalanceCode: '' })).toThrow();
      expect(() => B110Schema.parse({ ...validB110, trialBalanceCodeDescription: '' })).toThrow();
    });

    it('should allow empty optional fields', () => {
      const minimal: B110 = {
        code: 'B110',
        recordNumber: '1',
        vatId: '123456789',
        accountKey: 'ACC001',
        accountName: 'Cash Account',
        trialBalanceCode: 'TB001',
        trialBalanceCodeDescription: 'Current Assets',
        customerSupplierAddressStreet: '',
        customerSupplierAddressHouseNumber: '',
        customerSupplierAddressCity: '',
        customerSupplierAddressZip: '',
        customerSupplierAddressCountry: '',
        countryCode: '',
        parentAccountKey: '',
        accountOpeningBalance: '',
        totalDebits: '',
        totalCredits: '',
        accountingClassificationCode: '',
        supplierCustomerTaxId: '',
        branchId: '',
        openingBalanceForeignCurrency: '',
        foreignCurrencyCode: '',
        reserved: '',
      };
      expect(() => B110Schema.parse(minimal)).not.toThrow();
    });

    it('should validate numeric fields', () => {
      expect(() => B110Schema.parse({ ...validB110, recordNumber: 'abc' })).toThrow();
      expect(() => B110Schema.parse({ ...validB110, vatId: 'abc' })).toThrow();
      expect(() =>
        B110Schema.parse({ ...validB110, accountingClassificationCode: 'abc' }),
      ).toThrow();
      expect(() => B110Schema.parse({ ...validB110, supplierCustomerTaxId: 'abc' })).toThrow();
    });

    it('should enforce maximum field lengths', () => {
      expect(() => B110Schema.parse({ ...validB110, recordNumber: '1234567890' })).toThrow();
      expect(() => B110Schema.parse({ ...validB110, vatId: '1234567890' })).toThrow();
      expect(() => B110Schema.parse({ ...validB110, accountKey: 'x'.repeat(16) })).toThrow();
      expect(() => B110Schema.parse({ ...validB110, accountName: 'x'.repeat(51) })).toThrow();
      expect(() => B110Schema.parse({ ...validB110, trialBalanceCode: 'x'.repeat(16) })).toThrow();
      expect(() =>
        B110Schema.parse({ ...validB110, trialBalanceCodeDescription: 'x'.repeat(31) }),
      ).toThrow();
      expect(() =>
        B110Schema.parse({ ...validB110, customerSupplierAddressStreet: 'x'.repeat(51) }),
      ).toThrow();
      expect(() =>
        B110Schema.parse({ ...validB110, customerSupplierAddressHouseNumber: 'x'.repeat(11) }),
      ).toThrow();
      expect(() =>
        B110Schema.parse({ ...validB110, customerSupplierAddressCity: 'x'.repeat(31) }),
      ).toThrow();
      expect(() =>
        B110Schema.parse({ ...validB110, customerSupplierAddressZip: 'x'.repeat(9) }),
      ).toThrow();
      expect(() =>
        B110Schema.parse({ ...validB110, customerSupplierAddressCountry: 'x'.repeat(31) }),
      ).toThrow();
      expect(() => B110Schema.parse({ ...validB110, countryCode: 'x'.repeat(3) })).toThrow();
      expect(() => B110Schema.parse({ ...validB110, parentAccountKey: 'x'.repeat(16) })).toThrow();
      expect(() =>
        B110Schema.parse({ ...validB110, accountOpeningBalance: 'x'.repeat(16) }),
      ).toThrow();
      expect(() => B110Schema.parse({ ...validB110, totalDebits: 'x'.repeat(16) })).toThrow();
      expect(() => B110Schema.parse({ ...validB110, totalCredits: 'x'.repeat(16) })).toThrow();
      expect(() =>
        B110Schema.parse({ ...validB110, accountingClassificationCode: 'x'.repeat(5) }),
      ).toThrow();
      expect(() =>
        B110Schema.parse({ ...validB110, supplierCustomerTaxId: 'x'.repeat(10) }),
      ).toThrow();
      expect(() => B110Schema.parse({ ...validB110, branchId: 'x'.repeat(8) })).toThrow();
      expect(() =>
        B110Schema.parse({ ...validB110, openingBalanceForeignCurrency: 'x'.repeat(16) }),
      ).toThrow();
      expect(() =>
        B110Schema.parse({ ...validB110, foreignCurrencyCode: 'x'.repeat(4) }),
      ).toThrow();
      expect(() => B110Schema.parse({ ...validB110, reserved: 'x'.repeat(17) })).toThrow();
    });
  });

  describe('encodeB110', () => {
    it('should encode a valid B110 record to fixed-width format', () => {
      const encoded = encodeB110(validB110);

      // Should end with CRLF
      expect(encoded).toMatch(/\r\n$/);

      // Remove CRLF for length check
      const withoutCrlf = encoded.replace(/\r\n$/, '');
      expect(withoutCrlf).toHaveLength(376);

      // Check specific field positions
      expect(withoutCrlf.slice(0, 4)).toBe('B110'); // Record code
      expect(withoutCrlf.slice(4, 13)).toBe('000000001'); // Zero-padded record number
      expect(withoutCrlf.slice(13, 22)).toBe('123456789'); // VAT ID
      expect(withoutCrlf.slice(22, 37)).toBe('ACC001         '); // Account key (left-aligned)
      expect(withoutCrlf.slice(37, 87)).toBe('Cash Account                                      '); // Account name (left-aligned)
    });

    it('should handle numeric fields with zero padding', () => {
      const shortFields: B110 = {
        ...validB110,
        recordNumber: '42',
        vatId: '12345',
        accountingClassificationCode: '1',
        supplierCustomerTaxId: '99',
      };

      const encoded = encodeB110(shortFields);
      const withoutCrlf = encoded.replace(/\r\n$/, '');

      // Record number should be zero-padded
      expect(withoutCrlf.slice(4, 13)).toBe('000000042');
      // VAT ID should be zero-padded
      expect(withoutCrlf.slice(13, 22)).toBe('000012345');
      // Accounting classification code should be zero-padded (at position calculated from spec)
      const accClassPos =
        4 + 9 + 9 + 15 + 50 + 15 + 30 + 50 + 10 + 30 + 8 + 30 + 2 + 15 + 15 + 15 + 15;
      expect(withoutCrlf.slice(accClassPos, accClassPos + 4)).toBe('0001');
      // Supplier/Customer tax ID should be zero-padded
      const supplierTaxPos = accClassPos + 4;
      expect(withoutCrlf.slice(supplierTaxPos, supplierTaxPos + 9)).toBe('000000099');
    });

    it('should handle amount fields with right alignment', () => {
      const encoded = encodeB110(validB110);
      const withoutCrlf = encoded.replace(/\r\n$/, '');

      // Find account opening balance field position
      const openingBalancePos = 4 + 9 + 9 + 15 + 50 + 15 + 30 + 50 + 10 + 30 + 8 + 30 + 2 + 15;
      expect(withoutCrlf.slice(openingBalancePos, openingBalancePos + 15)).toBe('       10000.00'); // Right-aligned

      // Find total debits field position
      const totalDebitsPos = openingBalancePos + 15;
      expect(withoutCrlf.slice(totalDebitsPos, totalDebitsPos + 15)).toBe('       50000.00'); // Right-aligned

      // Find total credits field position
      const totalCreditsPos = totalDebitsPos + 15;
      expect(withoutCrlf.slice(totalCreditsPos, totalCreditsPos + 15)).toBe('       40000.00'); // Right-aligned
    });

    it('should pad empty fields correctly', () => {
      const minimal: B110 = {
        code: 'B110',
        recordNumber: '1',
        vatId: '123456789',
        accountKey: 'ACC001',
        accountName: 'Cash Account',
        trialBalanceCode: 'TB001',
        trialBalanceCodeDescription: 'Current Assets',
        customerSupplierAddressStreet: '',
        customerSupplierAddressHouseNumber: '',
        customerSupplierAddressCity: '',
        customerSupplierAddressZip: '',
        customerSupplierAddressCountry: '',
        countryCode: '',
        parentAccountKey: '',
        accountOpeningBalance: '',
        totalDebits: '',
        totalCredits: '',
        accountingClassificationCode: '',
        supplierCustomerTaxId: '',
        branchId: '',
        openingBalanceForeignCurrency: '',
        foreignCurrencyCode: '',
        reserved: '',
      };

      const encoded = encodeB110(minimal);
      const withoutCrlf = encoded.replace(/\r\n$/, '');

      // Should still be exactly 376 characters
      expect(withoutCrlf).toHaveLength(376);

      // Empty accounting classification code should be zero-padded
      const accClassPos =
        4 + 9 + 9 + 15 + 50 + 15 + 30 + 50 + 10 + 30 + 8 + 30 + 2 + 15 + 15 + 15 + 15;
      expect(withoutCrlf.slice(accClassPos, accClassPos + 4)).toBe('0000');

      // Empty supplier/customer tax ID should be zero-padded
      const supplierTaxPos = accClassPos + 4;
      expect(withoutCrlf.slice(supplierTaxPos, supplierTaxPos + 9)).toBe('000000000');
    });
  });

  describe('parseB110', () => {
    it('should parse a valid encoded B110 record', () => {
      const encoded = encodeB110(validB110);
      const parsed = parseB110(encoded);

      expect(parsed.code).toBe('B110');
      expect(parsed.recordNumber).toBe('1');
      expect(parsed.vatId).toBe('123456789');
      expect(parsed.accountKey).toBe('ACC001');
      expect(parsed.accountName).toBe('Cash Account');
      expect(parsed.trialBalanceCode).toBe('TB001');
      expect(parsed.trialBalanceCodeDescription).toBe('Current Assets');
      expect(parsed.customerSupplierAddressStreet).toBe('123 Main Street');
      expect(parsed.accountOpeningBalance).toBe('10000.00');
      expect(parsed.totalDebits).toBe('50000.00');
      expect(parsed.totalCredits).toBe('40000.00');
    });

    it('should handle lines without CRLF', () => {
      const encoded = encodeB110(validB110);
      const withoutCrlf = encoded.replace(/\r\n$/, '');
      const parsed = parseB110(withoutCrlf);

      expect(parsed.code).toBe(validB110.code);
      expect(parsed.recordNumber).toBe(validB110.recordNumber);
    });

    it('should throw on invalid line length', () => {
      const shortLine = 'B110   1123456789';
      expect(() => parseB110(shortLine)).toThrow('Invalid B110 record length');
    });

    it('should throw on invalid record code', () => {
      const invalidCode = 'A110' + ' '.repeat(372);
      expect(() => parseB110(invalidCode)).toThrow('Invalid B110 record code');
    });

    it('should strip leading zeros from numeric fields correctly', () => {
      // Create a line with zero-padded numeric fields
      const paddedLine =
        'B110' + // code (4)
        '000000042' + // recordNumber (9)
        '000000123' + // vatId (9)
        'ACC001         ' + // accountKey (15)
        'Cash Account                                      ' + // accountName (50)
        'TB001          ' + // trialBalanceCode (15)
        'Current Assets                ' + // trialBalanceCodeDescription (30)
        ' '.repeat(50) + // customerSupplierAddressStreet (50)
        ' '.repeat(10) + // customerSupplierAddressHouseNumber (10)
        ' '.repeat(30) + // customerSupplierAddressCity (30)
        ' '.repeat(8) + // customerSupplierAddressZip (8)
        ' '.repeat(30) + // customerSupplierAddressCountry (30)
        ' '.repeat(2) + // countryCode (2)
        ' '.repeat(15) + // parentAccountKey (15)
        ' '.repeat(15) + // accountOpeningBalance (15)
        ' '.repeat(15) + // totalDebits (15)
        ' '.repeat(15) + // totalCredits (15)
        '0099' + // accountingClassificationCode (4)
        '000000456' + // supplierCustomerTaxId (9)
        ' '.repeat(7) + // branchId (7)
        ' '.repeat(15) + // openingBalanceForeignCurrency (15)
        ' '.repeat(3) + // foreignCurrencyCode (3)
        ' '.repeat(16); // reserved (16)

      expect(paddedLine.length).toBe(376); // Verify correct length

      const parsed = parseB110(paddedLine);

      expect(parsed.recordNumber).toBe('42');
      expect(parsed.vatId).toBe('123');
      expect(parsed.accountingClassificationCode).toBe('99');
      expect(parsed.supplierCustomerTaxId).toBe('456');
    });

    it('should trim whitespace from parsed fields', () => {
      const encoded = encodeB110(validB110);
      const parsed = parseB110(encoded);

      // All string fields should be trimmed
      expect(parsed.accountName).toBe('Cash Account');
      expect(parsed.trialBalanceCode).toBe('TB001');
      expect(parsed.trialBalanceCodeDescription).toBe('Current Assets');
      expect(parsed.customerSupplierAddressStreet).toBe('123 Main Street');
      expect(parsed.accountKey).toBe('ACC001');
    });
  });

  describe('round-trip encoding/parsing', () => {
    it('should maintain data integrity through encode/parse cycle', () => {
      const original = validB110;
      const encoded = encodeB110(original);
      const parsed = parseB110(encoded);

      expect(parsed).toEqual(original);
    });

    it('should work with various field values', () => {
      const testCases: B110[] = [
        {
          ...validB110,
          recordNumber: '999999999',
          vatId: '999999999',
          accountingClassificationCode: '9999',
          supplierCustomerTaxId: '999999999',
        },
        {
          ...validB110,
          recordNumber: '1',
          vatId: '1',
          customerSupplierAddressStreet: '',
          customerSupplierAddressHouseNumber: '',
          customerSupplierAddressCity: '',
          customerSupplierAddressZip: '',
          customerSupplierAddressCountry: '',
          countryCode: '',
          parentAccountKey: '',
          accountOpeningBalance: '',
          totalDebits: '',
          totalCredits: '',
          accountingClassificationCode: '',
          supplierCustomerTaxId: '',
          branchId: '',
          openingBalanceForeignCurrency: '',
          foreignCurrencyCode: '',
          reserved: '',
        },
      ];

      for (const testCase of testCases) {
        const encoded = encodeB110(testCase);
        const parsed = parseB110(encoded);
        expect(parsed).toEqual(testCase);
      }
    });

    it('should preserve empty optional fields', () => {
      const withEmptyFields: B110 = {
        ...validB110,
        customerSupplierAddressStreet: '',
        customerSupplierAddressHouseNumber: '',
        customerSupplierAddressCity: '',
        customerSupplierAddressZip: '',
        customerSupplierAddressCountry: '',
        countryCode: '',
        parentAccountKey: '',
        accountOpeningBalance: '',
        totalDebits: '',
        totalCredits: '',
        accountingClassificationCode: '',
        supplierCustomerTaxId: '',
        branchId: '',
        openingBalanceForeignCurrency: '',
        foreignCurrencyCode: '',
        reserved: '',
      };

      const encoded = encodeB110(withEmptyFields);
      const parsed = parseB110(encoded);

      expect(parsed.customerSupplierAddressStreet).toBe('');
      expect(parsed.accountOpeningBalance).toBe('');
      expect(parsed.reserved).toBe('');
      expect(parsed).toEqual(withEmptyFields);
    });
  });

  describe('error cases', () => {
    it('should handle malformed input gracefully', () => {
      expect(() => parseB110('')).toThrow();
      expect(() => parseB110('invalid')).toThrow();
      expect(() => parseB110('B' + ' '.repeat(500))).toThrow();
    });

    it('should validate against schema after parsing', () => {
      // Create a line with empty required fields
      const invalidLine =
        'B110' +
        '000000001' +
        '123456789' +
        ' '.repeat(15) + // Empty account key (required)
        ' '.repeat(50) +
        ' '.repeat(15) +
        ' '.repeat(30) +
        ' '.repeat(50) +
        ' '.repeat(10) +
        ' '.repeat(30) +
        ' '.repeat(8) +
        ' '.repeat(30) +
        ' '.repeat(2) +
        ' '.repeat(15) +
        ' '.repeat(15) +
        ' '.repeat(15) +
        ' '.repeat(15) +
        '0000' +
        '000000000' +
        ' '.repeat(7) +
        ' '.repeat(15) +
        ' '.repeat(3) +
        ' '.repeat(16);

      expect(() => parseB110(invalidLine)).toThrow();
    });
  });
});
