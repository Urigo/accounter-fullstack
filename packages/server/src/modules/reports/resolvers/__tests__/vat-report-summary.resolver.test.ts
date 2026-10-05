import type { Injector } from 'graphql-modules';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EntryType, pcnGenerator } from '@accounter/pcn874-generator';
import type { VatReportFilter } from '../../../../__generated__/types.js';
import { Currency } from '../../../../shared/enums.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { BusinessesProvider } from '../../../financial-entities/providers/businesses.provider.js';
import { getPcn874String } from '../../helpers/pcn.helper.js';
import type { RawVatReportRecord } from '../../helpers/vat-report.helper.js';
import type { VatReportRecords } from '../../types.js';
import { getVatRecords } from '../get-vat-records.resolver.js';
import { vatReport, vatReportResultMapper } from '../reports/vat-report.resolver.js';

vi.mock('../get-vat-records.resolver.js', () => ({
  getVatRecords: vi.fn(),
}));

const BUSINESS_ID = 'test-business-123';
const VAT_NUMBER = '123456789';
const MONTH = '2024-01-15';
const DOCUMENT_DATE = '2024-01-15';

type AnyResolver = (parent: unknown, args: unknown, context: unknown, info: unknown) => unknown;
const summaryResolver = vatReportResultMapper.summary as unknown as AnyResolver;
const vatReportResolver = vatReport as unknown as AnyResolver;

type SummaryShape = {
  taxableSalesAmount: { raw: number; currency: string; formatted: string };
  taxableSalesVat: { raw: number; currency: string; formatted: string };
  salesRecordCount: number;
  zeroValOrExemptSalesAmount: { raw: number; currency: string; formatted: string };
  otherInputsVat: { raw: number; currency: string; formatted: string };
  equipmentInputsVat: { raw: number; currency: string; formatted: string };
  inputsCount: number;
  totalVat: { raw: number; currency: string; formatted: string };
};

type HeaderTotals = {
  taxableSalesAmount: number;
  taxableSalesVat: number;
  salesRecordCount: number;
  zeroValOrExemptSalesAmount: number;
  otherInputsVat: number;
  equipmentInputsVat: number;
  inputsCount: number;
  totalVat: number;
};

/**
 * Reads the totals back out of the header line of a generated PCN874 file, using the fixed-width
 * layout the tax authority defines (and `headerBuilder` writes). Comparing against the file itself,
 * rather than against the helpers that build it, is what pins the summary to what is filed.
 */
function parsePcn874HeaderTotals(content: string): HeaderTotals {
  const header = content.split('\n')[0];
  expect(header).toHaveLength(131);
  expect(header[0]).toBe('O');

  // O + licensed dealer id (9) + report month (6) + report type (1) + generation date (8)
  let cursor = 25;
  const field = (length: number) => {
    const value = header.slice(cursor, cursor + length);
    cursor += length;
    // `+ 0` folds a "-000…" field into 0 rather than -0
    return Number(value) + 0;
  };

  const taxableSalesAmount = field(12);
  const taxableSalesVat = field(10);
  // sales at a different VAT rate: always zero, not part of the summary
  field(12);
  field(10);
  const salesRecordCount = field(9);
  const zeroValOrExemptSalesAmount = field(12);
  const otherInputsVat = field(10);
  const equipmentInputsVat = field(10);
  const inputsCount = field(9);
  const totalVat = field(12);
  expect(cursor).toBe(131);

  return {
    taxableSalesAmount,
    taxableSalesVat,
    salesRecordCount,
    zeroValOrExemptSalesAmount,
    otherInputsVat,
    equipmentInputsVat,
    inputsCount,
    totalVat,
  };
}

function summaryToRaw(summary: SummaryShape): HeaderTotals {
  return {
    taxableSalesAmount: summary.taxableSalesAmount.raw,
    taxableSalesVat: summary.taxableSalesVat.raw,
    salesRecordCount: summary.salesRecordCount,
    zeroValOrExemptSalesAmount: summary.zeroValOrExemptSalesAmount.raw,
    otherInputsVat: summary.otherInputsVat.raw,
    equipmentInputsVat: summary.equipmentInputsVat.raw,
    inputsCount: summary.inputsCount,
    totalVat: summary.totalVat.raw,
  };
}

let recordCounter = 0;
function vatRecord(overrides: Partial<RawVatReportRecord> = {}): RawVatReportRecord {
  recordCounter += 1;
  return {
    localAmountBeforeVAT: 1000,
    foreignAmountBeforeVAT: 0,
    businessId: BUSINESS_ID,
    chargeAccountantStatus: 'PENDING',
    chargeDate: DOCUMENT_DATE,
    chargeId: `charge-${recordCounter}`,
    currencyCode: Currency.Ils,
    documentAmount: '1170',
    documentId: `doc-${recordCounter}`,
    documentDate: DOCUMENT_DATE,
    documentSerial: `${recordCounter}`,
    documentUrl: null,
    eventLocalAmount: 1170,
    isExpense: false,
    isProperty: false,
    roundedVATToAdd: 170,
    foreignVat: 0,
    localVat: 170,
    foreignVatAfterDeduction: 0,
    localVatAfterDeduction: 170,
    vatNumber: '987654321',
    allocationNumber: null,
    pcn874RecordType: EntryType.SALE_REGULAR,
    ...overrides,
  };
}

