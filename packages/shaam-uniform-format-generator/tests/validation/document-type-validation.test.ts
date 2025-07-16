import { describe, expect, test } from 'vitest';
import { ZodError } from 'zod';
import { B100Schema, type B100 } from '../../src/generator/records/b100';
import { C100Schema, type C100 } from '../../src/generator/records/c100';
import { D110Schema, type D110 } from '../../src/generator/records/d110';
import { D120Schema, type D120 } from '../../src/generator/records/d120';
import { DocumentTypeEnum, type DocumentType } from '../../src/types/index';

describe('Document Type Field Validation', () => {
  // Valid document types for testing
  const validDocumentTypes: DocumentType[] = [
    '100',
    '200',
    '210',
    '300',
    '305',
    '320',
    '325',
    '330',
    '340',
    '400',
    '410',
    '420',
    '430',
    '500',
    '600',
    '700',
    '710',
  ];

  // Invalid document types for testing
  const invalidDocumentTypes = [
    '001',
    '1',
    '01',
    '999',
    '123',
    '555',
    '777',
    '800',
    '900',
    'ABC',
    'invalid',
    '',
    '0',
    '99',
    '1000',
  ];

  describe('Field 1203: C100 Document Type Validation', () => {
    const baseC100: C100 = {
      code: 'C100',
      recordNumber: '1',
      vatId: '123456789',
      documentType: '300', // Will be replaced in tests
      documentId: 'DOC123',
      documentIssueDate: '20240101',
      documentIssueTime: '1200',
      customerName: 'Test Customer',
      customerStreet: 'Test Street',
      customerHouseNumber: '123',
      customerCity: 'Test City',
      customerPostCode: '12345',
      customerCountry: 'Israel',
      customerCountryCode: 'IL',
      customerPhone: '123456789',
      customerVatId: '987654321',
      documentValueDate: '20240101',
      foreignCurrencyAmount: '1000.00',
      currencyCode: 'USD',
      amountBeforeDiscount: '1000.00',
      documentDiscount: '0.00',
      amountAfterDiscountExcludingVat: '1000.00',
      vatAmount: '170.00',
      amountIncludingVat: '1170.00',
      withholdingTaxAmount: '0.00',
      customerKey: 'CUST001',
      matchingField: 'MATCH001',
      cancelledAttribute1: '',
      cancelledDocument: 'N',
      cancelledAttribute2: '',
      documentDate: '2024011',
      branchKey: 'BRANCH01',
      cancelledAttribute3: '',
      actionExecutor: 'USER001',
      lineConnectingField: '',
      reserved: '',
    };

    test('should accept all valid document types', () => {
      for (const docType of validDocumentTypes) {
        const testRecord = { ...baseC100, documentType: docType };
        expect(
          () => C100Schema.parse(testRecord),
          `Failed for document type: ${docType}`,
        ).not.toThrow();
      }
    });

    test('should reject all invalid document types', () => {
      for (const docType of invalidDocumentTypes) {
        const testRecord = { ...baseC100, documentType: docType as DocumentType };
        expect(
          () => C100Schema.parse(testRecord),
          `Should fail for document type: ${docType}`,
        ).toThrow(ZodError);
      }
    });

    test('should provide meaningful error messages for invalid document types', () => {
      const testRecord = { ...baseC100, documentType: '999' as DocumentType };
      try {
        C100Schema.parse(testRecord);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError);
        const zodError = error as ZodError;
        expect(zodError.errors[0].path).toEqual(['documentType']);
        expect(zodError.errors[0].code).toBe('invalid_enum_value');
        expect(zodError.errors[0].message).toContain('Invalid enum value');
      }
    });
  });

  describe('Field 1253: D110 Document Type Validation', () => {
    const baseD110: D110 = {
      code: 'D110',
      recordNumber: '1',
      vatId: '123456789',
      documentType: '300', // Will be replaced in tests
      documentNumber: 'DOC123',
      lineNumber: '1',
      baseDocumentType: '',
      baseDocumentNumber: '',
      transactionType: '1',
      internalCatalogCode: 'CAT001',
      goodsServiceDescription: 'Test Item',
      manufacturerName: 'Test Manufacturer',
      serialNumber: 'SERIAL123',
      unitOfMeasureDescription: 'EA',
      quantity: '10.00',
      unitPriceExcludingVat: '100.00',
      lineDiscount: '0.00',
      lineTotal: '1000',
      vatRatePercent: '17',
      reserved1: '',
      branchId: 'BRANCH1',
      reserved2: '',
      documentDate: '20240101',
      headerLinkField: '1234567',
      baseDocumentBranchId: 'BASEBR1',
      reserved3: '',
    };

    test('should accept all valid document types', () => {
      for (const docType of validDocumentTypes) {
        const testRecord = { ...baseD110, documentType: docType };
        expect(
          () => D110Schema.parse(testRecord),
          `Failed for document type: ${docType}`,
        ).not.toThrow();
      }
    });

    test('should reject all invalid document types', () => {
      for (const docType of invalidDocumentTypes) {
        const testRecord = { ...baseD110, documentType: docType as DocumentType };
        expect(
          () => D110Schema.parse(testRecord),
          `Should fail for document type: ${docType}`,
        ).toThrow(ZodError);
      }
    });
  });

  describe('Field 1256: D110 Base Document Type Validation', () => {
    const baseD110: D110 = {
      code: 'D110',
      recordNumber: '1',
      vatId: '123456789',
      documentType: '300',
      documentNumber: 'DOC123',
      lineNumber: '1',
      baseDocumentType: '100', // Will be replaced in tests
      baseDocumentNumber: 'BASE123',
      transactionType: '1',
      internalCatalogCode: 'CAT001',
      goodsServiceDescription: 'Test Item',
      manufacturerName: 'Test Manufacturer',
      serialNumber: 'SERIAL123',
      unitOfMeasureDescription: 'EA',
      quantity: '10.00',
      unitPriceExcludingVat: '100.00',
      lineDiscount: '0.00',
      lineTotal: '1000',
      vatRatePercent: '17',
      reserved1: '',
      branchId: 'BRANCH1',
      reserved2: '',
      documentDate: '20240101',
      headerLinkField: '1234567',
      baseDocumentBranchId: 'BASEBR1',
      reserved3: '',
    };

    test('should accept all valid base document types', () => {
      for (const docType of validDocumentTypes) {
        const testRecord = { ...baseD110, baseDocumentType: docType };
        expect(
          () => D110Schema.parse(testRecord),
          `Failed for base document type: ${docType}`,
        ).not.toThrow();
      }
    });

    test('should accept empty base document type', () => {
      const testRecord = { ...baseD110, baseDocumentType: '' };
      expect(() => D110Schema.parse(testRecord)).not.toThrow();
    });

    test('should reject invalid base document types', () => {
      // Only test with values that would fail the regex first
      const invalidValues = ['abc', '99999', 'X01', '12X'];

      for (const docType of invalidValues) {
        const testRecord = { ...baseD110, baseDocumentType: docType };
        expect(
          () => D110Schema.parse(testRecord),
          `Should fail for base document type: ${docType}`,
        ).toThrow(ZodError);
      }
    });
  });

  describe('Field 1303: D120 Document Type Validation', () => {
    const baseD120: D120 = {
      code: 'D120',
      recordNumber: '1',
      vatId: '123456789',
      documentType: '300', // Will be replaced in tests
      documentNumber: 'DOC123',
      lineNumber: '1',
      paymentMethod: '1',
      bankNumber: '',
      branchNumber: '',
      accountNumber: '',
      checkNumber: '',
      paymentDueDate: '20240101',
      lineAmount: '1000.00',
      acquirerCode: '1',
      cardBrand: 'VISA',
      creditTransactionType: '1',
      firstPaymentAmount: '',
      installmentsCount: '',
      additionalPaymentAmount: '',
      reserved1: '',
      branchId: 'BR001',
      reserved2: '',
      documentDate: '20240101',
      headerLinkField: '1',
      reserved: '',
    };

    test('should accept all valid document types', () => {
      for (const docType of validDocumentTypes) {
        const testRecord = { ...baseD120, documentType: docType };
        expect(
          () => D120Schema.parse(testRecord),
          `Failed for document type: ${docType}`,
        ).not.toThrow();
      }
    });

    test('should reject all invalid document types', () => {
      for (const docType of invalidDocumentTypes) {
        const testRecord = { ...baseD120, documentType: docType as DocumentType };
        expect(
          () => D120Schema.parse(testRecord),
          `Should fail for document type: ${docType}`,
        ).toThrow(ZodError);
      }
    });
  });

  describe('Field 1358: B100 Reference Document Type Validation', () => {
    const baseB100: B100 = {
      code: 'B100',
      recordNumber: '1',
      vatId: '123456789',
      transactionNumber: '1234567890',
      transactionLineNumber: '1',
      batchNumber: '12345678',
      transactionType: 'Sale',
      referenceDocument: 'REF123',
      referenceDocumentType: '100', // Will be replaced in tests
      referenceDocument2: '',
      referenceDocumentType2: '',
      details: 'Test transaction',
      date: '20240101',
      valueDate: '20240101',
      accountKey: 'ACC001',
      counterAccountKey: 'ACC002',
      debitCreditIndicator: '1',
      currencyCode: 'ILS',
      transactionAmount: '1000.00',
      foreignCurrencyAmount: '1000.00',
      quantityField: '1.00',
      matchingField1: 'MATCH001',
      matchingField2: 'MATCH002',
      branchId: 'BR001',
      entryDate: '20240101',
      operatorUsername: 'operator1',
      reserved: '',
    };

    test('should accept all valid reference document types', () => {
      for (const docType of validDocumentTypes) {
        const testRecord = { ...baseB100, referenceDocumentType: docType };
        expect(
          () => B100Schema.parse(testRecord),
          `Failed for reference document type: ${docType}`,
        ).not.toThrow();
      }
    });

    test('should accept empty reference document type', () => {
      const testRecord = { ...baseB100, referenceDocumentType: '' };
      expect(() => B100Schema.parse(testRecord)).not.toThrow();
    });

    test('should reject invalid reference document types', () => {
      // Only test with values that would fail the regex first
      const invalidValues = ['abc', '99999', 'X01', '12X'];

      for (const docType of invalidValues) {
        const testRecord = { ...baseB100, referenceDocumentType: docType };
        expect(
          () => B100Schema.parse(testRecord),
          `Should fail for reference document type: ${docType}`,
        ).toThrow(ZodError);
      }
    });
  });

  describe('Field 1360: B100 Reference Document Type 2 Validation', () => {
    const baseB100: B100 = {
      code: 'B100',
      recordNumber: '1',
      vatId: '123456789',
      transactionNumber: '1234567890',
      transactionLineNumber: '1',
      batchNumber: '12345678',
      transactionType: 'Sale',
      referenceDocument: 'REF123',
      referenceDocumentType: '',
      referenceDocument2: 'REF456',
      referenceDocumentType2: '200', // Will be replaced in tests
      details: 'Test transaction',
      date: '20240101',
      valueDate: '20240101',
      accountKey: 'ACC001',
      counterAccountKey: 'ACC002',
      debitCreditIndicator: '1',
      currencyCode: 'ILS',
      transactionAmount: '1000.00',
      foreignCurrencyAmount: '1000.00',
      quantityField: '1.00',
      matchingField1: 'MATCH001',
      matchingField2: 'MATCH002',
      branchId: 'BR001',
      entryDate: '20240101',
      operatorUsername: 'operator1',
      reserved: '',
    };

    test('should accept all valid reference document types 2', () => {
      for (const docType of validDocumentTypes) {
        const testRecord = { ...baseB100, referenceDocumentType2: docType };
        expect(
          () => B100Schema.parse(testRecord),
          `Failed for reference document type 2: ${docType}`,
        ).not.toThrow();
      }
    });

    test('should accept empty reference document type 2', () => {
      const testRecord = { ...baseB100, referenceDocumentType2: '' };
      expect(() => B100Schema.parse(testRecord)).not.toThrow();
    });

    test('should reject invalid reference document types 2', () => {
      // Only test with values that would fail the regex first
      const invalidValues = ['abc', '99999', 'X01', '12X'];

      for (const docType of invalidValues) {
        const testRecord = { ...baseB100, referenceDocumentType2: docType };
        expect(
          () => B100Schema.parse(testRecord),
          `Should fail for reference document type 2: ${docType}`,
        ).toThrow(ZodError);
      }
    });
  });

  describe('DocumentTypeEnum Direct Validation', () => {
    test('should accept all valid document types', () => {
      for (const docType of validDocumentTypes) {
        expect(
          () => DocumentTypeEnum.parse(docType),
          `Failed for document type: ${docType}`,
        ).not.toThrow();
      }
    });

    test('should reject all invalid document types', () => {
      for (const docType of invalidDocumentTypes) {
        expect(
          () => DocumentTypeEnum.parse(docType),
          `Should fail for document type: ${docType}`,
        ).toThrow(ZodError);
      }
    });

    test('should provide complete list of valid options in error message', () => {
      try {
        DocumentTypeEnum.parse('invalid');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ZodError);
        const zodError = error as ZodError;
        expect(zodError.errors[0].code).toBe('invalid_enum_value');
        expect(zodError.errors[0].message).toContain('Invalid enum value');

        // Check that all valid options are listed
        const errorMessage = zodError.errors[0].message;
        for (const validType of validDocumentTypes) {
          expect(errorMessage).toContain(`'${validType}'`);
        }
      }
    });
  });

  describe('Cross-Record Document Type Consistency', () => {
    test('should use same validation across all record types', () => {
      const testDocType = '305';

      // Test C100
      const c100: Partial<C100> = {
        code: 'C100',
        recordNumber: '1',
        vatId: '123456789',
        documentType: testDocType,
        documentId: 'DOC123',
        documentIssueDate: '20240101',
      };

      // Test D110
      const d110: Partial<D110> = {
        code: 'D110',
        recordNumber: '1',
        vatId: '123456789',
        documentType: testDocType,
        documentNumber: 'DOC123',
        lineNumber: '1',
        baseDocumentType: testDocType,
        goodsServiceDescription: 'Test',
      };

      // Test D120
      const d120: Partial<D120> = {
        code: 'D120',
        recordNumber: '1',
        vatId: '123456789',
        documentType: testDocType,
        documentNumber: 'DOC123',
        lineNumber: '1',
        paymentMethod: '1',
      };

      // Test B100
      const b100: Partial<B100> = {
        code: 'B100',
        recordNumber: '1',
        vatId: '123456789',
        referenceDocumentType: testDocType,
        referenceDocumentType2: testDocType,
        date: '20240101',
        valueDate: '20240101',
      };

      // All should accept the same valid document type
      expect(() => C100Schema.partial().parse(c100)).not.toThrow();
      expect(() => D110Schema.partial().parse(d110)).not.toThrow();
      expect(() => D120Schema.partial().parse(d120)).not.toThrow();
      expect(() => B100Schema.partial().parse(b100)).not.toThrow();
    });

    test('should reject same invalid document type across all record types', () => {
      const invalidDocType = '999';

      const records = [
        {
          schema: C100Schema.partial(),
          record: { code: 'C100' as const, documentType: invalidDocType },
        },
        {
          schema: D110Schema.partial(),
          record: { code: 'D110' as const, documentType: invalidDocType },
        },
        {
          schema: D120Schema.partial(),
          record: { code: 'D120' as const, documentType: invalidDocType },
        },
      ];

      for (const { schema, record } of records) {
        expect(() => schema.parse(record), `Should fail for ${record.code}`).toThrow(ZodError);
      }
    });
  });
});
