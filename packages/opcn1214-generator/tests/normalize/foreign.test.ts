import { getLayout } from '../../src/layout/registry.js';
import type { ForeignAppendix } from '../../src/model/input.js';
import type { ValidateOptions } from '../../src/model/options.js';
import { normalizeReport } from '../../src/normalize/report.js';
import {
  foreignAppendix,
  minimalInput,
  rdInvestments,
  rdInvestmentsTotal,
  relatedCompanies,
} from '../fixtures/builders.js';

const LAYOUT = getLayout(2024);
const OPTIONS: ValidateOptions = { today: () => '2024-06-30' };

function reportWith(appendix: ForeignAppendix | undefined, options = OPTIONS) {
  return normalizeReport(minimalInput({ foreignAppendix: appendix }), LAYOUT, options);
}

function foreignRecord(appendix: ForeignAppendix, options = OPTIONS) {
  const records = reportWith(appendix, options).records.filter(r => r.recordType === '2000');
  expect(records).toHaveLength(1);
  return records[0]!;
}

describe('normalizeReport: record 2000 (foreign appendix)', () => {
  it('maps every header key with its value and path foreignAppendix.<key>', () => {
    const record = foreignRecord(
      foreignAppendix({ otherTaxableIncomeDescription: '  תמלוגים\u00A0 מחו"ל ' }),
    );
    expect(record.index).toBe(0);
    expect(record.values).toEqual({
      otherTaxableIncomeDescription: 'תמלוגים מחו"ל',
      otherTaxableIncome: 40_000,
      foreignTaxPaidOnOtherIncome: 6000,
      totalForeignTaxableIncome: 120_000,
      totalForeignLoss: 15_000,
      participationExemptionHoldingCompany: 7000,
      taxRefundDeclaration: true,
      taxRefundDeclarationAmount: 2500,
    });
    expect(record.paths).toEqual({
      otherTaxableIncomeDescription: 'foreignAppendix.otherTaxableIncomeDescription',
      otherTaxableIncome: 'foreignAppendix.otherTaxableIncome',
      foreignTaxPaidOnOtherIncome: 'foreignAppendix.foreignTaxPaidOnOtherIncome',
      totalForeignTaxableIncome: 'foreignAppendix.totalForeignTaxableIncome',
      totalForeignLoss: 'foreignAppendix.totalForeignLoss',
      participationExemptionHoldingCompany: 'foreignAppendix.participationExemptionHoldingCompany',
      taxRefundDeclaration: 'foreignAppendix.taxRefundDeclaration',
      taxRefundDeclarationAmount: 'foreignAppendix.taxRefundDeclarationAmount',
      'code:401': 'foreignAppendix.amounts["401"]',
      'code:425': 'foreignAppendix.amounts["425"]',
      'code:494': 'foreignAppendix.amounts["494"]',
    });
    expect(record.countries).toEqual([]);
  });

  it('keeps only the required yes/no 247 when nothing else is given', () => {
    const record = foreignRecord({ taxRefundDeclaration: false, amounts: {} });
    expect(record.values).toEqual({ taxRefundDeclaration: false });
    expect(record.paths).toEqual({ taxRefundDeclaration: 'foreignAppendix.taxRefundDeclaration' });
    expect(record.codes.size).toBe(0);
  });

  it('maps amounts to codes in ascending order, with paths foreignAppendix.amounts["NNN"]', () => {
    const record = foreignRecord({
      taxRefundDeclaration: false,
      amounts: { '494': 3, '420': 50_000, '401': 7 },
    });
    expect([...record.codes]).toEqual([
      ['401', 7],
      ['420', 50_000],
      ['494', 3],
    ]);
    expect(record.paths['code:420']).toBe('foreignAppendix.amounts["420"]');
  });

  it('keeps a zero for code 442 (zeroAllowed) and omits other zero codes, listing them', () => {
    const report = reportWith({
      taxRefundDeclaration: false,
      amounts: { '420': 0, '442': 0, '401': 0, '425': 5 },
    });
    const record = report.records.find(r => r.recordType === '2000');
    expect([...(record?.codes ?? [])]).toEqual([
      ['425', 5],
      ['442', 0],
    ]);
    expect(record?.paths).not.toHaveProperty('code:420');
    expect(report.omittedZeroCodes).toEqual([
      { record: '2000', recordIndex: 0, code: '401' },
      { record: '2000', recordIndex: 0, code: '420' },
    ]);
  });

  it('lists omitted zero codes of 1000 before those of 2000', () => {
    const report = normalizeReport(
      minimalInput({
        amounts: { '010': 0 },
        foreignAppendix: { taxRefundDeclaration: false, amounts: { '401': 0 } },
      }),
      LAYOUT,
      OPTIONS,
    );
    expect(report.omittedZeroCodes).toEqual([
      { record: '1000', recordIndex: 0, code: '010' },
      { record: '2000', recordIndex: 0, code: '401' },
    ]);
  });

  it('rounds header amounts and codes per options.rounding before omitting zeros', () => {
    const report = reportWith(
      foreignAppendix({ otherTaxableIncome: 999.5, amounts: { '401': 0.4, '403': 2.5 } }),
      { ...OPTIONS, rounding: 'halfUp' },
    );
    const record = report.records.find(r => r.recordType === '2000');
    expect(record?.values.otherTaxableIncome).toBe(1000);
    expect(record?.codes.get('403')).toBe(3);
    expect(record?.codes.has('401')).toBe(false);
    expect(report.omittedZeroCodes).toContainEqual({ record: '2000', recordIndex: 0, code: '401' });
  });

  it('places the 2000 record after 1010, 1020 and 1030', () => {
    const report = normalizeReport(
      minimalInput({
        relatedCompanies: relatedCompanies(1),
        rdInvestments: rdInvestments(2),
        amounts: { '165': rdInvestmentsTotal(2) },
        foreignAppendix: foreignAppendix(),
      }),
      LAYOUT,
      OPTIONS,
    );
    expect(report.records.map(r => [r.recordType, r.index])).toEqual([
      ['1000', 0],
      ['1010', 0],
      ['1020', 0],
      ['1030', 0],
      ['1030', 1],
      ['2000', 0],
    ]);
  });

  it('every key it sets is a field of record 2000', () => {
    const keys = new Set(LAYOUT.records['2000'].fields.map(field => field.key));
    const record = foreignRecord(foreignAppendix());
    expect(Object.keys(record.values).every(key => keys.has(key))).toBe(true);
  });

  it('emits no 2000 record without a foreign appendix', () => {
    expect(reportWith(undefined).records.map(r => r.recordType)).toEqual(['1000', '1020']);
  });

  it('derives 1000@832 from the presence of the appendix (SPEC §7.4)', () => {
    const main = (appendix?: ForeignAppendix) =>
      reportWith(appendix).records.find(r => r.recordType === '1000');
    expect(main(foreignAppendix())?.values.hasForeignAppendix).toBe(true);
    expect(main({ taxRefundDeclaration: false, amounts: {} })?.values.hasForeignAppendix).toBe(
      true,
    );
    expect(main()?.values.hasForeignAppendix).toBe(false);
    expect(main(foreignAppendix())?.paths.hasForeignAppendix).toBe('');
  });
});
