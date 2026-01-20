import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  ExtendedPCNTransaction,
  getEntryTypeByRecord,
  getHeaderDataFromRecords,
  getPcn874String,
  getReferenceForTransaction,
  getTotalVAT,
  getVatIdForTransaction,
} from '../pcn.helper.js';
import { EntryType, validatePcn874 } from '@accounter/pcn874-generator';
import type { RawVatReportRecord } from '../vat-report.helper.js';
import { Currency } from '../../../../shared/enums.js';
import { getVatRecords } from '../../resolvers/get-vat-records.resolver.js';
import { IGetChargesByIdsResult } from '../../../charges/types.js';
import { TimelessDateString } from 'shared/types/index.js';

type GetVatRecordsResponse = {
      income: Array<RawVatReportRecord>;
      expenses: Array<RawVatReportRecord>;
      missingInfo: Array<IGetChargesByIdsResult>;
      differentMonthDoc: Array<IGetChargesByIdsResult>;
      businessTrips: Array<IGetChargesByIdsResult>;
    };

vi.mock('../../resolvers/get-vat-records.resolver.js', () => ({
  getVatRecords: vi.fn(),
}));

const FIXED_DATE = new Date('2024-01-15');
const FIXED_REPORT_MONTH = '2024-01-15';
const FIXED_VAT_NUMBER = '123456789';
const FIXED_BUSINESS_ID = 'test-business-123';

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_DATE);
});

afterAll(() => {
  vi.useRealTimers();
});

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

function createMockBusiness(vatNumber: string = FIXED_VAT_NUMBER) {
  return {
    id: FIXED_BUSINESS_ID,
    name: 'Test Business Ltd',
    hebrewName: 'חברת בדיקה בע"מ',
    address: 'Tel Aviv',
    country: 'IL',
    vat_number: vatNumber,
  };
}

interface MockContextOptions {
  business?: any;
  vatRecords?: RawVatReportRecord[];
}

