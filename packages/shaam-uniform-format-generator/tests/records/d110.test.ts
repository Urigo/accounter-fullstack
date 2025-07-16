import { describe, expect, test } from 'vitest';
import { D110Schema, encodeD110, parseD110, type D110 } from '../../src/generator/records/d110';

describe('D110 Record', () => {
  const validD110: D110 = {
    code: 'D110',
    recordNumber: '1',
    vatId: '123456789',
    documentType: '001',
    documentNumber: 'DOC001',
    rowNumberInDocument: '1',
    baseDocumentType: 'BAS',
    baseDocumentNumber: 'BASE001',
    dealType: '1',
    internalKey: 'KEY001',
    soldGoodsOrServiceDescription: 'Test Item Description',
    producerName: 'Producer Name',
    producerPackagePrintedSerial: 'SERIAL123',
    unitOfMeasure: 'EA',
    quantity: '10.00',
    unitAmountExcludingVat: '100.00',
    lineDiscountAmount: '50.00',
    totalLineAmount: '1000',
    lineVatAmount: '170',
    reserved1: '',
    branchOrSectorId: 'BRANCH1',
    reserved2: '',
    documentDate: '20240101',
    headerConnectingField: 'CONN001',
    baseDocumentBranchOrSectorId: 'BASEBR1',
    reserved: '',
  };

  describe('Schema Validation', () => {
    test('validates correct D110 record', () => {
      expect(() => D110Schema.parse(validD110)).not.toThrow();
    });

    test('requires code to be "D110"', () => {
      const invalidRecord = { ...validD110, code: 'D111' as 'D110' };
      expect(() => D110Schema.parse(invalidRecord)).toThrow();
    });

    test('requires recordNumber', () => {
      const invalidRecord = { ...validD110, recordNumber: '' };
      expect(() => D110Schema.parse(invalidRecord)).toThrow();
    });

    test('requires vatId', () => {
      const invalidRecord = { ...validD110, vatId: '' };
      expect(() => D110Schema.parse(invalidRecord)).toThrow();
    });
  });

  describe('Encoding', () => {
    test('encodes D110 record to fixed-width string', () => {
      const encoded = encodeD110(validD110);

      // Should include CRLF at the end
      expect(encoded.endsWith('\r\n')).toBe(true);

      // Remove CRLF for length check
      const withoutCRLF = encoded.replace(/\r?\n$/, '');
      expect(withoutCRLF.length).toBe(339);

      // Should start with record code
      expect(encoded.startsWith('D110')).toBe(true);
    });
  });

  describe('Parsing', () => {
    test('parses valid D110 record line', () => {
      const encoded = encodeD110(validD110);
      const parsed = parseD110(encoded);

      expect(parsed).toEqual(validD110);
    });

    test('throws error for invalid record length', () => {
      const invalidLine = 'D110' + '1'.repeat(100); // Too short
      expect(() => parseD110(invalidLine)).toThrow('Invalid D110 record length');
    });
  });

  describe('Round-trip Encoding/Parsing', () => {
    test('round-trip: encode then parse equals original', () => {
      const encoded = encodeD110(validD110);
      const parsed = parseD110(encoded);

      expect(parsed).toEqual(validD110);
    });
  });
});
