import type { Injector } from 'graphql-modules';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Currency, DocumentType } from '../../../../shared/enums.js';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { DepreciationProvider } from '../../../depreciation/providers/depreciation.provider.js';
import type { IGetDocumentsByFiltersResult } from '../../../documents/types.js';
import {
  adjustTaxRecord,
  calculateMonthlyVatTotalAmount,
  describeIncompleteVatReportDocuments,
  getVatReportDocumentMissingFields,
  isVatReportRelevantDocument,
  isWithinMonthlyVatAmountTolerance,
  type RawVatReportRecord,
  type VatReportRecordSources,
} from '../vat-report.helper.js';

vi.mock('../../../charges/helpers/common.helper.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../charges/helpers/common.helper.js')>()),
  getChargeTransactionsMeta: vi.fn(async () => ({ transactionsMinEventDate: '2026-04-15' })),
  getChargeDocumentsMeta: vi.fn(async () => ({ documentsMinDate: '2026-04-15' })),
}));

function createVatRecord(roundedVATToAdd?: number): RawVatReportRecord {
  return {
    businessId: 'business-1',
    chargeAccountantStatus: 'PENDING',
    chargeDate: '2026-04-15',
    chargeId: 'charge-1',
    currencyCode: Currency.Ils,
    documentAmount: '0',
    documentId: 'doc-1',
    documentDate: '2026-04-15',
    documentSerial: null,
    documentUrl: null,
    isExpense: false,
    isProperty: false,
    roundedVATToAdd,
    foreignVat: null,
    localVat: null,
  };
}

describe('vat-report helper monthly VAT utilities', () => {
  it('calculates monthly VAT amount using income VAT minus expenses VAT', () => {
    const total = calculateMonthlyVatTotalAmount(
      [createVatRecord(100), createVatRecord(25)],
      [createVatRecord(50), createVatRecord(10)],
    );

    expect(total).toBe(65);
  });

  it('treats missing rounded VAT values as zero', () => {
    const total = calculateMonthlyVatTotalAmount(
      [createVatRecord(undefined), createVatRecord(40)],
      [createVatRecord(undefined), createVatRecord(15)],
    );

    expect(total).toBe(25);
  });

  it('compares VAT and transaction totals by absolute value with tolerance', () => {
    expect(isWithinMonthlyVatAmountTolerance(100, -100)).toBe(true);
    expect(isWithinMonthlyVatAmountTolerance(100, -100.009)).toBe(true);
    expect(isWithinMonthlyVatAmountTolerance(100, -100.02)).toBe(false);
    expect(isWithinMonthlyVatAmountTolerance(100, 100)).toBe(false);
  });
});

function createDocument(
  overrides: Partial<IGetDocumentsByFiltersResult> = {},
): IGetDocumentsByFiltersResult {
  return {
    charge_id: 'charge-1',
    creditor_id: 'creditor-1',
    debtor_id: 'debtor-1',
    type: DocumentType.Invoice,
    ...overrides,
  } as IGetDocumentsByFiltersResult;
}

describe('isVatReportRelevantDocument', () => {
  it('accepts financial (invoice) documents linked to a charge with both counterparties', () => {
    expect(isVatReportRelevantDocument(createDocument({ type: DocumentType.Invoice }))).toBe(true);
    expect(
      isVatReportRelevantDocument(createDocument({ type: DocumentType.InvoiceReceipt })),
    ).toBe(true);
    expect(
      isVatReportRelevantDocument(createDocument({ type: DocumentType.CreditInvoice })),
    ).toBe(true);
  });

  it('rejects "OTHER" documents even when they carry a date and counterparties (issue #3375)', () => {
    expect(isVatReportRelevantDocument(createDocument({ type: DocumentType.Other }))).toBe(false);
  });

  it('rejects other non-financial document types', () => {
    expect(isVatReportRelevantDocument(createDocument({ type: DocumentType.Receipt }))).toBe(false);
    expect(isVatReportRelevantDocument(createDocument({ type: DocumentType.Proforma }))).toBe(false);
    expect(
      isVatReportRelevantDocument(createDocument({ type: DocumentType.Unprocessed })),
    ).toBe(false);
  });

  it('rejects documents missing a charge or a counterparty', () => {
    expect(isVatReportRelevantDocument(createDocument({ charge_id: null }))).toBe(false);
    expect(isVatReportRelevantDocument(createDocument({ creditor_id: null }))).toBe(false);
    expect(isVatReportRelevantDocument(createDocument({ debtor_id: null }))).toBe(false);
  });
});

describe('getVatReportDocumentMissingFields', () => {
  const complete = { total_amount: 117, currency_code: 'ILS', date: '2026-04-15' } as const;

  it('returns nothing for a document the tax adjustment can compute', () => {
    expect(getVatReportDocumentMissingFields(complete)).toEqual([]);
  });

  it('names each missing field', () => {
    expect(getVatReportDocumentMissingFields({ ...complete, total_amount: null })).toEqual([
      'amount',
    ]);
    expect(getVatReportDocumentMissingFields({ ...complete, currency_code: null })).toEqual([
      'currency',
    ]);
    expect(getVatReportDocumentMissingFields({ ...complete, date: null })).toEqual(['date']);
    expect(
      getVatReportDocumentMissingFields({ total_amount: null, currency_code: null, date: null }),
    ).toEqual(['amount', 'currency', 'date']);
  });

  it('describes incomplete documents in one line', () => {
    expect(
      describeIncompleteVatReportDocuments([
        { documentId: 'doc-1', chargeId: 'charge-1', missingFields: ['currency'] },
        { documentId: 'doc-2', chargeId: 'charge-2', missingFields: ['amount', 'date'] },
      ]),
    ).toBe(
      'document ID=doc-1 (charge ID=charge-1) is missing currency; document ID=doc-2 (charge ID=charge-2) is missing amount, date',
    );
  });
});

describe('adjustTaxRecord failures', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function sources(): VatReportRecordSources {
    return {
      charge: { id: 'charge-1', is_property: false },
      doc: {
        id: 'doc-1',
        type: DocumentType.Invoice,
        total_amount: 117,
        vat_amount: 17,
        currency_code: 'ILS',
        date: '2026-04-15',
      },
      business: { id: 'business-1' },
    } as unknown as VatReportRecordSources;
  }

  function injectorWithDepreciation(load: () => Promise<unknown>) {
    const providers = new Map<unknown, unknown>([
      [
        AdminContextProvider,
        {
          getVerifiedAdminContext: vi
            .fn()
            .mockResolvedValue({ defaultLocalCurrency: Currency.Ils, locality: 'ISR' }),
        },
      ],
      [DepreciationProvider, { getDepreciationRecordsByChargeIdLoader: { load } }],
    ]);
    return { get: (token: unknown) => providers.get(token) } as unknown as Injector;
  }

  it('rejects without logging, leaving the log line to the caller (#4946)', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      adjustTaxRecord(
        sources(),
        injectorWithDepreciation(async () => {
          throw new Error('depreciation lookup failed');
        }),
      ),
    ).rejects.toThrow('depreciation lookup failed');

    expect(consoleError).not.toHaveBeenCalled();
  });

  it('names the missing fields if called with an incomplete document', async () => {
    const record = sources();
    record.doc = { ...record.doc, currency_code: null, date: null };

    await expect(
      adjustTaxRecord(record, injectorWithDepreciation(async () => [])),
    ).rejects.toThrow('Invoice ID=doc-1 is missing currency, date');
  });
});
