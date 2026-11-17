import { getLayout } from '../../src/layout/registry.js';
import type { RdInvestment } from '../../src/model/input.js';
import { normalizeReport } from '../../src/normalize/report.js';
import { minimalInput, rdInvestments, relatedCompanies } from '../fixtures/builders.js';

const LAYOUT = getLayout(2024);
const OPTIONS = { today: () => '2024-06-30' };

const FIRST: RdInvestment = {
  companyName: '  חברת  מו"פ בע"מ ',
  companyFileNumber: '520000001',
  investmentAmount: 250_000,
};
const SECOND: RdInvestment = {
  companyName: 'R&D Ltd',
  investmentAmount: 0,
};

function rdRecords(investments: RdInvestment[]) {
  return normalizeReport(
    minimalInput({ rdInvestments: investments }),
    LAYOUT,
    OPTIONS,
  ).records.filter(record => record.recordType === '1030');
}

describe('normalizeReport: records 1030 (R&D investments)', () => {
  it('places one record per investment, in input order, after 1010 and 1020', () => {
    const report = normalizeReport(
      minimalInput({ relatedCompanies: relatedCompanies(1), rdInvestments: [FIRST, SECOND] }),
      LAYOUT,
      OPTIONS,
    );
    expect(report.records.map(r => [r.recordType, r.index])).toEqual([
      ['1000', 0],
      ['1010', 0],
      ['1020', 0],
      ['1030', 0],
      ['1030', 1],
    ]);
  });

  it('maps every key with its value and path; affiliation is always 1 (company)', () => {
    const [first, second] = rdRecords([FIRST, SECOND]);
    expect(first?.values).toEqual({
      affiliation: 1,
      companyName: 'חברת מו"פ בע"מ',
      companyFileNumber: '520000001',
      investmentAmount: 250_000,
    });
    expect(first?.paths).toEqual({
      affiliation: '',
      companyName: 'rdInvestments[0].companyName',
      companyFileNumber: 'rdInvestments[0].companyFileNumber',
      investmentAmount: 'rdInvestments[0].investmentAmount',
    });
    expect(second?.values).toEqual({ affiliation: 1, companyName: 'R&D Ltd', investmentAmount: 0 });
    expect(second?.paths).toEqual({
      affiliation: '',
      companyName: 'rdInvestments[1].companyName',
      investmentAmount: 'rdInvestments[1].investmentAmount',
    });
  });

  it('sets index (0-based) and affiliation 1 on every record', () => {
    const records = rdRecords(rdInvestments(5));
    expect(records.map(r => [r.index, r.values.affiliation])).toEqual([
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
      [4, 1],
    ]);
  });

  it('rounds investment amounts per options.rounding', () => {
    const [record] = normalizeReport(
      minimalInput({ rdInvestments: [{ ...SECOND, investmentAmount: 1000.5 }] }),
      LAYOUT,
      { ...OPTIONS, rounding: 'halfUp' },
    ).records.filter(r => r.recordType === '1030');
    expect(record?.values.investmentAmount).toBe(1001);
  });

  it('every key it sets is a field of record 1030; no codes or countries', () => {
    const keys = new Set(LAYOUT.records['1030'].fields.map(field => field.key));
    const [record] = rdRecords([FIRST]);
    expect(Object.keys(record?.values ?? {}).every(key => keys.has(key))).toBe(true);
    expect(record?.codes.size).toBe(0);
    expect(record?.countries).toEqual([]);
  });

  it('emits no 1030 records without investments or for an empty list', () => {
    expect(normalizeReport(minimalInput(), LAYOUT, OPTIONS).records.map(r => r.recordType)).toEqual(
      ['1000', '1020'],
    );
    expect(rdRecords([])).toEqual([]);
  });
});
