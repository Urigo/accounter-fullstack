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

  it('maps a presence flag of record 1000 to the declaration object it stands for', () => {
    expect(pathFor('1000', 0, 'declarations.familyCompany.isFamilyCompany')).toBe(
      'declarations.familyCompany',
    );
    expect(pathFor('1000', 0, 'declarations.beneficiaryEnterprise.marked')).toBe(
      'declarations.beneficiaryEnterprise',
    );
    expect(pathFor('1000', 0, 'declarations.specialYear.marked')).toBe('declarations.specialYear');
    expect(pathFor('1000', 0, 'declarations.specialYear.balanceSheetDate')).toBe(
      'declarations.specialYear.balanceSheetDate',
    );
  });

  it('maps a reportable position slot to its array element', () => {
    expect(pathFor('1000', 0, 'declarations.reportablePositions[3]')).toBe(
      'declarations.reportablePositions[3]',
    );
  });

  it('maps a record 1000 code to its amounts entry', () => {
    expect(pathFor('1000', 0, 'code:018')).toBe('amounts["018"]');
  });

  it('maps a record 1020 key into its shareholder', () => {
    expect(pathFor('1020', 3, 'fullName')).toBe('shareholders[3].fullName');
  });

  it('maps a record 1010 key into its related company', () => {
    expect(pathFor('1010', 2, 'relationType')).toBe('relatedCompanies[2].relationType');
  });

  it.each(['1000', '1010', '1020'] as const)(
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

  it.each(['1030', '2000', '2200', '3027', '3077'] as const)(
    'maps keys of record %s, which has no input mapping yet, to the empty path',
    recordType => {
      expect(pathFor(recordType, 0, 'anything')).toBe('');
    },
  );

  it('maps the fields of the control record 9999, which are all derived, to the empty path', () => {
    for (const field of LAYOUT.records['9999'].fields) {
      expect(pathFor('9999', 0, field.key)).toBe('');
    }
  });
});