function records(income: RawVatReportRecord[], expenses: RawVatReportRecord[]): VatReportRecords {
  return { income, expenses, missingInfo: [], differentMonthDoc: [], businessTrips: [] };
}

function createInjector(defaultLocalCurrency: Currency = Currency.Ils) {
  return {
    get: vi.fn((token: unknown) => {
      if (token === AdminContextProvider) {
        return { getVerifiedAdminContext: vi.fn().mockResolvedValue({ defaultLocalCurrency }) };
      }
      if (token === BusinessesProvider) {
        return {
          getBusinessByIdLoader: {
            load: vi.fn().mockResolvedValue({ id: BUSINESS_ID, vat_number: VAT_NUMBER }),
          },
        };
      }
      throw new Error(`Unexpected injector token: ${String(token)}`);
    }),
  } as unknown as Injector;
}

async function resolveSummary(
  injector: Injector,
  filters: VatReportFilter | null,
): Promise<SummaryShape> {
  const report = await vatReportResolver({}, { filters }, { injector }, {});
  return (await summaryResolver(report, {}, { injector }, {})) as SummaryShape;
}

const filters: VatReportFilter = { monthDate: MONTH, financialEntityId: BUSINESS_ID };

// Each month exercises a different part of the header definition. Records sit in whichever list
// the VAT report puts them; the PCN874 file and the summary both read the two lists together.
const MONTHS: Array<[string, VatReportRecords]> = [
  [
    'regular sales and inputs, with an export',
    records(
      [
        vatRecord({ localAmountBeforeVAT: 1000, roundedVATToAdd: 170 }),
        vatRecord({ localAmountBeforeVAT: 2000.4, roundedVATToAdd: 340.4 }),
        vatRecord({
          pcn874RecordType: EntryType.SALE_EXPORT,
          localAmountBeforeVAT: 5000,
          roundedVATToAdd: 0,
        }),
      ],
      [
        vatRecord({
          isExpense: true,
          pcn874RecordType: EntryType.INPUT_REGULAR,
          localAmountBeforeVAT: 500,
          roundedVATToAdd: 85,
        }),
        vatRecord({
          isExpense: true,
          pcn874RecordType: EntryType.INPUT_REGULAR,
          localAmountBeforeVAT: 300,
          roundedVATToAdd: 51,
        }),
      ],
    ),
  ],
  [
    'equipment (property) inputs',
    records(
      [vatRecord({ localAmountBeforeVAT: 10_000, roundedVATToAdd: 1700 })],
      [
        vatRecord({
          isExpense: true,
          isProperty: true,
          pcn874RecordType: undefined,
          localAmountBeforeVAT: 4204.066666666667,
          roundedVATToAdd: 476,
        }),
        vatRecord({
          isExpense: true,
          pcn874RecordType: undefined,
          localAmountBeforeVAT: 800,
          roundedVATToAdd: 136,
        }),
      ],
    ),
  ],
  [
    'unidentified customers, with and without VAT, including credit notes',
    records(
      [
        vatRecord({
          vatNumber: null,
          pcn874RecordType: undefined,
          foreignVatAfterDeduction: 1810.54,
          localAmountBeforeVAT: 16596.59136,
          roundedVATToAdd: 2598,
        }),
        vatRecord({
          vatNumber: null,
          pcn874RecordType: undefined,
          foreignVatAfterDeduction: -1810.54,
          localAmountBeforeVAT: -16596.59136,
          roundedVATToAdd: -2598,
        }),
        vatRecord({
          vatNumber: null,
          pcn874RecordType: undefined,
          localVat: null,
          foreignVatAfterDeduction: undefined,
          localAmountBeforeVAT: 2000.15,
          roundedVATToAdd: undefined,
        }),
        vatRecord({
          vatNumber: null,
          pcn874RecordType: EntryType.SALE_UNIDENTIFIED_CUSTOMER,
          localAmountBeforeVAT: 750,
          roundedVATToAdd: 0,
        }),
      ],
      [],
    ),
  ],
  [
    'local customer credit notes with VAT',
    records(
      [
        vatRecord({
          vatNumber: '191919191',
          pcn874RecordType: undefined,
          localAmountBeforeVAT: 3389.83,
          roundedVATToAdd: 610,
        }),
        vatRecord({
          vatNumber: '191919191',
          pcn874RecordType: undefined,
          localAmountBeforeVAT: -3389.83,
          roundedVATToAdd: -610,
        }),
        vatRecord({ localAmountBeforeVAT: 1500, roundedVATToAdd: 255 }),
      ],
      [],
    ),
  ],
  [
    'petty cash inputs',
    records(
      [],
      [
        vatRecord({
          isExpense: true,
          vatNumber: null,
          pcn874RecordType: EntryType.INPUT_PETTY_CASH,
          localAmountBeforeVAT: 374.32,
          roundedVATToAdd: 67,
        }),
        vatRecord({
          isExpense: true,
          vatNumber: null,
          pcn874RecordType: EntryType.INPUT_PETTY_CASH,
          localAmountBeforeVAT: 169.32,
          roundedVATToAdd: 30,
        }),
      ],
    ),
  ],
  [
    'entry types the header does not handle yet (S2, Y, R)',
    records(
      [
        vatRecord({ pcn874RecordType: EntryType.SALE_ZERO_OR_EXEMPT, localAmountBeforeVAT: 1000 }),
        vatRecord({ pcn874RecordType: EntryType.SALE_EXPORT, localAmountBeforeVAT: 2000 }),
        vatRecord({ localAmountBeforeVAT: 1000, roundedVATToAdd: 170 }),
      ],
      [
        vatRecord({
          isExpense: true,
          pcn874RecordType: EntryType.INPUT_IMPORT,
          localAmountBeforeVAT: 3000,
          roundedVATToAdd: 510,
        }),
      ],
    ),
  ],
  [
    'records without a document date',
    records(
      [
        vatRecord({ documentDate: null, localAmountBeforeVAT: 99_999, roundedVATToAdd: 16_999 }),
        vatRecord({ localAmountBeforeVAT: 1000, roundedVATToAdd: 170 }),
      ],
      [],
    ),
  ],
  ['an empty month', records([], [])],
];

