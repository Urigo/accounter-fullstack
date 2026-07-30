import { describe, expect, it } from 'vitest';
import { Currency, DocumentType } from '../../../../shared/enums.js';
import type { IGetDocumentsByFiltersResult } from '../../../documents/types.js';
import {
  calculateMonthlyVatTotalAmount,
  isVatReportRelevantDocument,
  isWithinMonthlyVatAmountTolerance,
  type RawVatReportRecord,
} from '../vat-report.helper.js';

function createVatRecord(roundedVATToAdd?: number): RawVatReportRecord {
  return {
    businessId: 'business-1',
    chargeAccountantStatus: 'PENDING',
    chargeDate: new Date('2026-04-15'),
    chargeId: 'charge-1',
    currencyCode: Currency.Ils,
    documentAmount: '0',
    documentId: 'doc-1',
    documentDate: new Date('2026-04-15'),
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
