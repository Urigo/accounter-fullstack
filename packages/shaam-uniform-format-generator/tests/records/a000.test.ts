import { beforeEach, describe, expect, it } from 'vitest';
import { SHAAM_VERSION } from '../../src/constants';
import {
  A000Schema,
  encodeA000,
  parseA000,
  type A000,
  type A000Input,
} from '../../src/generator/records/a000';
import { defaultKeyGenerator } from '../../src/utils/key-generator';

describe('A000 Record', () => {
  // Reset key generator before each test for consistent results
  beforeEach(() => {
    defaultKeyGenerator.reset();
  });

  const validA000Input: A000Input = {
    reservedFuture: '',
    totalRecords: '12345',
    vatId: '123456789',
    softwareRegNumber: '87654321',
    softwareName: 'Test Software',
    softwareVersion: '1.0.0',
    vendorVatId: '987654321',
    vendorName: 'Test Vendor',
    softwareType: '1',
    fileOutputPath: '/path/to/output',
    accountingType: '2',
    balanceRequired: '1',
    companyRegId: '111222333',
    withholdingFileNum: '444555666',
    reserved1017: '',
    businessName: 'Test Business Ltd',
    businessStreet: 'Main Street 123',
    businessHouseNum: '123',
    businessCity: 'Tel Aviv',
    businessZip: '12345',
    taxYear: '2024',
    startDate: '20240101',
    endDate: '20241231',
    processStartDate: '20240115',
    processStartTime: '1430',
    languageCode: '0',
    characterEncoding: '1',
    compressionSoftware: 'WinRAR',
    reserved1031: '',
    baseCurrency: 'ILS',
    reserved1033: '',
    branchInfoFlag: '0',
    reserved1035: '',
  };

  describe('Schema Validation', () => {
    it('should validate a valid A000 record', () => {
      const fullRecord: A000 = {
        code: 'A000',
        primaryIdentifier: '123456789012345',
        systemConstant: SHAAM_VERSION,
        ...validA000Input,
      };

      expect(() => A000Schema.parse(fullRecord)).not.toThrow();
    });

    it('should reject invalid record code', () => {
      const invalidRecord = {
        ...validA000Input,
        code: 'B000', // Invalid code
        primaryIdentifier: '123456789012345',
        systemConstant: SHAAM_VERSION,
      };

      expect(() => A000Schema.parse(invalidRecord)).toThrow();
    });

    it('should reject invalid software type', () => {
      const invalidRecord = {
        ...validA000Input,
        code: 'A000',
        primaryIdentifier: '123456789012345',
        systemConstant: SHAAM_VERSION,
        softwareType: '3', // Invalid software type
      };

      expect(() => A000Schema.parse(invalidRecord)).toThrow();
    });

    it('should reject invalid language code', () => {
      const invalidRecord = {
        ...validA000Input,
        code: 'A000',
        primaryIdentifier: '123456789012345',
        systemConstant: SHAAM_VERSION,
        languageCode: '9', // Invalid language code
      };

      expect(() => A000Schema.parse(invalidRecord)).toThrow();
    });

    it('should reject fields that exceed maximum length', () => {
      const invalidRecord = {
        ...validA000Input,
        code: 'A000',
        primaryIdentifier: '123456789012345',
        systemConstant: SHAAM_VERSION,
        softwareName: 'A'.repeat(21), // Exceeds 20 character limit
      };

      expect(() => A000Schema.parse(invalidRecord)).toThrow();
    });
  });

  describe('encodeA000', () => {
    it('should encode a valid A000 record to fixed-width string', () => {
      const encoded = encodeA000(validA000Input);

      // Should end with CRLF
      expect(encoded).toMatch(/\r\n$/);

      // Should have correct length (466 + 2 for CRLF)
      expect(encoded.length).toBe(468);

      // Should start with A000
      expect(encoded.slice(0, 4)).toBe('A000');

      // Should contain the system constant at the correct position (offset 48-55)
      expect(encoded.slice(48, 56)).toBe(SHAAM_VERSION);
    });

    it('should pad numeric fields with leading zeros', () => {
      const encoded = encodeA000(validA000Input);

      // VAT ID should be zero-padded to 9 digits (position 24-32)
      const vatIdField = encoded.slice(24, 33);
      expect(vatIdField).toBe('123456789');

      // Total records should be zero-padded to 15 digits (position 9-23)
      const totalRecordsField = encoded.slice(9, 24);
      expect(totalRecordsField).toBe('000000000012345');
    });

    it('should handle empty optional fields', () => {
      const inputWithEmptyFields: A000Input = {
        ...validA000Input,
        companyRegId: '',
        withholdingFileNum: '',
        businessStreet: '',
        compressionSoftware: '',
      };

      const encoded = encodeA000(inputWithEmptyFields);
      expect(encoded.length).toBe(468); // Should still have correct total length
    });
  });

  describe('parseA000', () => {
    it('should parse a valid fixed-width A000 record string', () => {
      const encoded = encodeA000(validA000Input);
      const parsed = parseA000(encoded);

      expect(parsed.code).toBe('A000');
      expect(parsed.vatId).toBe('123456789');
      expect(parsed.totalRecords).toBe('12345');
      expect(parsed.softwareName).toBe('Test Software');
      expect(parsed.businessName).toBe('Test Business Ltd');
      expect(parsed.systemConstant).toBe(SHAAM_VERSION);
    });

    it('should handle lines with and without CRLF', () => {
      const encoded = encodeA000(validA000Input);
      const withoutCRLF = encoded.replace(/\r\n$/, '');

      expect(() => parseA000(encoded)).not.toThrow();
      expect(() => parseA000(withoutCRLF)).not.toThrow();

      const parsedWithCRLF = parseA000(encoded);
      const parsedWithoutCRLF = parseA000(withoutCRLF);

      expect(parsedWithCRLF).toEqual(parsedWithoutCRLF);
    });

    it('should throw error for invalid record length', () => {
      const shortLine = 'A000' + ' '.repeat(100);
      const longLine = 'A000' + ' '.repeat(600);

      expect(() => parseA000(shortLine)).toThrow(
        'Invalid A000 record length: expected 466 characters, got 104',
      );
      expect(() => parseA000(longLine)).toThrow(
        'Invalid A000 record length: expected 466 characters, got 604',
      );
    });

    it('should throw error for invalid record code', () => {
      const validEncoded = encodeA000(validA000Input);
      const invalidLine = 'B000' + validEncoded.slice(4);

      expect(() => parseA000(invalidLine)).toThrow(
        'Invalid A000 record code: expected "A000", got "B000"',
      );
    });

    it('should throw error for invalid system constant', () => {
      const validEncoded = encodeA000(validA000Input);
      // Replace system constant with invalid value (at position 48-55)
      const invalidLine = validEncoded.slice(0, 48) + 'INVALID ' + validEncoded.slice(56);

      expect(() => parseA000(invalidLine)).toThrow(/Invalid system constant/);
    });

    it('should properly strip leading zeros from numeric fields', () => {
      const encoded = encodeA000(validA000Input);
      const parsed = parseA000(encoded);

      // These should not have leading zeros after parsing
      expect(parsed.vatId).toBe('123456789');
      expect(parsed.totalRecords).toBe('12345');
      expect(parsed.primaryIdentifier).not.toMatch(/^0+/);
    });
  });

  describe('Round-trip Tests', () => {
    it('should maintain data integrity through encode-parse round trip', () => {
      const encoded = encodeA000(validA000Input);
      const parsed = parseA000(encoded);
      const reEncoded = encodeA000(parsed);

      expect(reEncoded).toBe(encoded);
    });

    it('should preserve all field values in round trip', () => {
      const encoded = encodeA000(validA000Input);
      const parsed = parseA000(encoded);

      // Compare all input fields (excluding auto-generated ones)
      expect(parsed.reservedFuture).toBe(validA000Input.reservedFuture);
      expect(parsed.totalRecords).toBe(validA000Input.totalRecords);
      expect(parsed.vatId).toBe(validA000Input.vatId);
      expect(parsed.softwareRegNumber).toBe(validA000Input.softwareRegNumber);
      expect(parsed.softwareName).toBe(validA000Input.softwareName);
      expect(parsed.softwareVersion).toBe(validA000Input.softwareVersion);
      expect(parsed.vendorVatId).toBe(validA000Input.vendorVatId);
      expect(parsed.vendorName).toBe(validA000Input.vendorName);
      expect(parsed.softwareType).toBe(validA000Input.softwareType);
      expect(parsed.fileOutputPath).toBe(validA000Input.fileOutputPath);
      expect(parsed.accountingType).toBe(validA000Input.accountingType);
      expect(parsed.balanceRequired).toBe(validA000Input.balanceRequired);
      expect(parsed.companyRegId).toBe(validA000Input.companyRegId);
      expect(parsed.withholdingFileNum).toBe(validA000Input.withholdingFileNum);
      expect(parsed.reserved1017).toBe(validA000Input.reserved1017);
      expect(parsed.businessName).toBe(validA000Input.businessName);
      expect(parsed.businessStreet).toBe(validA000Input.businessStreet);
      expect(parsed.businessHouseNum).toBe(validA000Input.businessHouseNum);
      expect(parsed.businessCity).toBe(validA000Input.businessCity);
      expect(parsed.businessZip).toBe(validA000Input.businessZip);
      expect(parsed.taxYear).toBe(validA000Input.taxYear);
      expect(parsed.startDate).toBe(validA000Input.startDate);
      expect(parsed.endDate).toBe(validA000Input.endDate);
      expect(parsed.processStartDate).toBe(validA000Input.processStartDate);
      expect(parsed.processStartTime).toBe(validA000Input.processStartTime);
      expect(parsed.languageCode).toBe(validA000Input.languageCode);
      expect(parsed.characterEncoding).toBe(validA000Input.characterEncoding);
      expect(parsed.compressionSoftware).toBe(validA000Input.compressionSoftware);
      expect(parsed.reserved1031).toBe(validA000Input.reserved1031);
      expect(parsed.baseCurrency).toBe(validA000Input.baseCurrency);
      expect(parsed.reserved1033).toBe(validA000Input.reserved1033);
      expect(parsed.branchInfoFlag).toBe(validA000Input.branchInfoFlag);
      expect(parsed.reserved1035).toBe(validA000Input.reserved1035);
    });

    it('should handle edge cases in round trip', () => {
      const edgeCaseInput: A000Input = {
        ...validA000Input,
        reservedFuture: 'ABCDE', // Maximum length
        totalRecords: '1', // Minimum length
        vatId: '1', // Minimum length
        softwareName: 'A'.repeat(20), // Maximum length
        businessName: 'B'.repeat(50), // Maximum length
        companyRegId: '', // Empty optional field
        withholdingFileNum: '', // Empty optional field
      };

      const encoded = encodeA000(edgeCaseInput);
      const parsed = parseA000(encoded);
      const reEncoded = encodeA000(parsed);

      expect(reEncoded).toBe(encoded);
      expect(parsed.reservedFuture).toBe('ABCDE');
      expect(parsed.totalRecords).toBe('1');
      expect(parsed.vatId).toBe('1');
      expect(parsed.companyRegId).toBe('');
    });
  });

  describe('Error Handling', () => {
    it('should throw error when feeding invalid line to parseA000', () => {
      const invalidLines = [
        '', // Empty line
        'A000', // Too short
        'A000' + ' '.repeat(600), // Too long
        'XXXX' + ' '.repeat(533), // Wrong record code
      ];

      for (const line of invalidLines) {
        expect(() => parseA000(line)).toThrow();
      }
    });

    it('should validate schema after parsing', () => {
      // Create a line with invalid software type (at position 133)
      const validEncoded = encodeA000(validA000Input);
      const invalidLine = validEncoded.slice(0, 133) + '9' + validEncoded.slice(134); // Invalid software type

      expect(() => parseA000(invalidLine)).toThrow();
    });
  });
});
