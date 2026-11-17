import { Opcn1214UnsupportedYearError } from '../../src/errors.js';
import { getLayout, supportedTaxYears } from '../../src/layout/registry.js';

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