function createMockContext(options: MockContextOptions = {}) {
  const { business, vatRecords } = options;

  const mockLoaders = {
    getFinancialEntityByIdLoader: {
      load: vi.fn().mockResolvedValue(business || createMockBusiness()),
    },
    getIncomeAndExpenseVatRecordsForReportLoader: {
      load: vi.fn().mockResolvedValue(vatRecords || []),
    },
  };
  const mockProviders = {
    BusinessesProvider: {
      getBusinessByIdLoader: {
        load: vi.fn().mockResolvedValue(business || createMockBusiness()),
      },
    },
  };

  return {
    injector: {
      get: vi.fn((token: any) => {
        const tokenName = typeof token === 'string' ? token : token.name;
        return (
          mockProviders[tokenName as keyof typeof mockProviders] ||
          mockLoaders[tokenName as keyof typeof mockLoaders]
        );
      }),
    },
  } as unknown as GraphQLModules.Context;
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

    it('should create a mock business with VAT number', () => {
      const business = createMockBusiness('987654321');
      expect(business.vat_number).toBe('987654321');
    });

    it('should create a mock context with loaders', () => {
      const business = createMockBusiness();
      const vatRecords = [createMockVatRecord()];
      const context = createMockContext({ business, vatRecords });

      expect(context.injector).toBeDefined();
      expect(vi.isMockFunction(context.injector.get)).toBe(true);
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
        const result = getVatIdForTransaction(record);
        expect(result).toBe('0');
      });

      it('should return "0" for unidentified customer zero-rated (L2)', () => {
        const record = createMockVatRecord({
          vatNumber: '123456789',
          pcn874RecordType: EntryType.SALE_UNIDENTIFIED_ZERO_OR_EXEMPT,
        });
        const result = getVatIdForTransaction(record);
        expect(result).toBe('0');
      });

      it('should return "0" for petty cash (K)', () => {
        const record = createMockVatRecord({
          vatNumber: '123456789',
          pcn874RecordType: EntryType.INPUT_PETTY_CASH,
        });
        const result = getVatIdForTransaction(record);
        expect(result).toBe('0');
      });

      it('should return "999999999" for INPUT_REGULAR without VAT number', () => {
        const record = createMockVatRecord({
          vatNumber: null,
          pcn874RecordType: EntryType.INPUT_REGULAR,
        });
        const result = getVatIdForTransaction(record);
        expect(result).toBe('999999999');
      });

      it('should return record VAT number for regular sales', () => {
        const record = createMockVatRecord({
          vatNumber: '123456789',
          pcn874RecordType: EntryType.SALE_REGULAR,
        });
        const result = getVatIdForTransaction(record);
        expect(result).toBe('123456789');
      });

      it('should return record VAT number for foreign business with VAT', () => {
        const record = createMockVatRecord({
          vatNumber: '987654321',
          pcn874RecordType: EntryType.SALE_PALESTINIAN_CUSTOMER,
        });
        const result = getVatIdForTransaction(record);
        expect(result).toBe('987654321');
      });

      it('should handle undefined entry type gracefully', () => {
        const record = createMockVatRecord({
          vatNumber: '123456789',
          pcn874RecordType: undefined,
        });
        const result = getVatIdForTransaction(record);
        expect(result).toBe('123456789');
      });
    });

    describe('getReferenceForTransaction', () => {
      it('should return "0" for import transactions (R)', () => {
        const record = createMockVatRecord({
          documentSerial: 'INV-123',
          pcn874RecordType: EntryType.INPUT_IMPORT,
        });
        const result = getReferenceForTransaction(record);
        expect(result).toBe('0');
      });

      it('should return document serial when available', () => {
        const record = createMockVatRecord({
          documentSerial: 'INV-1234',
          pcn874RecordType: EntryType.SALE_REGULAR,
        });
        const result = getReferenceForTransaction(record);
        expect(result).toBe('INV-1234');
      });

      it('should return "1" for unidentified customer (L1) without serial', () => {
        const record = createMockVatRecord({
          documentSerial: null,
          pcn874RecordType: EntryType.SALE_UNIDENTIFIED_CUSTOMER,
        });
        const result = getReferenceForTransaction(record);
        expect(result).toBe('1');
      });

      it('should return "1" for petty cash (K) without serial', () => {
        const record = createMockVatRecord({
          documentSerial: null,
          pcn874RecordType: EntryType.INPUT_PETTY_CASH,
        });
        const result = getReferenceForTransaction(record);
        expect(result).toBe('1');
      });

      it('should return "0" as fallback when no serial and standard type', () => {
        const record = createMockVatRecord({
          documentSerial: null,
          pcn874RecordType: EntryType.SALE_REGULAR,
        });
        const result = getReferenceForTransaction(record);
        expect(result).toBe('0');
      });
    });

    describe('getTotalVAT', () => {
      it('should round positive VAT amount', () => {
        const record = createMockVatRecord({
          roundedVATToAdd: 170.4,
          pcn874RecordType: EntryType.SALE_REGULAR,
        });
        const result = getTotalVAT(record);
        expect(result).toBe(170);
      });

      it('should take absolute value and round negative VAT', () => {
        const record = createMockVatRecord({
          roundedVATToAdd: -170.6,
          pcn874RecordType: EntryType.SALE_REGULAR,
        });
        const result = getTotalVAT(record);
        expect(result).toBe(171);
      });

      it('should return 0 for exempt transactions (S2)', () => {
        const record = createMockVatRecord({
          roundedVATToAdd: 170,
          pcn874RecordType: EntryType.SALE_ZERO_OR_EXEMPT,
        });
        const result = getTotalVAT(record);
        expect(result).toBe(0);
      });

      it('should return 0 for export transactions (Y)', () => {
        const record = createMockVatRecord({
          roundedVATToAdd: 170,
          pcn874RecordType: EntryType.SALE_EXPORT,
        });
        const result = getTotalVAT(record);
        expect(result).toBe(0);
      });

      it('should return 0 for zero-rated transactions', () => {
        const record = createMockVatRecord({
          roundedVATToAdd: 0,
          pcn874RecordType: EntryType.SALE_REGULAR,
        });
        const result = getTotalVAT(record);
        expect(result).toBe(0);
      });

      it.skip('should handle foreign VAT correctly', () => {
        const record = createMockVatRecord({
          roundedVATToAdd: 85.3,
          pcn874RecordType: EntryType.SALE_PALESTINIAN_CUSTOMER,
        });
        const result = getTotalVAT(record);
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
    describe('getPcn874String', () => {
      describe('Standard Mixed Report', () => {
        it('should generate valid PCN874 for typical monthly report', async () => {
          const vatRecords = [
            createMockVatRecord({
              pcn874RecordType: EntryType.SALE_REGULAR,
              localAmountBeforeVAT: 1000,
              localVat: 170,
            }),
            createMockVatRecord({
              pcn874RecordType: EntryType.SALE_REGULAR,
              localAmountBeforeVAT: 2000,
              localVat: 340,
            }),
            createMockVatRecord({
              pcn874RecordType: EntryType.INPUT_REGULAR,
              localAmountBeforeVAT: 500,
              localVat: 85,
              isExpense: true,
            }),
            createMockVatRecord({
              pcn874RecordType: EntryType.INPUT_REGULAR,
              localAmountBeforeVAT: 300,
              localVat: 51,
              isExpense: true,
            }),
            createMockVatRecord({
              pcn874RecordType: EntryType.SALE_EXPORT,
              localAmountBeforeVAT: 5000,
              localVat: 0,
            }),
          ];

          const business = createMockBusiness();
          const context = createMockContext({ business, vatRecords });

          vi.mocked(getVatRecords).mockResolvedValue({
            income: vatRecords,
            expenses: [],
            missingInfo: [],
            differentMonthDoc: [],
            businessTrips: [],
          } as GetVatRecordsResponse);

          const result = await getPcn874String(
            context,
            FIXED_BUSINESS_ID,
            FIXED_REPORT_MONTH,
          );

          expect(validatePcn874(result.reportContent)).toBe(true);

          const lines = result.reportContent.split('\n').filter((line) => line.length > 0);
          expect(lines[0].length).toBe(131);
          expect(lines[lines.length - 1].length).toBe(10);

          const transactionLines = lines.slice(1, -1);
          expect(transactionLines.length).toBe(5);
          transactionLines.forEach((line) => {
            expect(line.length).toBe(60);
          });

          expect(result.reportMonth).toBe('202401');
          expect(result.financialEntity.vat_number).toBe(FIXED_VAT_NUMBER);
        });
      });

      describe('Foreign Businesses with VAT', () => {
        it('should place foreign business with VAT in exempt sales', async () => {
          const vatRecords = [
            createMockVatRecord({
              pcn874RecordType: EntryType.SALE_PALESTINIAN_CUSTOMER,
              localAmountBeforeVAT: 1000,
              localVat: 170,
              vatNumber: '987654321',
            }),
            createMockVatRecord({
              pcn874RecordType: EntryType.SALE_REGULAR,
              localAmountBeforeVAT: 2000,
              localVat: 340,
            }),
          ];

          const business = createMockBusiness();
          const context = createMockContext({ business, vatRecords });

          vi.mocked(getVatRecords).mockResolvedValue({
            income: vatRecords,
            expenses: [],
            missingInfo: [],
            differentMonthDoc: [],
            businessTrips: [],
          } as GetVatRecordsResponse);

          const result = await getPcn874String(
            context,
            FIXED_BUSINESS_ID,
            FIXED_REPORT_MONTH,
          );

          expect(validatePcn874(result.reportContent)).toBe(true);

          const lines = result.reportContent.split('\n').filter((line) => line.length > 0);
          const transactionLines = lines.slice(1, -1);

          const foreignTx = transactionLines.find((line) => line.startsWith('I'));
          expect(foreignTx).toBeDefined();
          expect(foreignTx).toContain('987654321');

          const regularTx = transactionLines.find((line) => line.startsWith('S'));
          expect(regularTx).toBeDefined();
        });
      });

      describe('Edge Cases', () => {
        it('should handle zero-VAT transactions only', async () => {
          const vatRecords = [
            createMockVatRecord({
              pcn874RecordType: EntryType.SALE_ZERO_OR_EXEMPT,
              localVat: 0,
              localAmountBeforeVAT: 1000,
            }),
            createMockVatRecord({
              pcn874RecordType: EntryType.SALE_EXPORT,
              localVat: 0,
              localAmountBeforeVAT: 2000,
            }),
          ];

          const business = createMockBusiness();
          const context = createMockContext({ business, vatRecords });

          vi.mocked(getVatRecords).mockResolvedValue({
            income: vatRecords,
            expenses: [],
            missingInfo: [],
            differentMonthDoc: [],
            businessTrips: [],
          } as GetVatRecordsResponse);

          const result = await getPcn874String(
            context,
            FIXED_BUSINESS_ID,
            FIXED_REPORT_MONTH,
          );

          expect(validatePcn874(result.reportContent)).toBe(true);

          const lines = result.reportContent.split('\n').filter((line) => line.length > 0);
          expect(lines.length).toBeGreaterThan(2);
        });

        it('should handle negative amounts (credit invoices)', async () => {
          const vatRecords = [
            createMockVatRecord({
              localAmountBeforeVAT: -500,
              localVat: -85,
            }),
          ];

          const business = createMockBusiness();
          const context = createMockContext({ business, vatRecords });

          vi.mocked(getVatRecords).mockResolvedValue({
            income: vatRecords,
            expenses: [],
            missingInfo: [],
            differentMonthDoc: [],
            businessTrips: [],
          } as GetVatRecordsResponse);

          const result = await getPcn874String(
            context,
            FIXED_BUSINESS_ID,
            FIXED_REPORT_MONTH,
          );

          expect(validatePcn874(result.reportContent)).toBe(true);

          const lines = result.reportContent.split('\n').filter((line) => line.length > 0);
          expect(lines.length).toBe(3);
        });

        it('should skip records with missing document dates', async () => {
          const vatRecords = [
            createMockVatRecord({ documentDate: null }),
            createMockVatRecord({ documentDate: FIXED_DATE }),
          ];

          const business = createMockBusiness();
          const context = createMockContext({ business, vatRecords });

          const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);

          vi.mocked(getVatRecords).mockResolvedValue({
            income: vatRecords,
            expenses: [],
            missingInfo: [],
            differentMonthDoc: [],
            businessTrips: [],
          } as any);

          const result = await getPcn874String(
            context,
            FIXED_BUSINESS_ID,
            FIXED_REPORT_MONTH,
          );

          expect(validatePcn874(result.reportContent)).toBe(true);

          const lines = result.reportContent.split('\n').filter((line) => line.length > 0);
          const transactionLines = lines.slice(1, -1);
          expect(transactionLines.length).toBe(1);
          expect(consoleDebugSpy).toHaveBeenCalled();

          consoleDebugSpy.mockRestore();
        });

        it('should generate minimal report for empty records', async () => {
          const vatRecords: RawVatReportRecord[] = [];

          const business = createMockBusiness();
          const context = createMockContext({ business, vatRecords });

          vi.mocked(getVatRecords).mockResolvedValue({
            income: [],
            expenses: [],
            missingInfo: [],
            differentMonthDoc: [],
            businessTrips: [],
          } as any);

          const result = await getPcn874String(
            context,
            FIXED_BUSINESS_ID,
            FIXED_REPORT_MONTH,
          );

          expect(validatePcn874(result.reportContent)).toBe(false); // Header/footer only is not valid but should still be generated

          const lines = result.reportContent.split('\n').filter((line) => line.length > 0);
          expect(lines.length).toBe(2);
          expect(lines[0].length).toBe(131);
          expect(lines[1].length).toBe(10);
        });
      });

      describe('Error Handling', () => {
        it('should throw error when business has no VAT number', async () => {
          const vatRecords = [createMockVatRecord()];
          const businessWithoutVAT = createMockBusiness(undefined) as any;
          businessWithoutVAT.vatNumber = null;
          businessWithoutVAT.vat_number = null;

          const context = createMockContext({
            business: businessWithoutVAT,
            vatRecords,
          });

          await expect(
            getPcn874String(context, FIXED_BUSINESS_ID, FIXED_REPORT_MONTH),
          ).rejects.toThrow(/VAT/i);
        });

        it('should validate report month format', async () => {
          const vatRecords = [createMockVatRecord()];
          const business = createMockBusiness();
          const context = createMockContext({ business, vatRecords });

          vi.mocked(getVatRecords).mockResolvedValue({
            income: vatRecords,
            expenses: [],
            missingInfo: [],
            differentMonthDoc: [],
            businessTrips: [],
          } as GetVatRecordsResponse);

          const result = await getPcn874String(context, FIXED_BUSINESS_ID, '2024-1' as TimelessDateString);
          expect(result.reportMonth).toBe('202401');
        });
      });
    });
  });

  describe('Snapshot Tests', () => {
    describe('PCN874 Format Snapshots', () => {
      it('should match snapshot for standard mixed report', async () => {
        const vatRecords = [
          createMockVatRecord({
            pcn874RecordType: EntryType.SALE_REGULAR,
            localAmountBeforeVAT: 1000,
            localVat: 170,
            documentSerial: 'INV-001',
          }),
          createMockVatRecord({
            pcn874RecordType: EntryType.SALE_REGULAR,
            localAmountBeforeVAT: 2000,
            localVat: 340,
            documentSerial: 'INV-002',
          }),
          createMockVatRecord({
            pcn874RecordType: EntryType.INPUT_REGULAR,
            localAmountBeforeVAT: 500,
            localVat: 85,
            isExpense: true,
            documentSerial: 'BILL-001',
          }),
          createMockVatRecord({
            pcn874RecordType: EntryType.INPUT_REGULAR,
            localAmountBeforeVAT: 300,
            localVat: 51,
            isExpense: true,
            documentSerial: 'BILL-002',
          }),
          createMockVatRecord({
            pcn874RecordType: EntryType.SALE_EXPORT,
            localAmountBeforeVAT: 5000,
            localVat: 0,
            documentSerial: 'EXP-001',
          }),
        ];

        const business = createMockBusiness();
        const context = createMockContext({ business, vatRecords });

        vi.mocked(getVatRecords).mockResolvedValue({
          income: vatRecords,
          expenses: [],
          missingInfo: [],
          differentMonthDoc: [],
          businessTrips: [],
        } as GetVatRecordsResponse);

        const result = await getPcn874String(context, FIXED_BUSINESS_ID, FIXED_REPORT_MONTH);

        expect(validatePcn874(result.reportContent)).toBe(true);
        expect(result.reportContent).toMatchSnapshot();
      });

      it('should match snapshot for PR #2940 foreign businesses', async () => {
        const vatRecords = [
          createMockVatRecord({
            pcn874RecordType: EntryType.SALE_PALESTINIAN_CUSTOMER,
            localAmountBeforeVAT: 1000,
            localVat: 170,
            vatNumber: '987654321',
            documentSerial: 'INTL-001',
          }),
          createMockVatRecord({
            pcn874RecordType: EntryType.SALE_REGULAR,
            localAmountBeforeVAT: 2000,
            localVat: 340,
            documentSerial: 'INV-001',
          }),
        ];

        const business = createMockBusiness();
        const context = createMockContext({ business, vatRecords });

        vi.mocked(getVatRecords).mockResolvedValue({
          income: vatRecords,
          expenses: [],
          missingInfo: [],
          differentMonthDoc: [],
          businessTrips: [],
        } as GetVatRecordsResponse);

        const result = await getPcn874String(context, FIXED_BUSINESS_ID, FIXED_REPORT_MONTH);

        expect(validatePcn874(result.reportContent)).toBe(true);
        expect(result.reportContent).toMatchSnapshot();
      });

      it('should match snapshot for zero-VAT transactions', async () => {
        const vatRecords = [
          createMockVatRecord({
            pcn874RecordType: EntryType.SALE_ZERO_OR_EXEMPT,
            localAmountBeforeVAT: 1000,
            localVat: 0,
            documentSerial: 'EXEMPT-001',
          }),
          createMockVatRecord({
            pcn874RecordType: EntryType.SALE_EXPORT,
            localAmountBeforeVAT: 2000,
            localVat: 0,
            documentSerial: 'EXP-001',
          }),
        ];

        const business = createMockBusiness();
        const context = createMockContext({ business, vatRecords });

        vi.mocked(getVatRecords).mockResolvedValue({
          income: vatRecords,
          expenses: [],
          missingInfo: [],
          differentMonthDoc: [],
          businessTrips: [],
        } as GetVatRecordsResponse);

        const result = await getPcn874String(context, FIXED_BUSINESS_ID, FIXED_REPORT_MONTH);

        expect(validatePcn874(result.reportContent)).toBe(true);
        expect(result.reportContent).toMatchSnapshot();
      });

      it('should match snapshot for imports and exports', async () => {
        const vatRecords = [
          createMockVatRecord({
            pcn874RecordType: EntryType.INPUT_IMPORT,
            localAmountBeforeVAT: 3000,
            localVat: 510,
            isExpense: true,
            documentSerial: 'IMP-001',
          }),
          createMockVatRecord({
            pcn874RecordType: EntryType.SALE_EXPORT,
            localAmountBeforeVAT: 5000,
            localVat: 0,
            documentSerial: 'EXP-001',
          }),
          createMockVatRecord({
            pcn874RecordType: EntryType.SALE_REGULAR,
            localAmountBeforeVAT: 1000,
            localVat: 170,
            documentSerial: 'INV-001',
          }),
        ];

        const business = createMockBusiness();
        const context = createMockContext({ business, vatRecords });

        vi.mocked(getVatRecords).mockResolvedValue({
          income: vatRecords,
          expenses: [],
          missingInfo: [],
          differentMonthDoc: [],
          businessTrips: [],
        } as GetVatRecordsResponse);

        const result = await getPcn874String(context, FIXED_BUSINESS_ID, FIXED_REPORT_MONTH);

        expect(validatePcn874(result.reportContent)).toBe(true);
        expect(result.reportContent).toMatchSnapshot();
      });

      it('should match snapshot for property expenses', async () => {
        const vatRecords = [
          createMockVatRecord({
            chargeAccountantStatus: "PENDING",
            currencyCode: Currency.Ils,
            documentSerial: "0101-0202",
            documentAmount: "4680",
            foreignVat: null,
            localVat: 713.9,
            isProperty: true,
            vatNumber: FIXED_VAT_NUMBER,
            isExpense: true,
            pcn874RecordType: undefined,
            foreignVatAfterDeduction: 475.9333333333333,
            localVatAfterDeduction: 475.9333333333333,
            foreignAmountBeforeVAT: 4204.066666666667,
            localAmountBeforeVAT: 4204.066666666667,
            roundedVATToAdd: 476,
            eventLocalAmount: 4680,
          }),
        ];

        const business = createMockBusiness();
        const context = createMockContext({ business, vatRecords });

        vi.mocked(getVatRecords).mockResolvedValue({
          income: [],
          expenses: vatRecords,
          missingInfo: [],
          differentMonthDoc: [],
          businessTrips: [],
        } as GetVatRecordsResponse);

        const result = await getPcn874String(context, FIXED_BUSINESS_ID, FIXED_REPORT_MONTH);

        expect(validatePcn874(result.reportContent)).toBe(true);
        expect(result.reportContent).toMatchSnapshot();
      });

      it('should match snapshot for credit invoices (with & without VAT)', async () => {
        const vatRecords = [
          createMockVatRecord({
            chargeAccountantStatus: "PENDING",
            currencyCode: Currency.Usd,
            documentSerial: "10123",
            documentAmount: "6000",
            foreignVat: -1810.54,
            localVat: null,
            isProperty: false,
            vatNumber: null,
            isExpense: false,
            allocationNumber: null,
            pcn874RecordType: undefined,
            foreignVatAfterDeduction: -1810.54,
            localVatAfterDeduction: -2597.4086299999996,
            foreignAmountBeforeVAT: -5084.74,
            localAmountBeforeVAT: -16596.59136,
            roundedVATToAdd: -2598,
            eventLocalAmount: -10584,
          }),
          createMockVatRecord({
            chargeAccountantStatus: "PENDING",
            currencyCode: Currency.Usd,
            documentSerial: "20123",
            documentAmount: "6000",
            foreignVat: 1810.54,
            localVat: null,
            isProperty: false,
            vatNumber: null,
            isExpense: false,
            allocationNumber: null,
            pcn874RecordType: undefined,
            foreignVatAfterDeduction: 1810.54,
            localVatAfterDeduction: 2597.4086299999996,
            foreignAmountBeforeVAT: 5084.74,
            localAmountBeforeVAT: 16596.59136,
            roundedVATToAdd: 2598,
            eventLocalAmount: 10584,
          }),
          createMockVatRecord({
            chargeAccountantStatus: "PENDING",
            currencyCode: Currency.Ils,
            documentSerial: "80123",
            documentAmount: "2000.15",
            foreignVat: null,
            localVat: null,
            isProperty: false,
            vatNumber: null,
            isExpense: false,
            allocationNumber: null,
            pcn874RecordType: undefined,
            foreignVatAfterDeduction: undefined,
            localVatAfterDeduction: undefined,
            foreignAmountBeforeVAT: undefined,
            localAmountBeforeVAT: -2000.15,
            roundedVATToAdd: undefined,
            eventLocalAmount: -2000.15,
          }),
          createMockVatRecord({
            chargeAccountantStatus: "PENDING",
            currencyCode: Currency.Ils,
            documentSerial: "90123",
            documentAmount: "2000.15",
            foreignVat: undefined,
            localVat: undefined,
            isProperty: false,
            vatNumber: undefined,
            isExpense: false,
            allocationNumber: undefined,
            pcn874RecordType: undefined,
            foreignVatAfterDeduction: undefined,
            localVatAfterDeduction: undefined,
            foreignAmountBeforeVAT: undefined,
            localAmountBeforeVAT: 2000.15,
            roundedVATToAdd: undefined,
            eventLocalAmount: 2000.15,
          }),
        ];

        const business = createMockBusiness();
        const context = createMockContext({ business, vatRecords });

        vi.mocked(getVatRecords).mockResolvedValue({
          income: [],
          expenses: vatRecords,
          missingInfo: [],
          differentMonthDoc: [],
          businessTrips: [],
        } as GetVatRecordsResponse);

        const result = await getPcn874String(context, FIXED_BUSINESS_ID, FIXED_REPORT_MONTH);

        expect(validatePcn874(result.reportContent)).toBe(true);
        expect(result.reportContent).toMatchSnapshot();
      });

      it('should match snapshot for petty cash (taxi invoices - record type is overridden)', async () => {
        const vatRecords = [
          createMockVatRecord({
            chargeAccountantStatus: "APPROVED",
            currencyCode: Currency.Ils,
            documentSerial: "19",
            documentAmount: "441.7",
            foreignVat: null,
            localVat: 67.38,
            isProperty: false,
            vatNumber: null,
            isExpense: true,
            pcn874RecordType: "K",
            foreignVatAfterDeduction: 67.38,
            localVatAfterDeduction: 67.38,
            foreignAmountBeforeVAT: 374.32,
            localAmountBeforeVAT: 374.32,
            roundedVATToAdd: 67,
            eventLocalAmount: 441.7,
          }),
          createMockVatRecord({
            chargeAccountantStatus: "APPROVED",
            currencyCode: Currency.Ils,
            documentSerial: "565",
            documentAmount: "199.8",
            foreignVat: null,
            localVat: 30.48,
            isProperty: false,
            vatNumber: null,
            isExpense: true,
            pcn874RecordType: "K",
            foreignVatAfterDeduction: 30.48,
            localVatAfterDeduction: 30.48,
            foreignAmountBeforeVAT: 169.32000000000002,
            localAmountBeforeVAT: 169.32000000000002,
            roundedVATToAdd: 30,
            eventLocalAmount: 199.8,
          }),
          createMockVatRecord({
            chargeAccountantStatus: "APPROVED",
            currencyCode: Currency.Ils,
            documentSerial: "9476",
            documentAmount: "165",
            foreignVat: null,
            localVat: 25.17,
            isProperty: false,
            vatNumber: null,
            isExpense: true,
            pcn874RecordType: "K",
            foreignVatAfterDeduction: 25.17,
            localVatAfterDeduction: 25.17,
            foreignAmountBeforeVAT: 139.82999999999998,
            localAmountBeforeVAT: 139.82999999999998,
            roundedVATToAdd: 25,
            eventLocalAmount: 165,
          }),
        ];

        const business = createMockBusiness();
        const context = createMockContext({ business, vatRecords });

        vi.mocked(getVatRecords).mockResolvedValue({
          income: [],
          expenses: vatRecords,
          missingInfo: [],
          differentMonthDoc: [],
          businessTrips: [],
        } as GetVatRecordsResponse);

        const result = await getPcn874String(context, FIXED_BUSINESS_ID, FIXED_REPORT_MONTH);

        expect(validatePcn874(result.reportContent)).toBe(true);
        expect(result.reportContent).toMatchSnapshot();
      });
    });
  });

  it('should load test file', () => {
    expect(true).toBe(true);
  });
});
