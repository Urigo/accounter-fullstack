import { codecFor } from '../../src/codec/registry.js';
import { Opcn1214InternalError } from '../../src/errors.js';
import { getLayout } from '../../src/layout/registry.js';
import type { PhonePrefix, Shareholder } from '../../src/model/input.js';
import type { NormalizedRecord, NormalizedReport } from '../../src/model/normalized.js';
import { codeKey } from '../../src/normalize/paths.js';
import { normalizeReport } from '../../src/normalize/report.js';
import { runPipeline } from '../../src/pipeline.js';
import { runRules } from '../../src/validate/engine.js';
import { fieldRules } from '../../src/validate/field-rules.js';
import type { Issue } from '../../src/validate/issue.js';
import type { RuleId } from '../../src/validate/rules.js';
import { fullDeclarationsInput, minimalInput } from '../fixtures/builders.js';

const LAYOUT = getLayout(2024);
const OPTIONS = { today: () => '2024-06-30' };

function issuesOf(input: unknown, ruleId: RuleId): Issue[] {
  return runPipeline(input, OPTIONS).issues.filter(issue => issue.ruleId === ruleId);
}

/** minimalInput() with its single shareholder changed by `overrides`. */
function withShareholder(overrides: Partial<Shareholder>) {
  const shareholders = minimalInput().shareholders.map(shareholder => ({
    ...shareholder,
    ...overrides,
  }));
  return minimalInput({ shareholders });
}

