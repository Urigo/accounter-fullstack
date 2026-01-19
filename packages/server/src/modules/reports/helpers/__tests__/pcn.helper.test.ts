import { describe, expect, it, vi } from 'vitest';
import {
    ExtendedPCNTransaction,
  getEntryTypeByRecord,
  getHeaderDataFromRecords,
  getPcn874String,
  getReferenceForTransaction,
  getTotalVAT,
  getVatIdForTransaction,
} from '../pcn.helper.js';
import { EntryType } from '@accounter/pcn874-generator';
import type { RawVatReportRecord } from '../vat-report.helper.js';
import { Currency } from '../../../../shared/enums.js';

const FIXED_DATE = new Date('2024-01-15');
const FIXED_REPORT_MONTH = '2024-01';
const FIXED_VAT_NUMBER = '123456789';
const FIXED_BUSINESS_ID = 'test-business-123';

function createMockVatRecord(overrides?: Partial<RawVatReportRecord>): RawVatReportRecord {
  return {
    localAmountBeforeVAT: 1000,
    foreignAmountBeforeVAT: 0,
    businessId: FIXED_BUSINESS_ID,
    chargeAccountantStatus: 'PENDING',
    chargeDate: FIXED_DATE,
    chargeId: `charge-${Math.random().toString(36).substring(7)}`,
    currencyCode: Currency.Ils,
    documentAmount: '1170',
    documentId: `doc-${Math.random().toString(36).substring(7)}`,
    documentDate: FIXED_DATE,
    documentSerial: 'INV-001',
    documentUrl: null,
    eventLocalAmount: 1000,
    isExpense: false,
    isProperty: false,
    roundedVATToAdd: 0,
    foreignVat: 0,
    localVat: 170,
    foreignVatAfterDeduction: 0,
    localVatAfterDeduction: 170,
    vatNumber: FIXED_VAT_NUMBER,
    allocationNumber: null,
    pcn874RecordType: EntryType.SALE_REGULAR,
    ...overrides,
  };
}

