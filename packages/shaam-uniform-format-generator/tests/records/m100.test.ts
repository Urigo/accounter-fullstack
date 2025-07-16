import { describe, expect, it } from 'vitest';
import { encodeM100, M100Schema, parseM100, type M100 } from '../../src/generator/records/m100';

describe('M100 Record', () => {
  const validM100: M100 = {
    code: 'M100',
    recordNumber: '123',
    vatId: '987654321',
    universalItemCode: 'UNI123456789',
    supplierItemCode: 'SUP123456789',
    internalItemCode: 'INT123456789',
    itemName: 'Test Item Name',
    classificationCode: 'CLASS123',
    classificationDescription: 'Test Classification',
    unitOfMeasure: 'יחידה',
    openingStock: '100.50',
    totalStockIn: '250.75',
    totalStockOut: '150.25',
    endPeriodCostNonBonded: '1234.56',
    endPeriodCostBonded: '5678.90',
    reserved: '',
  };

  describe('M100Schema validation', () => {
    it('should validate a correct M100 record', () => {
      expect(() => M100Schema.parse(validM100)).not.toThrow();
    });

    it('should require code to be exactly "M100"', () => {
      const invalidRecord = { ...validM100, code: 'M200' };
      expect(() => M100Schema.parse(invalidRecord)).toThrow();
    });

    it('should require recordNumber to be non-empty and max 9 characters', () => {
      expect(() => M100Schema.parse({ ...validM100, recordNumber: '' })).toThrow();
      expect(() => M100Schema.parse({ ...validM100, recordNumber: '1234567890' })).toThrow();
      expect(() => M100Schema.parse({ ...validM100, recordNumber: '123456789' })).not.toThrow();
    });

    it('should require vatId to be non-empty and max 9 characters', () => {
      expect(() => M100Schema.parse({ ...validM100, vatId: '' })).toThrow();
      expect(() => M100Schema.parse({ ...validM100, vatId: '1234567890' })).toThrow();
      expect(() => M100Schema.parse({ ...validM100, vatId: '123456789' })).not.toThrow();
    });

    it('should require internalItemCode to be non-empty and max 20 characters', () => {
      expect(() => M100Schema.parse({ ...validM100, internalItemCode: '' })).toThrow();
      expect(() => M100Schema.parse({ ...validM100, internalItemCode: 'A'.repeat(21) })).toThrow();
      expect(() =>
        M100Schema.parse({ ...validM100, internalItemCode: 'A'.repeat(20) }),
      ).not.toThrow();
    });

    it('should require itemName to be non-empty and max 50 characters', () => {
      expect(() => M100Schema.parse({ ...validM100, itemName: '' })).toThrow();
      expect(() => M100Schema.parse({ ...validM100, itemName: 'A'.repeat(51) })).toThrow();
      expect(() => M100Schema.parse({ ...validM100, itemName: 'A'.repeat(50) })).not.toThrow();
    });

    it('should require openingStock to be non-empty and max 12 characters', () => {
      expect(() => M100Schema.parse({ ...validM100, openingStock: '' })).toThrow();
      expect(() => M100Schema.parse({ ...validM100, openingStock: 'A'.repeat(13) })).toThrow();
      expect(() => M100Schema.parse({ ...validM100, openingStock: 'A'.repeat(12) })).not.toThrow();
    });

    it('should require totalStockIn to be non-empty and max 12 characters', () => {
      expect(() => M100Schema.parse({ ...validM100, totalStockIn: '' })).toThrow();
      expect(() => M100Schema.parse({ ...validM100, totalStockIn: 'A'.repeat(13) })).toThrow();
      expect(() => M100Schema.parse({ ...validM100, totalStockIn: 'A'.repeat(12) })).not.toThrow();
    });

    it('should require totalStockOut to be non-empty and max 12 characters', () => {
      expect(() => M100Schema.parse({ ...validM100, totalStockOut: '' })).toThrow();
      expect(() => M100Schema.parse({ ...validM100, totalStockOut: 'A'.repeat(13) })).toThrow();
      expect(() => M100Schema.parse({ ...validM100, totalStockOut: 'A'.repeat(12) })).not.toThrow();
    });

    it('should validate optional fields with proper length limits', () => {
      expect(() =>
        M100Schema.parse({ ...validM100, universalItemCode: 'A'.repeat(20) }),
      ).not.toThrow();
      expect(() => M100Schema.parse({ ...validM100, universalItemCode: 'A'.repeat(21) })).toThrow();
      expect(() =>
        M100Schema.parse({ ...validM100, supplierItemCode: 'A'.repeat(20) }),
      ).not.toThrow();
      expect(() => M100Schema.parse({ ...validM100, supplierItemCode: 'A'.repeat(21) })).toThrow();
      expect(() =>
        M100Schema.parse({ ...validM100, classificationCode: 'A'.repeat(10) }),
      ).not.toThrow();
      expect(() =>
        M100Schema.parse({ ...validM100, classificationCode: 'A'.repeat(11) }),
      ).toThrow();
      expect(() =>
        M100Schema.parse({ ...validM100, classificationDescription: 'A'.repeat(30) }),
      ).not.toThrow();
      expect(() =>
        M100Schema.parse({ ...validM100, classificationDescription: 'A'.repeat(31) }),
      ).toThrow();
      expect(() => M100Schema.parse({ ...validM100, unitOfMeasure: 'A'.repeat(20) })).not.toThrow();
      expect(() => M100Schema.parse({ ...validM100, unitOfMeasure: 'A'.repeat(21) })).toThrow();
      expect(() =>
        M100Schema.parse({ ...validM100, endPeriodCostNonBonded: 'A'.repeat(8) }),
      ).not.toThrow();
      expect(() =>
        M100Schema.parse({ ...validM100, endPeriodCostNonBonded: 'A'.repeat(9) }),
      ).toThrow();
      expect(() =>
        M100Schema.parse({ ...validM100, endPeriodCostBonded: 'A'.repeat(8) }),
      ).not.toThrow();
      expect(() =>
        M100Schema.parse({ ...validM100, endPeriodCostBonded: 'A'.repeat(9) }),
      ).toThrow();
      expect(() => M100Schema.parse({ ...validM100, reserved: 'A'.repeat(50) })).not.toThrow();
      expect(() => M100Schema.parse({ ...validM100, reserved: 'A'.repeat(51) })).toThrow();
    });

    it('should set default empty string for optional fields when missing', () => {
      const minimalM100: M100 = {
        code: 'M100',
        recordNumber: '1',
        vatId: '1',
        universalItemCode: '',
        supplierItemCode: '',
        internalItemCode: 'INT1',
        itemName: 'Item',
        classificationCode: '',
        classificationDescription: '',
        unitOfMeasure: '',
        openingStock: '0',
        totalStockIn: '0',
        totalStockOut: '0',
        endPeriodCostNonBonded: '',
        endPeriodCostBonded: '',
        reserved: '',
      };

      expect(() => M100Schema.parse(minimalM100)).not.toThrow();
    });
  });

  describe('encodeM100', () => {
    it('should encode a M100 record to fixed-width format', () => {
      const encoded = encodeM100(validM100);

      // Should end with CRLF
      expect(encoded).toMatch(/\r\n$/);

      // Remove CRLF for length check
      const withoutCRLF = encoded.replace(/\r\n$/, '');
      expect(withoutCRLF).toHaveLength(294);

      // Check specific field positions
      expect(withoutCRLF.slice(0, 4)).toBe('M100'); // code (4)
      expect(withoutCRLF.slice(4, 13)).toBe('000000123'); // recordNumber zero-padded (9)
      expect(withoutCRLF.slice(13, 22)).toBe('987654321'); // vatId zero-padded (9)
      expect(withoutCRLF.slice(22, 42)).toBe('UNI123456789        '); // universalItemCode left-aligned (20)
      expect(withoutCRLF.slice(42, 62)).toBe('SUP123456789        '); // supplierItemCode left-aligned (20)
      expect(withoutCRLF.slice(62, 82)).toBe('INT123456789        '); // internalItemCode left-aligned (20)
      expect(withoutCRLF.slice(82, 132)).toBe('Test Item Name' + ' '.repeat(36)); // itemName left-aligned (50)
      expect(withoutCRLF.slice(132, 142)).toBe('CLASS123  '); // classificationCode left-aligned (10)
      expect(withoutCRLF.slice(142, 172)).toBe('Test Classification' + ' '.repeat(11)); // classificationDescription left-aligned (30)
      expect(withoutCRLF.slice(172, 192)).toBe('יחידה' + ' '.repeat(15)); // unitOfMeasure left-aligned (20)
      expect(withoutCRLF.slice(192, 204)).toBe('100.50      '); // openingStock left-aligned (12)
      expect(withoutCRLF.slice(204, 216)).toBe('250.75      '); // totalStockIn left-aligned (12)
      expect(withoutCRLF.slice(216, 228)).toBe('150.25      '); // totalStockOut left-aligned (12)
      expect(withoutCRLF.slice(228, 236)).toBe('1234.56 '); // endPeriodCostNonBonded left-aligned (8)
      expect(withoutCRLF.slice(236, 244)).toBe('5678.90 '); // endPeriodCostBonded left-aligned (8)
      expect(withoutCRLF.slice(244, 294)).toBe(' '.repeat(50)); // reserved left-aligned (50)
    });

    it('should handle maximum length fields', () => {
      const maxLengthRecord: M100 = {
        code: 'M100',
        recordNumber: '123456789', // 9 chars
        vatId: '123456789', // 9 chars
        universalItemCode: 'A'.repeat(20), // 20 chars
        supplierItemCode: 'B'.repeat(20), // 20 chars
        internalItemCode: 'C'.repeat(20), // 20 chars
        itemName: 'D'.repeat(50), // 50 chars
        classificationCode: 'E'.repeat(10), // 10 chars
        classificationDescription: 'F'.repeat(30), // 30 chars
        unitOfMeasure: 'G'.repeat(20), // 20 chars
        openingStock: 'H'.repeat(12), // 12 chars
        totalStockIn: 'I'.repeat(12), // 12 chars
        totalStockOut: 'J'.repeat(12), // 12 chars
        endPeriodCostNonBonded: 'K'.repeat(8), // 8 chars
        endPeriodCostBonded: 'L'.repeat(8), // 8 chars
        reserved: 'M'.repeat(50), // 50 chars
      };

      const encoded = encodeM100(maxLengthRecord);
      const withoutCRLF = encoded.replace(/\r\n$/, '');
      expect(withoutCRLF).toHaveLength(294);

      expect(withoutCRLF.slice(0, 4)).toBe('M100');
      expect(withoutCRLF.slice(4, 13)).toBe('123456789');
      expect(withoutCRLF.slice(13, 22)).toBe('123456789');
      expect(withoutCRLF.slice(22, 42)).toBe('A'.repeat(20));
      expect(withoutCRLF.slice(42, 62)).toBe('B'.repeat(20));
      expect(withoutCRLF.slice(62, 82)).toBe('C'.repeat(20));
      expect(withoutCRLF.slice(82, 132)).toBe('D'.repeat(50));
      expect(withoutCRLF.slice(132, 142)).toBe('E'.repeat(10));
      expect(withoutCRLF.slice(142, 172)).toBe('F'.repeat(30));
      expect(withoutCRLF.slice(172, 192)).toBe('G'.repeat(20));
      expect(withoutCRLF.slice(192, 204)).toBe('H'.repeat(12));
      expect(withoutCRLF.slice(204, 216)).toBe('I'.repeat(12));
      expect(withoutCRLF.slice(216, 228)).toBe('J'.repeat(12));
      expect(withoutCRLF.slice(228, 236)).toBe('K'.repeat(8));
      expect(withoutCRLF.slice(236, 244)).toBe('L'.repeat(8));
      expect(withoutCRLF.slice(244, 294)).toBe('M'.repeat(50));
    });

    it('should truncate fields that exceed maximum length', () => {
      const oversizedRecord: M100 = {
        code: 'M100',
        recordNumber: '1234567890', // 10 chars (max 9)
        vatId: '1234567890', // 10 chars (max 9)
        universalItemCode: 'A'.repeat(25), // 25 chars (max 20)
        supplierItemCode: 'B'.repeat(25), // 25 chars (max 20)
        internalItemCode: 'C'.repeat(25), // 25 chars (max 20)
        itemName: 'D'.repeat(55), // 55 chars (max 50)
        classificationCode: 'E'.repeat(15), // 15 chars (max 10)
        classificationDescription: 'F'.repeat(35), // 35 chars (max 30)
        unitOfMeasure: 'G'.repeat(25), // 25 chars (max 20)
        openingStock: 'H'.repeat(15), // 15 chars (max 12)
        totalStockIn: 'I'.repeat(15), // 15 chars (max 12)
        totalStockOut: 'J'.repeat(15), // 15 chars (max 12)
        endPeriodCostNonBonded: 'K'.repeat(10), // 10 chars (max 8)
        endPeriodCostBonded: 'L'.repeat(10), // 10 chars (max 8)
        reserved: 'M'.repeat(60), // 60 chars (max 50)
      };

      const encoded = encodeM100(oversizedRecord);
      const withoutCRLF = encoded.replace(/\r\n$/, '');
      expect(withoutCRLF).toHaveLength(294);

      expect(withoutCRLF.slice(4, 13)).toBe('123456789'); // truncated from right
      expect(withoutCRLF.slice(13, 22)).toBe('123456789'); // truncated
      expect(withoutCRLF.slice(22, 42)).toBe('A'.repeat(20)); // truncated
      expect(withoutCRLF.slice(244, 294)).toBe('M'.repeat(50)); // truncated
    });
  });

  describe('parseM100', () => {
    it('should parse a valid M100 record line', () => {
      // Use the actual encoded output from our valid record
      const encoded = encodeM100(validM100);
      const parsed = parseM100(encoded);

      expect(parsed).toEqual(validM100);
    });

    it('should parse line without CRLF', () => {
      // Create a minimal valid record
      const minimalRecord: M100 = {
        code: 'M100',
        recordNumber: '123',
        vatId: '987654321',
        universalItemCode: '',
        supplierItemCode: '',
        internalItemCode: 'INT123456789',
        itemName: 'Item Name',
        classificationCode: '',
        classificationDescription: '',
        unitOfMeasure: '',
        openingStock: '100',
        totalStockIn: '200',
        totalStockOut: '300',
        endPeriodCostNonBonded: '',
        endPeriodCostBonded: '',
        reserved: '',
      };
      const encoded = encodeM100(minimalRecord);
      const lineWithoutCRLF = encoded.replace(/\r\n$/, '');
      const parsed = parseM100(lineWithoutCRLF);

      expect(parsed).toEqual(minimalRecord);
    });

    it('should throw error for invalid line length', () => {
      const shortLine = 'M100' + ' '.repeat(50);
      expect(() => parseM100(shortLine)).toThrow(
        'Invalid M100 record length: expected 294 characters, got 54',
      );

      const longLine = 'M100' + ' '.repeat(400);
      expect(() => parseM100(longLine)).toThrow(
        'Invalid M100 record length: expected 294 characters, got 404',
      );
    });

    it('should throw error for invalid record code', () => {
      const invalidLine = 'M200' + ' '.repeat(290) + '\r\n';
      expect(() => parseM100(invalidLine)).toThrow(
        'Invalid M100 record code: expected "M100", got "M200"',
      );
    });

    it('should handle fields with leading zeros correctly', () => {
      // Create a record with numeric fields that might have leading zeros
      const recordWithLeadingZeros: M100 = {
        code: 'M100',
        recordNumber: '123',
        vatId: '000123456',
        universalItemCode: '',
        supplierItemCode: '',
        internalItemCode: 'INT123456789',
        itemName: 'Item Name',
        classificationCode: '',
        classificationDescription: '',
        unitOfMeasure: '',
        openingStock: '100',
        totalStockIn: '200',
        totalStockOut: '300',
        endPeriodCostNonBonded: '00001234',
        endPeriodCostBonded: '00005678',
        reserved: '',
      };
      const encoded = encodeM100(recordWithLeadingZeros);
      const parsed = parseM100(encoded);

      // After parsing, leading zeros should be removed from numeric fields
      expect(parsed.vatId).toBe('123456');
      expect(parsed.endPeriodCostNonBonded).toBe('1234');
      expect(parsed.endPeriodCostBonded).toBe('5678');
    });

    it('should handle empty optional fields correctly', () => {
      const emptyFieldsRecord: M100 = {
        code: 'M100',
        recordNumber: '123',
        vatId: '000123456',
        universalItemCode: '',
        supplierItemCode: '',
        internalItemCode: 'INT123456789',
        itemName: 'Item Name',
        classificationCode: '',
        classificationDescription: '',
        unitOfMeasure: '',
        openingStock: '100',
        totalStockIn: '200',
        totalStockOut: '300',
        endPeriodCostNonBonded: '',
        endPeriodCostBonded: '',
        reserved: '',
      };
      const encoded = encodeM100(emptyFieldsRecord);
      const parsed = parseM100(encoded);

      expect(parsed.universalItemCode).toBe('');
      expect(parsed.supplierItemCode).toBe('');
      expect(parsed.classificationCode).toBe('');
      expect(parsed.classificationDescription).toBe('');
      expect(parsed.unitOfMeasure).toBe('');
      expect(parsed.endPeriodCostNonBonded).toBe('');
      expect(parsed.endPeriodCostBonded).toBe('');
      expect(parsed.reserved).toBe('');
    });
  });

  describe('Round-trip encoding and parsing', () => {
    it('should maintain data integrity through encode -> parse cycle', () => {
      const original = validM100;
      const encoded = encodeM100(original);
      const parsed = parseM100(encoded);

      expect(parsed).toEqual(original);
    });

    it('should handle round-trip with maximum length fields', () => {
      const original: M100 = {
        code: 'M100',
        recordNumber: '999999999',
        vatId: '999888777',
        universalItemCode: 'UNI' + 'A'.repeat(17), // exactly 20 chars
        supplierItemCode: 'SUP' + 'B'.repeat(17), // exactly 20 chars
        internalItemCode: 'INT' + 'C'.repeat(17), // exactly 20 chars
        itemName: 'Item Name ' + 'D'.repeat(40), // exactly 50 chars
        classificationCode: 'CLASS' + 'E'.repeat(5), // exactly 10 chars
        classificationDescription: 'Description ' + 'F'.repeat(18), // exactly 30 chars
        unitOfMeasure: 'Unit ' + 'G'.repeat(15), // exactly 20 chars (not 16)
        openingStock: '999999999.99',
        totalStockIn: '888888888.88',
        totalStockOut: '777777777.77',
        endPeriodCostNonBonded: '99999.99',
        endPeriodCostBonded: '88888.88',
        reserved: 'Reserved ' + 'M'.repeat(41), // exactly 50 chars
      };

      const encoded = encodeM100(original);
      const parsed = parseM100(encoded);

      expect(parsed).toEqual(original);
    });

    it('should handle round-trip with minimal fields', () => {
      const original: M100 = {
        code: 'M100',
        recordNumber: '1',
        vatId: '1',
        universalItemCode: '',
        supplierItemCode: '',
        internalItemCode: 'I',
        itemName: 'N',
        classificationCode: '',
        classificationDescription: '',
        unitOfMeasure: '',
        openingStock: '0',
        totalStockIn: '0',
        totalStockOut: '0',
        endPeriodCostNonBonded: '',
        endPeriodCostBonded: '',
        reserved: '',
      };

      const encoded = encodeM100(original);
      const parsed = parseM100(encoded);

      expect(parsed).toEqual(original);
    });
  });

  describe('Error handling', () => {
    it('should throw validation error for invalid parsed data', () => {
      // Create a line that parses but fails schema validation
      const invalidLine = 'M100         ' + ' '.repeat(281); // empty recordNumber
      expect(() => parseM100(invalidLine)).toThrow();
    });

    it('should throw error when feeding wrong length line', () => {
      const wrongLengthLine = 'M100' + ' '.repeat(100); // 104 chars instead of 294
      expect(() => parseM100(wrongLengthLine)).toThrow(
        'Invalid M100 record length: expected 294 characters, got 104',
      );
    });
  });
});