describe('field rules through runPipeline (SPEC §9.3, §10.2)', () => {
  it('reports nothing for the minimal input', () => {
    expect(runPipeline(minimalInput(), OPTIONS).issues).toEqual([]);
  });

  describe('field.required', () => {
    it('reports a missing required header field with its layout position', () => {
      const input = minimalInput({ company: { registeredName: '' } });
      expect(issuesOf(input, 'field.required')).toEqual([
        expect.objectContaining({
          severity: 'error',
          path: 'company.registeredName',
          recordType: '1000',
          recordIndex: 0,
          field: { position: 175, length: 50, nameHe: 'שם רשום' },
          specRef: { page: 5 },
        }),
      ]);
    });

    it('reports a text field that is empty after normalization as missing', () => {
      const input = minimalInput({ company: { mailingAddress: ' \u200F ' } });
      expect(issuesOf(input, 'field.required').map(issue => issue.path)).toEqual([
        'company.mailingAddress',
      ]);
    });

    it('reports a missing required field of a shareholder at its input path', () => {
      const input = minimalInput({
        shareholders: [
          { idNumber: '123456782', fullName: 'ישראל ישראלי', isControllingShareholder: true },
          { idNumber: '123456782', fullName: '', isControllingShareholder: false },
        ],
      });
      expect(issuesOf(input, 'field.required')).toEqual([
        expect.objectContaining({
          path: 'shareholders[1].fullName',
          recordType: '1020',
          recordIndex: 1,
          field: { position: 148, length: 50, nameHe: 'שם מלא' },
          specRef: { page: 23 },
        }),
      ]);
    });

    it('reports a missing required code (018)', () => {
      const input = minimalInput();
      delete input.amounts['018'];
      const issues = issuesOf(input, 'field.required');
      expect(issues).toEqual([
        expect.objectContaining({
          path: 'amounts["018"]',
          recordType: '1000',
          recordIndex: 0,
          code: '018',
          specRef: { page: 13 },
        }),
      ]);
      expect(issues[0]?.field).toBeUndefined();
    });

    it('counts 0 in a required code that is not zeroAllowed as missing', () => {
      const input = minimalInput({ amounts: { '018': 0 } });
      expect(issuesOf(input, 'field.required').map(issue => issue.code)).toEqual(['018']);
    });

    it('accepts 0 in a required zeroAllowed code', () => {
      const input = minimalInput({ amounts: { '081': 0 } });
      expect(issuesOf(input, 'field.required')).toEqual([]);
    });
  });

  describe('field.numeric', () => {
    it('reports non-digits in a digit-string field', () => {
      const input = minimalInput({ company: { fileNumber: '12a' } });
      expect(issuesOf(input, 'field.numeric')).toEqual([
        expect.objectContaining({
          path: 'company.fileNumber',
          value: '12a',
          field: { position: 137, length: 9, nameHe: 'מספר תיק' },
          specRef: { page: 5 },
        }),
      ]);
    });

    it('checks shareholder IDs and phone numbers too', () => {
      const input = minimalInput({
        company: { phone: { prefix: '03', number: '123-456' } },
        shareholders: [
          { idNumber: '12345678X', fullName: 'ישראל ישראלי', isControllingShareholder: true },
        ],
      });
      expect(issuesOf(input, 'field.numeric').map(issue => issue.path)).toEqual([
        'company.phone.number',
        'shareholders[0].idNumber',
      ]);
    });
  });

  describe('field.length', () => {
    it('reports a text longer than the field width', () => {
      const input = minimalInput({ company: { registeredName: 'א'.repeat(51) } });
      expect(issuesOf(input, 'field.length')).toEqual([
        expect.objectContaining({
          path: 'company.registeredName',
          field: { position: 175, length: 50, nameHe: 'שם רשום' },
        }),
      ]);
    });

    it('measures text after normalization', () => {
      const input = minimalInput({ company: { registeredName: `  ${'א'.repeat(50)}\u200F  ` } });
      expect(issuesOf(input, 'field.length')).toEqual([]);
    });

    it('reports a digit string longer than the field width', () => {
      const input = minimalInput({ company: { fileNumber: '5140000091' } });
      expect(issuesOf(input, 'field.length').map(issue => issue.path)).toEqual([
        'company.fileNumber',
      ]);
    });

    it('reports a code amount with more digits than the width', () => {
      const input = minimalInput({ amounts: { '081': 1_000_000_000_000 } });
      expect(issuesOf(input, 'field.length')).toEqual([
        expect.objectContaining({ path: 'amounts["081"]', code: '081', specRef: { page: 15 } }),
      ]);
      expect(
        issuesOf(minimalInput({ amounts: { '081': 999_999_999_999 } }), 'field.length'),
      ).toEqual([]);
    });
    it('measures a percent literal as written (whole.cc)', () => {
      const shareholder = (dividendRightsPercent: number) =>
        minimalInput({
          shareholders: [
            {
              idNumber: '123456782',
              fullName: 'ישראל ישראלי',
              isControllingShareholder: true,
              dividendRightsPercent,
            },
          ],
        });
      // Width 5: '99.99' and '100' fit, '100.50' does not.
      expect(issuesOf(shareholder(99.99), 'field.length')).toEqual([]);
      expect(issuesOf(shareholder(100), 'field.length')).toEqual([]);
      expect(issuesOf(shareholder(100.5), 'field.length').map(issue => issue.path)).toEqual([
        'shareholders[0].dividendRightsPercent',
      ]);
    });
  });

  describe('field.checkDigit (SPEC §15 A-25, shopcn)', () => {
    it('reports a company file number whose check digit is wrong', () => {
      const input = minimalInput({ company: { fileNumber: '570000001' } });
      expect(issuesOf(input, 'field.checkDigit')).toEqual([
        expect.objectContaining({
          severity: 'error',
          path: 'company.fileNumber',
          recordType: '1000',
          recordIndex: 0,
          value: '570000001',
          field: { position: 137, length: 9, nameHe: 'מספר תיק' },
          specRef: { page: 5 },
        }),
      ]);
    });

    it('checks every id9 and shareholderId field that has a value', () => {
      const input = fullDeclarationsInput({
        company: { withholdingFileNumber: '940000001', vatFileNumber: '123456789' },
        preparer: { licensedDealerNumber: '012345678' },
        declarations: { familyCompany: { representativeFileNumber: '300000001' } },
        amounts: { '165': 1 },
        relatedCompanies: [
          {
            companyName: 'חברה קשורה בע"מ',
            companyFileNumber: '510000001',
            relationType: 'parent',
          },
        ],
        rdInvestments: [
          { companyName: 'חברת מו"פ בע"מ', companyFileNumber: '520000002', investmentAmount: 1 },
        ],
        shareholders: [
          {
            idNumber: '100000000',
            fullName: 'ישראל ישראלי',
            isControllingShareholder: true,
            dividendRightsPercent: 100,
          },
        ],
      });
      expect(issuesOf(input, 'field.checkDigit').map(issue => issue.path)).toEqual([
        'company.withholdingFileNumber',
        'company.vatFileNumber',
        'preparer.licensedDealerNumber',
        'declarations.familyCompany.representativeFileNumber',
        'relatedCompanies[0].companyFileNumber',
        'shareholders[0].idNumber',
        'rdInvestments[0].companyFileNumber',
      ]);
    });

    it('accepts valid identifiers, shorter values left-padded and the special shareholder IDs', () => {
      const input = minimalInput({
        company: { fileNumber: '18', withholdingFileNumber: '940000003' },
        shareholders: [
          {
            idNumber: '999999964',
            fullName: 'ישראל ישראלי',
            isControllingShareholder: true,
            dividendRightsPercent: 50,
          },
          {
            idNumber: '999999998',
            fullName: 'החזקת ציבור',
            isControllingShareholder: false,
            dividendRightsPercent: 50,
          },
        ],
      });
      expect(issuesOf(input, 'field.checkDigit')).toEqual([]);
    });

    it('does not report values that already fail field.numeric or field.length', () => {
      const nonDigits = minimalInput({ company: { fileNumber: '12a' } });
      expect(issuesOf(nonDigits, 'field.checkDigit')).toEqual([]);
      const tooLong = minimalInput({ company: { fileNumber: '5140000091' } });
      expect(issuesOf(tooLong, 'field.checkDigit')).toEqual([]);
    });

    it('does not check digit fields of kind digits (bank account)', () => {
      const input = minimalInput({
        bankAccount: { bank: '12', branch: '345', account: '123456789' },
      });
      expect(issuesOf(input, 'field.checkDigit')).toEqual([]);
    });
  });

  describe('field.charset', () => {
    it.each([
      ['an emoji', 'חברה \u{1F600} בע"מ'],
      ['a carriage return', 'חברה\rבע"מ'],
      ['a NUL', 'חברה\u0000'],
    ])('reports %s in a text field', (_, registeredName) => {
      const input = minimalInput({ company: { registeredName } });
      expect(issuesOf(input, 'field.charset')).toEqual([
        expect.objectContaining({
          path: 'company.registeredName',
          field: { position: 175, length: 50, nameHe: 'שם רשום' },
        }),
      ]);
    });

    it('checks hebrewText fields too', () => {
      const input = minimalInput({
        shareholders: [
          { idNumber: '123456782', fullName: 'ישראל\u0007', isControllingShareholder: true },
        ],
      });
      expect(issuesOf(input, 'field.charset').map(issue => issue.path)).toEqual([
        'shareholders[0].fullName',
      ]);
    });
  });

  describe('shopcn findings of FIX-2 (SPEC §15 A-29, A-31)', () => {
    it('requires a Hebrew first letter in related-company and R&D-investee names', () => {
      // shopcn: "הערך 'Foreign Affiliate Ltd' אינו תקין במילוי 'חברות קשורות: שם חברה'".
      const input = minimalInput({
        amounts: { '165': 1 },
        relatedCompanies: [{ companyName: 'Foreign Affiliate Ltd', relationType: 'parent' }],
        rdInvestments: [{ companyName: 'R&D Start-up Ltd', investmentAmount: 1 }],
      });
      expect(issuesOf(input, 'field.hebrewFirstLetter').map(issue => issue.path)).toEqual([
        'relatedCompanies[0].companyName',
        'rdInvestments[0].companyName',
      ]);
    });

    it('allows only 1 in code 092 of record 3077', () => {
      // shopcn accepted 1 (cg-77) and rejected 2 (capital-gains-max).
      const appendix = (value: number) =>
        minimalInput({
          capitalGains: [
            {
              symbol: 77,
              dates: { code15: '2024-07-01', code20: '2009-02-01' },
              amounts: { '015': 1000, '092': value },
            },
          ],
        });
      expect(issuesOf(appendix(2), 'field.enum')).toEqual([
        expect.objectContaining({
          path: 'capitalGains[0].amounts["092"]',
          code: '092',
          expected: 'one of 1',
        }),
      ]);
      expect(issuesOf(appendix(1), 'field.enum')).toEqual([]);
    });
  });

  describe('field.integer and the rounding option (SPEC §4.4)', () => {
    it('reports a fraction in an amount code by default', () => {
      expect(issuesOf(minimalInput({ amounts: { '081': 1.5 } }), 'field.integer')).toEqual([
        expect.objectContaining({
          severity: 'error',
          path: 'amounts["081"]',
          code: '081',
          value: 1.5,
          specRef: { page: 15 },
        }),
      ]);
    });

    it('reports a fraction in an amount header field', () => {
      const input = withShareholder({ salaryMonths1To9: 100.25 });
      expect(issuesOf(input, 'field.integer')).toEqual([
        expect.objectContaining({
          path: 'shareholders[0].salaryMonths1To9',
          field: expect.objectContaining({ position: 215, length: 12 }),
        }),
      ]);
    });

    it("rounds half away from zero with rounding 'halfUp' and reports nothing", () => {
      const input = withShareholder({ salaryMonths1To9: 100.5, otherPayments: 7.49 });
      input.amounts['081'] = 1.5;
      const { report, issues } = runPipeline(input, { ...OPTIONS, rounding: 'halfUp' });
      expect(issues).toEqual([]);
      const [main, shareholder] = report?.records ?? [];
      expect(main?.codes.get('081')).toBe(2);
      expect(shareholder?.values.salaryMonths1To9).toBe(101);
      expect(shareholder?.values.otherPayments).toBe(7);
    });

    it('rounds negative amounts away from zero (field.negative still applies)', () => {
      const { report, issues } = runPipeline(minimalInput({ amounts: { '081': -2.5 } }), {
        ...OPTIONS,
        rounding: 'halfUp',
      });
      expect(report?.records[0]?.codes.get('081')).toBe(-3);
      expect(issues.map(issue => issue.ruleId)).toEqual(['field.negative']);
    });

    it("omits a non-zeroAllowed code that 'halfUp' rounds to 0", () => {
      const { report, issues } = runPipeline(minimalInput({ amounts: { '010': 0.4 } }), {
        ...OPTIONS,
        rounding: 'halfUp',
      });
      expect(issues).toEqual([]);
      expect(report?.records[0]?.codes.has('010')).toBe(false);
      expect(report?.omittedZeroCodes).toEqual([{ record: '1000', recordIndex: 0, code: '010' }]);
    });

    it("leaves the value unchanged with rounding 'reject'", () => {
      const { report, issues } = runPipeline(minimalInput({ amounts: { '081': 1.5 } }), {
        ...OPTIONS,
        rounding: 'reject',
      });
      expect(report?.records[0]?.codes.get('081')).toBe(1.5);
      expect(issues.map(issue => issue.ruleId)).toEqual(['field.integer']);
    });

    it('does not round enum codes', () => {
      const { issues } = runPipeline(minimalInput({ amounts: { '018': 4.5 } }), {
        ...OPTIONS,
        rounding: 'halfUp',
      });
      expect(issues.map(issue => [issue.ruleId, issue.code])).toEqual([['field.enum', '018']]);
    });
  });

  describe('field.negative', () => {
    it('reports a negative amount code and a negative header number', () => {
      const input = withShareholder({ otherPayments: -5 });
      input.amounts['081'] = -1;
      expect(issuesOf(input, 'field.negative').map(issue => issue.path)).toEqual([
        'amounts["081"]',
        'shareholders[0].otherPayments',
      ]);
    });
  });

  describe('field.enum', () => {
    it('reports a code value outside the values list', () => {
      expect(issuesOf(minimalInput({ amounts: { '014': 3 } }), 'field.enum')).toEqual([
        expect.objectContaining({
          path: 'amounts["014"]',
          code: '014',
          value: 3,
          expected: 'one of 1, 2, 12',
          specRef: { page: 13 },
        }),
      ]);
    });

    it('expands ranges of the values list (018: 2..7)', () => {
      expect(issuesOf(minimalInput({ amounts: { '018': 7 } }), 'field.enum')).toEqual([]);
      expect(issuesOf(minimalInput({ amounts: { '018': 8 } }), 'field.enum')).toHaveLength(1);
    });
  });

  describe('field.date', () => {
    it.each(['2024-02-30', '2023-02-29', '2024-13-01'])('reports %s', saveDate => {
      expect(issuesOf(minimalInput({ meta: { saveDate } }), 'field.date')).toEqual([
        expect.objectContaining({
          path: 'meta.saveDate',
          value: saveDate,
          field: { position: 165, length: 10, nameHe: 'תאריך שמירה' },
        }),
      ]);
    });

    it.each(['30/06/2024', '2024-6-30'])(
      'leaves the non-ISO form %s to the shape stage',
      saveDate => {
        expect(runPipeline(minimalInput({ meta: { saveDate } }), OPTIONS).issues).toEqual([
          expect.objectContaining({
            ruleId: 'input.shape',
            path: 'meta.saveDate',
            value: saveDate,
          }),
        ]);
      },
    );

    it('accepts a leap day', () => {
      expect(issuesOf(minimalInput({ meta: { saveDate: '2024-02-29' } }), 'field.date')).toEqual(
        [],
      );
    });
  });

  describe('field.percentRange and field.decimals on percent literals', () => {
    it.each([0.5, 100.01, 0])('reports %s outside 1–100', dividendRightsPercent => {
      expect(
        issuesOf(withShareholder({ dividendRightsPercent }), 'field.percentRange').map(
          issue => issue.path,
        ),
      ).toEqual(['shareholders[0].dividendRightsPercent']);
    });

    // votingRightsPercent: a lone shareholder's dividend rights must total 100.
    it.each([1, 10.23, 100])('accepts %s', votingRightsPercent => {
      const issues = runPipeline(withShareholder({ votingRightsPercent }), OPTIONS).issues;
      expect(issues).toEqual([]);
    });

    it('reports more than 2 decimals', () => {
      expect(issuesOf(withShareholder({ otherRightsPercent: 10.123 }), 'field.decimals')).toEqual([
        expect.objectContaining({
          path: 'shareholders[0].otherRightsPercent',
          value: 10.123,
          field: expect.objectContaining({ position: 209, length: 5 }),
        }),
      ]);
    });
  });

  describe('field.hebrewFirstLetter', () => {
    it.each(['1abc', 'Smith ישראל', '"ישראל"'])('reports %s', fullName => {
      expect(
        issuesOf(withShareholder({ fullName }), 'field.hebrewFirstLetter').map(issue => issue.path),
      ).toEqual(['shareholders[0].fullName']);
    });

    it('checks the first letter after normalization', () => {
      const input = withShareholder({ fullName: '\u200F  אבג' });
      expect(issuesOf(input, 'field.hebrewFirstLetter')).toEqual([]);
    });

    it('accepts both ends of the range (א, ת)', () => {
      expect(issuesOf(withShareholder({ fullName: 'אבי' }), 'field.hebrewFirstLetter')).toEqual([]);
      expect(issuesOf(withShareholder({ fullName: 'תמר' }), 'field.hebrewFirstLetter')).toEqual([]);
    });

    it('does not apply to text fields', () => {
      const input = minimalInput({ company: { registeredName: 'ACME בע"מ' } });
      expect(issuesOf(input, 'field.hebrewFirstLetter')).toEqual([]);
    });
  });

  describe('field.phonePrefix (warning) and its follow-up field.required', () => {
    it('drops an invalid company phone prefix: warning plus field.required for 1000@493', () => {
      const input = minimalInput({ company: { phone: { prefix: '01' as PhonePrefix } } });
      const { report, issues } = runPipeline(input, OPTIONS);
      expect(report?.records[0]?.values['company.phone.prefix']).toBeUndefined();
      expect(issues).toEqual([
        expect.objectContaining({
          ruleId: 'field.phonePrefix',
          severity: 'warning',
          path: 'company.phone.prefix',
          recordType: '1000',
          recordIndex: 0,
          value: '01',
          field: { position: 493, length: 3, nameHe: 'קידומת טלפון' },
          specRef: { page: 6 },
        }),
        expect.objectContaining({
          ruleId: 'field.required',
          severity: 'error',
          path: 'company.phone.prefix',
        }),
      ]);
    });

    it('drops an invalid fax prefix with only the warning', () => {
      const input = minimalInput({
        company: { fax: { prefix: '051' as PhonePrefix, number: '7654321' } },
      });
      const { report, issues } = runPipeline(input, OPTIONS);
      expect(report?.records[0]?.values['company.fax.prefix']).toBeUndefined();
      expect(issues).toEqual([
        expect.objectContaining({
          ruleId: 'field.phonePrefix',
          severity: 'warning',
          path: 'company.fax.prefix',
          field: expect.objectContaining({ position: 503 }),
        }),
      ]);
    });

    it('accepts every prefix of the allowed list', () => {
      for (const prefix of ['02', '09', '072', '077', '050', '059'] as const) {
        const input = minimalInput({
          company: { phone: { prefix }, fax: { prefix, number: '1234567' } },
        });
        expect(runPipeline(input, OPTIONS).issues).toEqual([]);
      }
    });
  });

  describe('field.phoneNumber', () => {
    it('reports a phone number shorter than 7 digits', () => {
      const input = minimalInput({ company: { phone: { number: '123' } } });
      expect(issuesOf(input, 'field.phoneNumber')).toEqual([
        expect.objectContaining({
          path: 'company.phone.number',
          value: '123',
          field: { position: 496, length: 7, nameHe: 'מספר טלפון' },
        }),
      ]);
    });

    it('checks the fax number too, and leaves non-digits and overlong numbers to other rules', () => {
      const input = minimalInput({
        company: {
          phone: { number: '12345678' },
          fax: { prefix: '02', number: '12a4567' },
        },
      });
      expect(issuesOf(input, 'field.phoneNumber')).toEqual([]);
      expect(issuesOf(input, 'field.length').map(issue => issue.path)).toEqual([
        'company.phone.number',
      ]);
      expect(issuesOf(input, 'field.numeric').map(issue => issue.path)).toEqual([
        'company.fax.number',
      ]);
      const short = minimalInput({ company: { fax: { prefix: '02', number: '123456' } } });
      expect(issuesOf(short, 'field.phoneNumber').map(issue => issue.path)).toEqual([
        'company.fax.number',
      ]);
    });
  });
});

