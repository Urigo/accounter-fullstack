import { getLayout } from '../../src/layout/registry.js';
import type { NormalizedRecord, NormalizedReport } from '../../src/model/normalized.js';
import { runPipeline } from '../../src/pipeline.js';
import { runRules } from '../../src/validate/engine.js';
import { fieldRules } from '../../src/validate/field-rules.js';
import type { Issue } from '../../src/validate/issue.js';
import type { RuleId } from '../../src/validate/rules.js';
import { minimalInput } from '../fixtures/builders.js';

const LAYOUT = getLayout(2024);
const OPTIONS = { today: () => '2024-06-30' };

function issuesOf(input: unknown, ruleId: RuleId): Issue[] {
  return runPipeline(input, OPTIONS).issues.filter(issue => issue.ruleId === ruleId);
}

describe('field rules through runPipeline (SPEC §9.3, §10.2)', () => {
  it('reports nothing for the minimal input', () => {
    expect(runPipeline(minimalInput(), OPTIONS).issues).toEqual([]);
  });

  describe('field.required', () => {
    it('reports a missing required header field with its layout position', () => {
      const input = minimalInput({ company: { registeredName: undefined } });
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

  describe('field.charset', () => {
    it.each([
      ['an emoji', 'חברה \u{1F600} בע"מ', 'U+1F600 at character 6'],
      ['a carriage return', 'חברה\rבע"מ', 'U+000D at character 5'],
      ['a NUL', 'חברה\u0000', 'U+0000 at character 5'],
    ])('reports %s in a text field, with its position', (_, registeredName, located) => {
      const input = minimalInput({ company: { registeredName } });
      expect(issuesOf(input, 'field.charset')).toEqual([
        expect.objectContaining({
          path: 'company.registeredName',
          field: { position: 175, length: 50, nameHe: 'שם רשום' },
          message: expect.stringContaining(`contains ${located},`),
        }),
      ]);
    });

    it('reports the first offending character only', () => {
      const input = minimalInput({ company: { registeredName: 'א\u0001ב\u0002' } });
      expect(issuesOf(input, 'field.charset').map(issue => issue.message)).toEqual([
        expect.stringContaining('U+0001 at character 2,'),
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
});

describe('fieldRules on synthetic records', () => {
  const RECORD_3077 = LAYOUT.records['3077'];

  function report3077(
    values: Record<string, string | number>,
    paths: Record<string, string>,
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
      codes: new Map(),
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

  it('is sorted by the engine', () => {
    const issues = runRules(
      report3077(
        { 'improvements[1].expense': 100, assetDetails: 'נכס\r' },
        {
          'improvements[1].expense': 'capitalGains[0].improvements[1].expense',
          assetDetails: 'capitalGains[0].assetDetails',
        },
      ),
    );
    expect(issues.map(issue => [issue.ruleId, issue.field?.position])).toEqual([
      ['field.charset', 143],
      ['field.required', 305],
    ]);
  });
});
