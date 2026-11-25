import { getLayout } from '../../src/layout/registry.js';
import type { RelatedCompany } from '../../src/model/input.js';
import { normalizeReport } from '../../src/normalize/report.js';
import { minimalInput, relatedCompanies } from '../fixtures/builders.js';

const LAYOUT = getLayout(2024);
const OPTIONS = { today: () => '2024-06-30' };

const FIRST: RelatedCompany = {
  companyName: '  חברת  האם\u00A0בע"מ ',
  companyFileNumber: '510000003',
  relationType: 'parent',
  assessingOfficeCode: 34,
};
const SECOND: RelatedCompany = {
  companyName: 'Subsidiary Ltd',
  relationType: 'other',
};

function relatedRecords(companies: RelatedCompany[]) {
  return normalizeReport(
    minimalInput({ relatedCompanies: companies }),
    LAYOUT,
    OPTIONS,
  ).records.filter(record => record.recordType === '1010');
}

describe('normalizeReport: records 1010 (related companies)', () => {
  it('places one record per related company, in input order, after 1000 and before 1020', () => {
    const report = normalizeReport(
      minimalInput({ relatedCompanies: [FIRST, SECOND] }),
      LAYOUT,
      OPTIONS,
    );
    expect(report.records.map(r => [r.recordType, r.index])).toEqual([
      ['1000', 0],
      ['1010', 0],
      ['1010', 1],
      ['1020', 0],
    ]);
  });

  it('maps every key with its value and path', () => {
    const [first, second] = relatedRecords([FIRST, SECOND]);
    expect(first?.values).toEqual({
      serialNumber: 1,
      companyName: 'חברת האם בע"מ',
      companyFileNumber: '510000003',
      relationType: 1,
      assessingOfficeCode: 34,
    });
    expect(first?.paths).toEqual({
      serialNumber: '',
      companyName: 'relatedCompanies[0].companyName',
      companyFileNumber: 'relatedCompanies[0].companyFileNumber',
      relationType: 'relatedCompanies[0].relationType',
      assessingOfficeCode: 'relatedCompanies[0].assessingOfficeCode',
    });
    expect(second?.values).toEqual({
      serialNumber: 2,
      companyName: 'Subsidiary Ltd',
      relationType: 8,
    });
    expect(second?.paths).toEqual({
      serialNumber: '',
      companyName: 'relatedCompanies[1].companyName',
      relationType: 'relatedCompanies[1].relationType',
    });
  });

  it('maps the relation types to 1..8 in the order of SPEC §7.2', () => {
    const records = relatedRecords(relatedCompanies(8));
    expect(records.map(record => record.values.relationType)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('keeps a relation type that is not a literal as-is (field.enum reports it)', () => {
    const [record] = relatedRecords([
      { ...SECOND, relationType: 'sister' as RelatedCompany['relationType'] },
    ]);
    expect(record?.values.relationType).toBe('sister');
  });

  it('sets index (0-based) and serialNumber (1-based)', () => {
    const records = relatedRecords(relatedCompanies(3));
    expect(records.map(r => [r.index, r.values.serialNumber])).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
    ]);
  });

  it('every key it sets is a field of record 1010; no codes or countries', () => {
    const keys = new Set(LAYOUT.records['1010'].fields.map(field => field.key));
    const [record] = relatedRecords([FIRST]);
    expect(Object.keys(record?.values ?? {}).every(key => keys.has(key))).toBe(true);
    expect(record?.codes.size).toBe(0);
    expect(record?.countries).toEqual([]);
  });

  it('emits no 1010 records without related companies or for an empty list', () => {
    expect(normalizeReport(minimalInput(), LAYOUT, OPTIONS).records.map(r => r.recordType)).toEqual(
      ['1000', '1020'],
    );
    expect(relatedRecords([])).toEqual([]);
  });
});