describe('fieldRules on synthetic records', () => {
  const RECORD_3077 = LAYOUT.records['3077'];

  function report3077(
    values: Record<string, string | number>,
    paths: Record<string, string>,
    codes = new Map<string, number>(),
  ): NormalizedReport {
    const record: NormalizedRecord = {
      recordType: '3077',
      index: 0,
      values: {
        transactionSymbol: 77,
        appendixNumber: 1,
        'dates.code15': '2020-01-01',
        'dates.code20': '2024-01-01',
        sequenceNumber: 1,
        ...values,
      },
      codes,
      countries: [],
      paths: {
        'dates.code15': 'capitalGains[0].dates.code15',
        'dates.code20': 'capitalGains[0].dates.code20',
        ...paths,
      },
    };
    return { taxYear: 2024, layout: LAYOUT, records: [record], notices: [], omittedZeroCodes: [] };
  }

  it('requires nothing of an empty repeated slot (D-12)', () => {
    expect(RECORD_3077.fields.find(f => f.key === 'improvements[1].date')?.required).toBe('yes');
    expect(fieldRules(report3077({}, {}))).toEqual([]);
  });

  it('requires a slot field once another key of the slot has a value', () => {
    const issues = fieldRules(
      report3077(
        { 'improvements[1].expense': 100 },
        { 'improvements[1].expense': 'capitalGains[0].improvements[1].expense' },
      ),
    );
    expect(issues).toEqual([
      expect.objectContaining({
        ruleId: 'field.required',
        path: 'capitalGains[0].improvements[1].date',
        recordType: '3077',
        recordIndex: 0,
        field: { position: 305, length: 10, nameHe: 'תאריך של קוד 50 – תאריך השבחה 2' },
        specRef: { page: 56 },
      }),
    ]);
  });

  it('compares the scaled value of ×100 kinds with the width', () => {
    const slot = (expense: number) =>
      report3077(
        { 'improvements[0].expense': expense, 'improvements[0].date': '2021-01-01' },
        { 'improvements[0].expense': 'capitalGains[0].improvements[0].expense' },
      );
    // amountX100, width 12: 9,999,999,999.99 × 100 has 12 digits, 10,000,000,000 × 100 has 13.
    expect(fieldRules(slot(9_999_999_999.99))).toEqual([]);
    expect(fieldRules(slot(10_000_000_000))).toEqual([
      expect.objectContaining({
        ruleId: 'field.length',
        path: 'capitalGains[0].improvements[0].expense',
        field: expect.objectContaining({ position: 247, length: 12 }),
      }),
    ]);
  });

  describe('kinds the skeleton input cannot express', () => {
    const expense = (value: number) =>
      report3077(
        { 'improvements[0].expense': value, 'improvements[0].date': '2021-01-01' },
        { 'improvements[0].expense': 'capitalGains[0].improvements[0].expense' },
      );

    it('field.decimals: amountX100 header value with more than 2 decimals', () => {
      expect(fieldRules(expense(100.12))).toEqual([]);
      expect(fieldRules(expense(100.123))).toEqual([
        expect.objectContaining({
          ruleId: 'field.decimals',
          path: 'capitalGains[0].improvements[0].expense',
          value: 100.123,
          field: expect.objectContaining({ position: 247, length: 12 }),
        }),
      ]);
    });

    it('field.decimals: no false positive for large amounts with agorot', () => {
      for (const value of [9_481_199_461.12, 1_233_840_766.34, 5_457_046_861.81, 0.07]) {
        expect(fieldRules(expense(value))).toEqual([]);
      }
      expect(fieldRules(expense(9_481_199_461.001)).map(issue => issue.ruleId)).toEqual([
        'field.decimals',
      ]);
    });

    /** Paths of the given codes of the synthetic 3077 record. */
    const codePaths = (...codes: string[]) =>
      Object.fromEntries(codes.map(code => [`code:${code}`, `capitalGains[0].amounts["${code}"]`]));

    it('field.decimals reports an issue exactly when the amountX100 encoder throws', () => {
      // Seeded linear congruential generator, so the sample is the same on every run.
      let seed = 1214;
      const next = () => {
        seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
        return seed / 2_147_483_648;
      };
      const sample: number[] = [
        9_481_199_461.12,
        1_233_840_766.34,
        5_457_046_861.81,
        9_637_299_614.7,
        9_481_199_461.001,
        9_999_999_999.99,
        1.005,
        1.234,
        0.07,
        0.1 + 0.2,
        10.123,
      ];
      for (let i = 0; i < 500; i++) {
        const cents = Math.floor(next() * 1e12);
        sample.push(cents / 100, Math.floor(next() * 1e12) / 1000, Math.floor(next() * 1e6) / 1000);
      }
      const shape = { length: 12, type: 'numeric', kind: 'amountX100' } as const;
      for (const value of sample) {
        let throws = false;
        try {
          codecFor('amountX100').encode(value, shape);
        } catch (error) {
          expect(error).toBeInstanceOf(Opcn1214InternalError);
          throws = true;
        }
        const decimals = fieldRules(expense(value)).some(
          issue => issue.ruleId === 'field.decimals',
        );
        expect({ value, decimals }).toEqual({ value, decimals: throws });
      }
    });

    it('field.decimals and field.negative: amountX100 code values', () => {
      // Field rules only: the synthetic report also lacks the shareholders (struct.shareholders.min).
      const issues = runRules(
        report3077(
          {},
          codePaths('020', '040', '027'),
          new Map([
            ['020', 10.5],
            ['040', 10.555],
            ['027', -1],
          ]),
        ),
      ).filter(issue => issue.ruleId.startsWith('field.'));
      expect(issues.map(issue => [issue.ruleId, issue.path])).toEqual([
        ['field.negative', 'capitalGains[0].amounts["027"]'],
        ['field.decimals', 'capitalGains[0].amounts["040"]'],
      ]);
    });

    it('field.enum: rateX100 code 018 accepts 23 and 50 only', () => {
      const rate = (value: number) =>
        fieldRules(report3077({}, codePaths('018'), new Map([['018', value]])));
      expect(rate(23)).toEqual([]);
      expect(rate(50)).toEqual([]);
      expect(rate(30)).toEqual([
        expect.objectContaining({ ruleId: 'field.enum', code: '018', expected: 'one of 23, 50' }),
      ]);
    });

    it('field.enum: header enum field', () => {
      const location = (assetLocation: number) =>
        fieldRules(
          report3077({ assetLocation }, { assetLocation: 'capitalGains[0].assetLocation' }),
        );
      expect(location(2)).toEqual([]);
      expect(location(3)).toEqual([
        expect.objectContaining({
          ruleId: 'field.enum',
          field: expect.objectContaining({ position: 193 }),
          expected: 'one of 1, 2',
        }),
      ]);
    });

    it('field.enum does not apply to yesNo values (documentation only, D-14)', () => {
      const report = normalizeReport(minimalInput(), LAYOUT, OPTIONS);
      const main = report.records[0];
      if (!main) {
        throw new Error('expected record 1000');
      }
      main.values['declarations.hasTaxPlanningAction'] = true;
      expect(fieldRules(report)).toEqual([]);
    });

    it('field.integer: num code with a fraction', () => {
      // 1000 code 141 is a num code; 3077 code 092 became an enum in FIX-2 (SPEC §15 A-31).
      const report = normalizeReport(minimalInput(), LAYOUT, OPTIONS);
      const main = report.records[0];
      if (!main) {
        throw new Error('expected record 1000');
      }
      main.codes.set('141', 1.5);
      main.paths[codeKey('141')] = 'amounts["141"]';
      expect(fieldRules(report).map(issue => [issue.ruleId, issue.code])).toEqual([
        ['field.integer', '141'],
      ]);
    });

    it('field.date: header date in a 30xx record', () => {
      expect(
        fieldRules(report3077({ 'dates.code20': '2024-04-31' }, {})).map(issue => [
          issue.ruleId,
          issue.field?.position,
        ]),
      ).toEqual([['field.date', 235]]);
    });

    describe('percentX100 (1000@949)', () => {
      function withRate(ratePercent: number): NormalizedReport {
        const report = normalizeReport(minimalInput(), LAYOUT, OPTIONS);
        const main = report.records[0];
        if (!main) {
          throw new Error('expected record 1000');
        }
        main.values['otherTaxableIncome.ratePercent'] = ratePercent;
        return report;
      }

      it.each([1, 10.23, 100])('accepts %s', ratePercent => {
        expect(fieldRules(withRate(ratePercent))).toEqual([]);
      });

      it.each([
        [10.234, 'field.decimals'],
        [0.99, 'field.percentRange'],
        [100.01, 'field.percentRange'],
      ])('reports %s as %s', (ratePercent, ruleId) => {
        expect(fieldRules(withRate(ratePercent))).toEqual([
          expect.objectContaining({
            ruleId,
            path: 'otherTaxableIncome.ratePercent',
            field: expect.objectContaining({ position: 949, length: 5 }),
          }),
        ]);
      });
    });
  });

  it('is sorted by the engine', () => {
    // The synthetic report has no shareholders, which struct.shareholders.min reports too.
    const issues = runRules(
      report3077(
        { 'improvements[1].expense': 100, assetDetails: 'נכס\r' },
        {
          'improvements[1].expense': 'capitalGains[0].improvements[1].expense',
          assetDetails: 'capitalGains[0].assetDetails',
        },
      ),
    ).filter(issue => issue.ruleId.startsWith('field.'));
    expect(issues.map(issue => [issue.ruleId, issue.field?.position])).toEqual([
      ['field.charset', 143],
      ['field.required', 305],
    ]);
  });
});
