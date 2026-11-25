import { getLayout } from '../../src/layout/registry.js';
import { normalizeReport } from '../../src/normalize/report.js';
import {
  foreignAppendix,
  foreignAppendixWithBreakdown,
  fullDeclarationsInput,
  fullMainInput,
  rdInvestments,
  relatedCompanies,
} from '../fixtures/builders.js';
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

  it('record 1000: every non-filler header key is mapped', () => {
    const input = fullMainInput({
      company: {
        withholdingFileNumber: '940000003',
        vatFileNumber: '514000009',
        occupationDescription: 'ייעוץ',
        booksAddress: 'רחוב יפו 2, ירושלים',
        email: 'office@example.com',
        fax: { prefix: '052', number: '7654321' },
      },
      // fullMainInput() leaves 1064 out because it has a bank account.
      declarations: { noBankAccount: true },
    });
    const report = normalizeReport(input, LAYOUT, { today: () => '2025-03-31' });
    expect(unmappedHeaderKeys(MAIN, report.records)).toEqual([]);
  });

  it('record 1010: every non-filler header key is mapped', () => {
    const input = fullMainInput({ relatedCompanies: relatedCompanies(1) });
    const report = normalizeReport(input, LAYOUT, { today: () => '2025-03-31' });
    expect(unmappedHeaderKeys(LAYOUT.records['1010'], report.records)).toEqual([]);
  });

  it('record 1030: every non-filler header key is mapped', () => {
    const input = fullMainInput({ rdInvestments: rdInvestments(1) });
    const report = normalizeReport(input, LAYOUT, { today: () => '2025-03-31' });
    expect(unmappedHeaderKeys(LAYOUT.records['1030'], report.records)).toEqual([]);
  });

  it('record 2000: every non-filler header key is mapped', () => {
    const input = fullMainInput({ foreignAppendix: foreignAppendix() });
    const report = normalizeReport(input, LAYOUT, { today: () => '2025-03-31' });
    expect(unmappedHeaderKeys(LAYOUT.records['2000'], report.records)).toEqual([]);
  });

  it('record 2200: every non-filler header key is mapped', () => {
    const input = fullMainInput({ foreignAppendix: foreignAppendixWithBreakdown('420') });
    const report = normalizeReport(input, LAYOUT, { today: () => '2025-03-31' });
    expect(unmappedHeaderKeys(LAYOUT.records['2200'], report.records)).toEqual([]);
  });
});
