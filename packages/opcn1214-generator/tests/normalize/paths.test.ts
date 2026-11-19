import { Opcn1214InternalError } from '../../src/errors.js';
import { getLayout } from '../../src/layout/registry.js';
import { DERIVED_MAIN_CODES } from '../../src/model/codes.generated.js';
import { pathFor } from '../../src/normalize/paths.js';

const LAYOUT = getLayout(2024);

describe('pathFor (SPEC §7.3, §9.1 path grammar)', () => {
  it('maps a record 1000 key to the same dotted input path', () => {
    expect(pathFor('1000', 0, 'company.phone.number')).toBe('company.phone.number');
    expect(pathFor('1000', 0, 'taxYear')).toBe('taxYear');
    expect(pathFor('1000', 0, 'declarations.hasCapitalGainsAppendix')).toBe(
      'declarations.hasCapitalGainsAppendix',
    );
  });

  it('maps a record 1000 code to its amounts entry', () => {
    expect(pathFor('1000', 0, 'code:018')).toBe('amounts["018"]');
  });

  it('maps a record 1020 key into its shareholder', () => {
    expect(pathFor('1020', 3, 'fullName')).toBe('shareholders[3].fullName');
  });

  it.each(['1000', '1020'] as const)(
    'maps every derived field of record %s to the empty path',
    recordType => {
      const derived = LAYOUT.records[recordType].fields.filter(field => field.derived);
      expect(derived.length).toBeGreaterThan(0);
      for (const field of derived) {
        expect(pathFor(recordType, 0, field.key)).toBe('');
      }
    },
  );

  it.each(DERIVED_MAIN_CODES)('maps the derived code %s to the empty path', code => {
    expect(pathFor('1000', 0, `code:${code}`)).toBe('');
  });

  it('throws an internal error for a record type it does not map yet', () => {
    expect(() => pathFor('3077', 0, 'symbol')).toThrow(Opcn1214InternalError);
  });
});