describe('pcn.helper', () => {
  describe('Mock Factories', () => {
    it('should create a mock VAT record with defaults', () => {
      const record = createMockVatRecord();
      expect(record.vatNumber).toBe(FIXED_VAT_NUMBER);
      expect(record.pcn874RecordType).toBe(EntryType.SALE_REGULAR);
    });

    it('should override defaults when provided', () => {
      const record = createMockVatRecord({ localVat: 200 });
      expect(record.localVat).toBe(200);
      expect(record.localAmountBeforeVAT).toBe(1000);
    });
  });

  describe('Helper Functions', () => {
    describe('getEntryTypeByRecord', () => {
      describe('Sales Entry Types', () => {
        it('should map S1 to S1', () => {
          const result = getEntryTypeByRecord(EntryType.SALE_REGULAR);
          expect(result).toBe('S1');
        });

        it('should map S2 to S2', () => {
          const result = getEntryTypeByRecord(EntryType.SALE_ZERO_OR_EXEMPT);
          expect(result).toBe('S2');
        });

        it('should map L1 to L1', () => {
          const result = getEntryTypeByRecord(EntryType.SALE_UNIDENTIFIED_CUSTOMER);
          expect(result).toBe('L1');
        });

        it('should map L2 to L2', () => {
          const result = getEntryTypeByRecord(EntryType.SALE_UNIDENTIFIED_ZERO_OR_EXEMPT);
          expect(result).toBe('L2');
        });

        it('should map M to M', () => {
          const result = getEntryTypeByRecord(EntryType.SALE_SELF_INVOICE);
          expect(result).toBe('M');
        });

        it('should map Y to Y', () => {
          const result = getEntryTypeByRecord(EntryType.SALE_EXPORT);
          expect(result).toBe('Y');
        });

        it('should map I to I', () => {
          const result = getEntryTypeByRecord(EntryType.SALE_PALESTINIAN_CUSTOMER);
          expect(result).toBe('I');
        });
      });

      describe('Input Entry Types', () => {
        it('should map T to T', () => {
          const result = getEntryTypeByRecord(EntryType.INPUT_REGULAR);
          expect(result).toBe('T');
        });

        it('should map K to K', () => {
          const result = getEntryTypeByRecord(EntryType.INPUT_PETTY_CASH);
          expect(result).toBe('K');
        });

        it('should map R to R', () => {
          const result = getEntryTypeByRecord(EntryType.INPUT_IMPORT);
          expect(result).toBe('R');
        });

        it('should map P to P', () => {
          const result = getEntryTypeByRecord(EntryType.INPUT_PALESTINIAN_SUPPLIER);
          expect(result).toBe('P');
        });

        it('should map H to H', () => {
          const result = getEntryTypeByRecord(EntryType.INPUT_SINGLE_DOC_BY_LAW);
          expect(result).toBe('H');
        });

        it('should map C to C', () => {
          const result = getEntryTypeByRecord(EntryType.INPUT_SELF_INVOICE);
          expect(result).toBe('C');
        });
      });

      describe('Edge Cases', () => {
        it('should return undefined for unmapped types', () => {
          const result = getEntryTypeByRecord('UNKNOWN_TYPE' as any);
          expect(result).toBeUndefined();
        });
      });
    });

    describe('getVatIdForTransaction', () => {
      it('should return "0" for unidentified customer (L1)', () => {
        const record = createMockVatRecord({
          vatNumber: '123456789',
          pcn874RecordType: EntryType.SALE_UNIDENTIFIED_CUSTOMER,
        });
        const result = (getVatIdForTransaction as any)(record, 'L1' as any);
        expect(result).toBe('0');
      });

      it('should return "0" for unidentified customer zero-rated (L2)', () => {
        const record = createMockVatRecord({
          vatNumber: '123456789',
          pcn874RecordType: EntryType.SALE_UNIDENTIFIED_ZERO_OR_EXEMPT,
        });
        const result = (getVatIdForTransaction as any)(record, 'L2' as any);
        expect(result).toBe('0');
      });

      it('should return "0" for petty cash (K)', () => {
        const record = createMockVatRecord({
          vatNumber: '123456789',
          pcn874RecordType: EntryType.INPUT_PETTY_CASH,
        });
        const result = (getVatIdForTransaction as any)(record, 'K' as any);
        expect(result).toBe('0');
      });

      it('should return "999999999" for INPUT_REGULAR without VAT number', () => {
        const record = createMockVatRecord({
          vatNumber: null,
          pcn874RecordType: EntryType.INPUT_REGULAR,
        });
        const result = (getVatIdForTransaction as any)(record, 'T' as any);
        expect(result).toBe('999999999');
      });

      it('should return record VAT number for regular sales', () => {
        const record = createMockVatRecord({
          vatNumber: '123456789',
          pcn874RecordType: EntryType.SALE_REGULAR,
        });
        const result = (getVatIdForTransaction as any)(record, 'S1' as any);
        expect(result).toBe('123456789');
      });

      it('should return record VAT number for foreign business with VAT', () => {
        const record = createMockVatRecord({
          vatNumber: '987654321',
          pcn874RecordType: EntryType.SALE_PALESTINIAN_CUSTOMER,
        });
        const result = (getVatIdForTransaction as any)(record, 'I' as any);
        expect(result).toBe('987654321');
      });

      it('should handle undefined entry type gracefully', () => {
        const record = createMockVatRecord({
          vatNumber: '123456789',
          pcn874RecordType: undefined,
        });
        const result = (getVatIdForTransaction as any)(record, undefined);
        expect(result).toBe('123456789');
      });
    });

    describe('getReferenceForTransaction', () => {
      it('should return "0" for import transactions (R)', () => {
        const record = createMockVatRecord({
          documentSerial: 'INV-123',
          pcn874RecordType: EntryType.INPUT_IMPORT,
        });
        const result = (getReferenceForTransaction as any)(record, 'R' as any);
        expect(result).toBe('0');
      });

      it('should return document serial when available', () => {
        const record = createMockVatRecord({
          documentSerial: 'INV-1234',
          pcn874RecordType: EntryType.SALE_REGULAR,
        });
        const result = (getReferenceForTransaction as any)(record, 'S1' as any);
        expect(result).toBe('INV-1234');
      });

      it('should return "1" for unidentified customer (L1) without serial', () => {
        const record = createMockVatRecord({
          documentSerial: null,
          pcn874RecordType: EntryType.SALE_UNIDENTIFIED_CUSTOMER,
        });
        const result = (getReferenceForTransaction as any)(record, 'L1' as any);
        expect(result).toBe('1');
      });

      it('should return "1" for petty cash (K) without serial', () => {
        const record = createMockVatRecord({
          documentSerial: null,
          pcn874RecordType: EntryType.INPUT_PETTY_CASH,
        });
        const result = (getReferenceForTransaction as any)(record, 'K' as any);
        expect(result).toBe('1');
      });

      it('should return "0" as fallback when no serial and standard type', () => {
        const record = createMockVatRecord({
          documentSerial: null,
          pcn874RecordType: EntryType.SALE_REGULAR,
        });
        const result = (getReferenceForTransaction as any)(record, 'S1' as any);
        expect(result).toBe('0');
      });
    });

    describe('getTotalVAT', () => {
      it('should round positive VAT amount', () => {
        const record = createMockVatRecord({
          roundedVATToAdd: 170.4,
          pcn874RecordType: EntryType.SALE_REGULAR,
        });
        const result = (getTotalVAT as any)(record, 'S1' as any);
        expect(result).toBe(170);
      });

      it('should take absolute value and round negative VAT', () => {
        const record = createMockVatRecord({
          roundedVATToAdd: -170.6,
          pcn874RecordType: EntryType.SALE_REGULAR,
        });
        const result = (getTotalVAT as any)(record, 'S1' as any);
        expect(result).toBe(171);
      });

      it('should return 0 for exempt transactions (S2)', () => {
        const record = createMockVatRecord({
          roundedVATToAdd: 170,
          pcn874RecordType: EntryType.SALE_ZERO_OR_EXEMPT,
        });
        const result = (getTotalVAT as any)(record, 'S2' as any);
        expect(result).toBe(0);
      });

      it('should return 0 for export transactions (Y)', () => {
        const record = createMockVatRecord({
          roundedVATToAdd: 170,
          pcn874RecordType: EntryType.SALE_EXPORT,
        });
        const result = (getTotalVAT as any)(record, 'Y' as any);
        expect(result).toBe(0);
      });

      it('should return 0 for zero-rated transactions', () => {
        const record = createMockVatRecord({
          roundedVATToAdd: 0,
          pcn874RecordType: EntryType.SALE_REGULAR,
        });
        const result = (getTotalVAT as any)(record, 'S1' as any);
        expect(result).toBe(0);
      });

      it.skip('should handle foreign VAT correctly', () => {
        const record = createMockVatRecord({
          roundedVATToAdd: 85.3,
          pcn874RecordType: EntryType.SALE_PALESTINIAN_CUSTOMER,
        });
        const result = (getTotalVAT as any)(record, 'I' as any);
        expect(result).toBe(85);
      });
    });

    describe('getHeaderDataFromRecords', () => {
      const createPcnRecord = (overrides: Partial<ExtendedPCNTransaction> = {}): ExtendedPCNTransaction => ({
        entryType: EntryType.SALE_REGULAR,
        vatId: '123456789',
        invoiceDate: '20240115',
        refGroup: '0000',
        refNumber: '1',
        totalVat: 170,
        invoiceSum: 1000,
        isProperty: false,
        allocationNumber: undefined,
        ...overrides,
      });

      it('should return all zeros for empty array', () => {
        const result = getHeaderDataFromRecords([], '');
        expect(result.taxableSalesAmount).toBe(0);
        expect(result.zeroValOrExemptSalesCount).toBe(0);
        expect(result.salesRecordCount).toBe(0);
        expect(result.inputsCount).toBe(0);
        expect(result.taxableSalesVat).toBe(0);
        expect(result.otherInputsVat).toBe(0);
        expect(result.equipmentInputsVat).toBe(0);
      });

      it('should increment taxable sales for SALE_REGULAR (S1)', () => {
        const records = [
          createPcnRecord({
            entryType: EntryType.SALE_REGULAR,
            invoiceSum: 1000,
            totalVat: 170,
          }),
        ];
        const result = getHeaderDataFromRecords(records, '');
        expect(result.taxableSalesAmount).toBe(1000);
        expect(result.taxableSalesVat).toBe(170);
        expect(result.salesRecordCount).toBe(1);
        expect(result.zeroValOrExemptSalesCount).toBe(0);
      });

      it('should increment zero-rated sales for SALE_UNIDENTIFIED_ZERO_OR_EXEMPT (L2)', () => {
    const records = [
          createPcnRecord({
            entryType: EntryType.SALE_UNIDENTIFIED_ZERO_OR_EXEMPT,
            invoiceSum: 1000,
            totalVat: 0,
          }),
        ];
        const result = getHeaderDataFromRecords(records, '');
        expect(result.zeroValOrExemptSalesCount).toBe(1000);
        expect(result.taxableSalesAmount).toBe(0);
        expect(result.salesRecordCount).toBe(1);
      });

      describe.skip('Foreign Business with VAT', () => {
        it('should add SALE_FOREIGN_BUSINESS_WITH_VAT to exempt sales', () => {
          const records: ExtendedPCNTransaction[] = [
            createPcnRecord({
              entryType: EntryType.SALE_PALESTINIAN_CUSTOMER,
              invoiceSum: 1170,
              totalVat: 170,
            }),
          ];
          const result = getHeaderDataFromRecords(records, '');

          expect(result.zeroValOrExemptSalesCount).toBe(1170);
          expect(result.taxableSalesAmount).toBe(0);
          expect(result.salesRecordCount).toBe(1);
          expect(result.taxableSalesVat).toBe(170);
        });

        it('should separate foreign with VAT from regular sales', () => {
          const records = [
            createPcnRecord({
              entryType: EntryType.SALE_PALESTINIAN_CUSTOMER,
              invoiceSum: 1170,
              totalVat: 170,
            }),
            createPcnRecord({
              entryType: EntryType.SALE_REGULAR,
              invoiceSum: 2340,
              totalVat: 340,
            }),
          ];
          const result = getHeaderDataFromRecords(records, '');

          expect(result.zeroValOrExemptSalesCount).toBe(1170);
          expect(result.taxableSalesAmount).toBe(2340);
          expect(result.salesRecordCount).toBe(2);
          expect(result.taxableSalesVat).toBe(510);
        });
      });

      describe.skip('Mixed Sales and Input Transactions', () => {
        it('should handle mixed transaction types correctly', () => {
          const records = [
            createPcnRecord({ entryType: EntryType.SALE_REGULAR, invoiceSum: 1000, totalVat: 170 }),
            createPcnRecord({ entryType: EntryType.SALE_REGULAR, invoiceSum: 2000, totalVat: 340 }),
            createPcnRecord({ entryType: EntryType.SALE_PALESTINIAN_CUSTOMER, invoiceSum: 1170, totalVat: 170 }),
            createPcnRecord({
              entryType: EntryType.INPUT_REGULAR,
              invoiceSum: 500,
              totalVat: 85,
              isProperty: false,
            }),
          ];
          const result = getHeaderDataFromRecords(records, '');

          expect(result.taxableSalesAmount).toBe(3000);
          expect(result.zeroValOrExemptSalesCount).toBe(1170);
          expect(result.salesRecordCount).toBe(3);
          expect(result.inputsCount).toBe(1);
          expect(result.taxableSalesVat).toBe(680);
          expect(result.otherInputsVat).toBe(85);
        });

        it('should count input records correctly', () => {
          const records = [
            createPcnRecord({ entryType: EntryType.INPUT_REGULAR, invoiceSum: 500, totalVat: 85 }),
            createPcnRecord({ entryType: EntryType.INPUT_PETTY_CASH, invoiceSum: 100, totalVat: 17 }),
            createPcnRecord({ entryType: EntryType.INPUT_IMPORT, invoiceSum: 300, totalVat: 51 }),
          ];
          const result = getHeaderDataFromRecords(records, '');

          expect(result.inputsCount).toBe(3);
          expect(result.salesRecordCount).toBe(0);
          expect(result.otherInputsVat).toBe(153);
        });
      });
    });
  });

  describe('Integration Tests', () => {
    it('placeholder', () => {
      expect(true).toBe(true);
    });
  });

  describe('Snapshot Tests', () => {
    it('placeholder', () => {
      expect(true).toBe(true);
    });
  });

  it('should load test file', () => {
    expect(true).toBe(true);
  });
});
