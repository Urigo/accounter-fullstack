import { getLayout } from '../../src/layout/registry.js';
import { normalizeReport } from '../../src/normalize/report.js';
import { fullDeclarationsInput } from '../fixtures/builders.js';
import { unmappedHeaderKeys } from '../helpers/coverage.js';

const LAYOUT = getLayout(2024);
const MAIN = LAYOUT.records['1000'];

describe('normalizer coverage (SPEC §13.3)', () => {
  it('lists the keys of a record type that no record has a value for', () => {
    const report = normalizeReport(fullDeclarationsInput(), LAYOUT, { today: () => '2025-03-31' });
    const unmapped = unmappedHeaderKeys(MAIN, []);
    expect(unmapped).toEqual(
      MAIN.fields.filter(field => field.kind !== 'filler').map(field => field.key),
    );
    expect(unmappedHeaderKeys(LAYOUT.records['1020'], report.records)).toEqual([
      'votingRightsPercent',
      'otherRightsPercent',
      'isMaterialShareholder',
      'salaryMonths1To9',
      'salaryMonths10To12',
      'otherPayments',
    ]);
  });

  it('record 1000: only the header groups of step D2 remain unmapped', () => {
    const input = fullDeclarationsInput({
      company: {
        withholdingFileNumber: '940000001',
        vatFileNumber: '514000009',
        occupationDescription: 'ייעוץ',
        booksAddress: 'רחוב יפו 2, ירושלים',
        email: 'office@example.com',
        fax: { prefix: '052', number: '7654321' },
      },
    });
    const report = normalizeReport(input, LAYOUT, { today: () => '2025-03-31' });
    expect(unmappedHeaderKeys(MAIN, report.records)).toEqual([
      'otherTaxableIncome.source',
      'otherTaxableIncome.amount',
      'otherTaxableIncome.ratePercent',
      'attachments.donationReceiptsCount',
      'attachments.withholdingCertificatesCount',
      'capitalGainsSummary.totalAppendicesCount',
      'capitalGainsSummary.untransmittedCount',
      'capitalGainsSummary.reasons.lossOrNoGain',
      'capitalGainsSummary.reasons.overFiveImprovementBalances',
      'capitalGainsSummary.reasons.over14Appendices',
      'capitalGainsSummary.reasons.other',
      'capitalGainsSummary.reasons.otherText',
      'qualifyingCompany.purchased',
      'qualifyingCompany.israeliPurchaseAmount',
      'qualifyingCompany.foreignPurchaseAmount',
      'qualifyingCompany.amortizationClaimed',
      'qualifyingCompany.amortizationAmount',
    ]);
  });

  it('every 1000 header key between positions 563 and 1064 outside the D2 groups is produced', () => {
    const report = normalizeReport(fullDeclarationsInput(), LAYOUT, { today: () => '2025-03-31' });
    const inRange = MAIN.fields.filter(
      field =>
        field.position >= 563 &&
        field.position <= 1064 &&
        !field.key.startsWith('otherTaxableIncome.') &&
        !field.key.startsWith('attachments.') &&
        !field.key.startsWith('capitalGainsSummary.'),
    );
    const unmapped = new Set(unmappedHeaderKeys(MAIN, report.records));
    expect(inRange.filter(field => field.kind !== 'filler').length).toBeGreaterThan(40);
    expect(inRange.filter(field => unmapped.has(field.key)).map(field => field.key)).toEqual([]);
  });
});
