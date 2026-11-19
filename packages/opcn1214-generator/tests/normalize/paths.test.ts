import { getLayout } from '../../src/layout/registry.js';
import { DERIVED_MAIN_CODES } from '../../src/model/codes.generated.js';
import {
  countryEntryKey,
  incomeEntryKey,
  inputIndexOf,
  pathFor,
} from '../../src/normalize/paths.js';

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

  it('maps a record 1030 key into its R&D investment', () => {
    expect(pathFor('1030', 4, 'investmentAmount')).toBe('rdInvestments[4].investmentAmount');
  });

  it('maps a record 2000 key into the foreign appendix and a code to its amounts entry', () => {
    expect(pathFor('2000', 0, 'otherTaxableIncome')).toBe('foreignAppendix.otherTaxableIncome');
    expect(pathFor('2000', 0, 'taxRefundDeclaration')).toBe('foreignAppendix.taxRefundDeclaration');
    expect(pathFor('2000', 0, 'code:420')).toBe('foreignAppendix.amounts["420"]');
    expect(pathFor('2000', 0, 'code:442')).toBe('foreignAppendix.amounts["442"]');
  });

  it('maps every field and code of record 2000, none of which is derived, to an input path', () => {
    const def = LAYOUT.records['2000'];
    expect(def.fields.filter(field => field.derived)).toEqual([]);
    expect(def.codes.filter(code => code.derived)).toEqual([]);
    for (const field of def.fields.filter(candidate => candidate.kind !== 'filler')) {
      expect(pathFor('2000', 0, field.key)).toBe(`foreignAppendix.${field.key}`);
    }
  });

  it.each(['1000', '1010', '1020', '1030'] as const)(
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

  it('maps a record 2200, keyed by its 2000 code, into its breakdown (SPEC §7.3)', () => {
    expect(pathFor('2200', 420, 'code')).toBe('foreignAppendix.countryBreakdown["420"]');
    expect(pathFor('2200', 439, 'deductionsOffsetsAndExemptions')).toBe(
      'foreignAppendix.countryBreakdown["439"].deductionsOffsetsAndExemptions',
    );
    expect(pathFor('2200', 420, countryEntryKey(2))).toBe(
      'foreignAppendix.countryBreakdown["420"].countries[2].country',
    );
    expect(pathFor('2200', 420, incomeEntryKey(0))).toBe(
      'foreignAppendix.countryBreakdown["420"].countries[0].income',
    );
  });

  it('gives the pathFor input index of a record: its index, or the code of a 2200 record', () => {
    const record = { index: 3, values: { code: 439 } };
    expect(inputIndexOf({ ...record, recordType: '1020' })).toBe(3);
    expect(inputIndexOf({ ...record, recordType: '2200' })).toBe(439);
    expect(inputIndexOf({ ...record, recordType: '2200', values: {} })).toBe(0);
  });

  it('maps a record 3063 key into its appendix capitalGains[i], by input index (SPEC §7.3)', () => {
    expect(pathFor('3063', 2, 'foreignAsset')).toBe('capitalGains[2].foreignAsset');
    expect(pathFor('3063', 0, 'lossesCarriedForward')).toBe('capitalGains[0].lossesCarriedForward');
    expect(pathFor('3063', 4, 'code:022')).toBe('capitalGains[4].amounts["022"]');
  });

  it('maps the derived symbol and appendix number of record 3063 to the empty path', () => {
    const derived = LAYOUT.records['3063'].fields.filter(field => field.derived);
    expect(derived.map(field => field.key)).toEqual(['transactionSymbol', 'appendixNumber']);
    for (const field of derived) {
      expect(pathFor('3063', 1, field.key)).toBe('');
    }
  });

  it('gives a capital-gains record its input index, which differs from its index by type', () => {
    expect(inputIndexOf({ recordType: '3063', index: 0, inputIndex: 3, values: {} })).toBe(3);
    // Without an input index (not set), the index among records of the type.
    expect(inputIndexOf({ recordType: '3063', index: 2, values: {} })).toBe(2);
    // Other records ignore it.
    expect(inputIndexOf({ recordType: '1020', index: 1, inputIndex: 5, values: {} })).toBe(1);
  });

  it.each(['3060', '3064'] as const)(
    'maps a record %s key, withholder slots included, into capitalGains[i] (SPEC §7.3)',
    recordType => {
      expect(pathFor(recordType, 1, 'soldToRelatedParty')).toBe(
        'capitalGains[1].soldToRelatedParty',
      );
      expect(pathFor(recordType, 0, 'withholders[3].branch')).toBe(
        'capitalGains[0].withholders[3].branch',
      );
      expect(pathFor(recordType, 2, 'code:056')).toBe('capitalGains[2].amounts["056"]');
      const derived = LAYOUT.records[recordType].fields.filter(field => field.derived);
      expect(derived.map(field => field.key)).toEqual(['transactionSymbol', 'appendixNumber']);
      for (const field of derived) {
        expect(pathFor(recordType, 1, field.key)).toBe('');
      }
    },
  );

  it.each(['3065', '3066'] as const)(
    'maps a record %s key into capitalGains[i]; symbol, appendix number and sequence are derived',
    recordType => {
      expect(pathFor(recordType, 3, 'withholdingStatus')).toBe('capitalGains[3].withholdingStatus');
      expect(pathFor(recordType, 1, 'lossesCarriedForward')).toBe(
        'capitalGains[1].lossesCarriedForward',
      );
      expect(pathFor(recordType, 2, 'code:056')).toBe('capitalGains[2].amounts["056"]');
      const derived = LAYOUT.records[recordType].fields.filter(field => field.derived);
      expect(derived.map(field => field.key)).toEqual([
        'transactionSymbol',
        'appendixNumber',
        'sequenceNumber',
      ]);
      for (const field of derived) {
        expect(pathFor(recordType, 1, field.key)).toBe('');
      }
    },
  );

  it('maps a record 3065 withholder slot key into capitalGains[i].withholders[j]', () => {
    expect(pathFor('3065', 0, 'withholders[3].account')).toBe(
      'capitalGains[0].withholders[3].account',
    );
  });

  it.each(['3027', '3051'] as const)(
    'maps a record %s key, dates and wallet slots included, into capitalGains[i]; the sequence is derived',
    recordType => {
      expect(pathFor(recordType, 2, 'assetLocation')).toBe('capitalGains[2].assetLocation');
      expect(pathFor(recordType, 1, 'dates.code15')).toBe('capitalGains[1].dates.code15');
      expect(pathFor(recordType, 0, 'code:015')).toBe('capitalGains[0].amounts["015"]');
      const derived = LAYOUT.records[recordType].fields.filter(field => field.derived);
      expect(derived.map(field => field.key)).toEqual([
        'transactionSymbol',
        'appendixNumber',
        'sequenceNumber',
      ]);
      for (const field of derived) {
        expect(pathFor(recordType, 1, field.key)).toBe('');
      }
    },
  );

  it('maps a record 3051 wallet slot key into capitalGains[i].walletAddresses[j]', () => {
    expect(pathFor('3051', 4, 'walletAddresses[1]')).toBe('capitalGains[4].walletAddresses[1]');
  });

  it.each(['3050', '3054'] as const)(
    'maps a record %s key into capitalGains[i]; symbol and appendix number are derived',
    recordType => {
      expect(pathFor(recordType, 3, 'purchaseDate')).toBe('capitalGains[3].purchaseDate');
      expect(pathFor(recordType, 0, 'dates.code15')).toBe('capitalGains[0].dates.code15');
      expect(pathFor(recordType, 1, 'code:016')).toBe('capitalGains[1].amounts["016"]');
      const derived = LAYOUT.records[recordType].fields.filter(field => field.derived);
      expect(derived.map(field => field.key)).toEqual(['transactionSymbol', 'appendixNumber']);
      for (const field of derived) {
        expect(pathFor(recordType, 1, field.key)).toBe('');
      }
    },
  );

  it('maps keys of record 3077, which has no input mapping yet, to the empty path', () => {
    expect(pathFor('3077', 0, 'anything')).toBe('');
  });

  it('maps the fields of the control record 9999, which are all derived, to the empty path', () => {
    for (const field of LAYOUT.records['9999'].fields) {
      expect(pathFor('9999', 0, field.key)).toBe('');
    }
  });
});