beforeEach(() => {
  vi.mocked(getVatRecords).mockReset();
  vi.spyOn(console, 'debug').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parsePcn874HeaderTotals (test helper)', () => {
  it('reads back every total, signs included, from a generated header', () => {
    const totals: HeaderTotals = {
      taxableSalesAmount: -12_345,
      taxableSalesVat: 2099,
      salesRecordCount: 7,
      zeroValOrExemptSalesAmount: -400,
      otherInputsVat: 1234,
      equipmentInputsVat: -56,
      inputsCount: 3,
      totalVat: 921,
    };
    const { zeroValOrExemptSalesAmount, ...rest } = totals;
    const content = pcnGenerator(
      {
        licensedDealerId: VAT_NUMBER,
        reportMonth: '202401',
        generationDate: '20240201',
        zeroValOrExemptSalesCount: zeroValOrExemptSalesAmount,
        ...rest,
      },
      [],
    );

    expect(parsePcn874HeaderTotals(content)).toEqual(totals);
  });
});

describe('VatReportResult.summary', () => {
  describe.each(MONTHS)('for a month with %s', (_, month) => {
    it('matches the header of the PCN874 file for the same month', async () => {
      vi.mocked(getVatRecords).mockResolvedValue(month);
      const injector = createInjector();

      const summary = await resolveSummary(injector, filters);
      const { reportContent } = await getPcn874String(injector, BUSINESS_ID, MONTH);

      expect(summaryToRaw(summary)).toEqual(parsePcn874HeaderTotals(reportContent));
    });
  });

  it('ignores the chargesType filter and matches the file for the whole month', async () => {
    const [, wholeMonth] = MONTHS[0];
    vi.mocked(getVatRecords).mockImplementation(async ({ filters }) =>
      filters?.chargesType === 'INCOME' ? records(wholeMonth.income, []) : wholeMonth,
    );
    const injector = createInjector();

    const summary = await resolveSummary(injector, { ...filters, chargesType: 'INCOME' });
    const { reportContent } = await getPcn874String(injector, BUSINESS_ID, MONTH);

    expect(summary.inputsCount).toBe(2);
    expect(summaryToRaw(summary)).toEqual(parsePcn874HeaderTotals(reportContent));
  });

  it.each([
    ['without filters', null],
    ['without a charge type', filters],
    ['for all charge types', { ...filters, chargesType: 'ALL' as const }],
  ])('reuses the report records %s instead of fetching the month again', async (_, reportFilters) => {
    const [, month] = MONTHS[0];
    vi.mocked(getVatRecords).mockResolvedValue(month);

    await resolveSummary(createInjector(), reportFilters);

    expect(getVatRecords).toHaveBeenCalledTimes(1);
  });

  it('reports amounts in the local currency and counts as plain numbers', async () => {
    vi.mocked(getVatRecords).mockResolvedValue(
      records([vatRecord({ localAmountBeforeVAT: 1234, roundedVATToAdd: 210 })], []),
    );

    const summary = await resolveSummary(createInjector(Currency.Usd), filters);

    expect(summary.taxableSalesAmount).toEqual({
      raw: 1234,
      currency: Currency.Usd,
      formatted: expect.stringContaining('1,234'),
    });
    expect(summary.totalVat.currency).toBe(Currency.Usd);
    expect(summary.salesRecordCount).toBe(1);
    expect(summary.inputsCount).toBe(0);
  });
});

describe('Query.vatReport', () => {
  it('passes the request filters on to the result for its field resolvers', async () => {
    const [, month] = MONTHS[0];
    vi.mocked(getVatRecords).mockResolvedValue(month);
    const reportFilters = { ...filters, chargesType: 'EXPENSE' as const };

    const report = await vatReportResolver({}, { filters: reportFilters }, { injector: createInjector() }, {});

    expect(report).toEqual({ ...month, filters: reportFilters });
  });
});
