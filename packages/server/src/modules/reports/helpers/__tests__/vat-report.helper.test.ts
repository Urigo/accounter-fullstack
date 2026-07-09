import { describe, expect, it } from 'vitest';
import { Currency } from '../../../../shared/enums.js';
import {
  calculateMonthlyVatTotalAmount,
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
