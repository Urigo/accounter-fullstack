import { Opcn1214UnsupportedYearError } from '../../src/errors.js';
import { getLayout, provisionalBaseYear, supportedTaxYears } from '../../src/layout/registry.js';

describe('layout registry', () => {
  it('supports the tax years 2024 and 2025', () => {
    expect(supportedTaxYears()).toEqual([2024, 2025]);
  });

  it('returns the layout of the requested year', () => {
    expect(getLayout(2024).taxYear).toBe(2024);
    expect(getLayout(2025).taxYear).toBe(2025);
  });

  it('reuses the 2024 layout for 2025, except taxYear (SPEC §14)', () => {
    const layout2024 = getLayout(2024);
    const layout2025 = getLayout(2025);
    expect({ ...layout2025, taxYear: 2024 }).toEqual(layout2024);
    expect(layout2025.records).toBe(layout2024.records);
    expect(layout2025.countries).toBe(layout2024.countries);
    expect(layout2025.limits).toBe(layout2024.limits);
  });

  it('marks 2025 as provisional on the 2024 layout, and only 2025 (SPEC §14)', () => {
    expect(supportedTaxYears().map(taxYear => [taxYear, provisionalBaseYear(taxYear)])).toEqual([
      [2024, undefined],
      [2025, 2024],
    ]);
  });

  it.each([2023, 2026])('throws Opcn1214UnsupportedYearError for %i', taxYear => {
    let thrown: unknown;
    try {
      getLayout(taxYear);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Opcn1214UnsupportedYearError);
    const error = thrown as Opcn1214UnsupportedYearError;
    expect(error.taxYear).toBe(taxYear);
    expect(error.message).toContain(String(taxYear));
    expect(error.issues).toHaveLength(1);
    expect(error.issues[0]).toMatchObject({
      ruleId: 'struct.taxYear.unsupported',
      severity: 'error',
      path: 'taxYear',
      value: taxYear,
      expected: 'one of 2024, 2025',
    });
  });

  it.each(supportedTaxYears().map(taxYear => [taxYear]))(
    'returns a deeply frozen layout for %i',
    taxYear => {
      const layout = getLayout(taxYear);
      expect(Object.isFrozen(layout)).toBe(true);
      expect(Object.isFrozen(layout.records)).toBe(true);
      expect(Object.isFrozen(layout.limits)).toBe(true);
      for (const record of Object.values(layout.records)) {
        expect(Object.isFrozen(record)).toBe(true);
        expect(Object.isFrozen(record.fields)).toBe(true);
        expect(Object.isFrozen(record.codes)).toBe(true);
        if (record.section) {
          expect(Object.isFrozen(record.section)).toBe(true);
        }
        for (const def of [...record.fields, ...record.codes]) {
          expect(Object.isFrozen(def)).toBe(true);
          if (def.values) {
            expect(Object.isFrozen(def.values)).toBe(true);
            expect(def.values.every(value => Object.isFrozen(value))).toBe(true);
          }
        }
      }
    },
  );

  it('returns a frozen list of supported years', () => {
    expect(Object.isFrozen(supportedTaxYears())).toBe(true);
  });
});

describe('2024 layout: shopcn findings of FIX-2 (SPEC §15 A-29, A-31)', () => {
  const records = getLayout(2024).records;
  const field = (record: '1010' | '1030', key: string) =>
    records[record].fields.find(def => def.key === key);

  it.each([
    ['1010', 139],
    ['1030', 138],
  ] as const)('%s company name is hebrewText', (record, position) => {
    expect(field(record, 'companyName')).toMatchObject({ position, kind: 'hebrewText' });
  });

  it('3077 code 092 is an enum whose only value is 1', () => {
    expect(records['3077'].codes.find(def => def.code === '092')).toMatchObject({
      kind: 'enum',
      values: [{ value: 1 }],
    });
  });

  it('1000@225 (withholding file) stays an id9', () => {
    expect(
      records['1000'].fields.find(def => def.key === 'company.withholdingFileNumber'),
    ).toMatchObject({ position: 225, kind: 'id9' });
  });
});
