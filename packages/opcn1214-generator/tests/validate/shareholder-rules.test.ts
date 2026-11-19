import { generate1214 } from '../../src/api/generate.js';
import { parse1214 } from '../../src/api/parse.js';
import type { Shareholder } from '../../src/model/input.js';
import { runPipeline } from '../../src/pipeline.js';
import type { Issue } from '../../src/validate/issue.js';
import type { RuleId } from '../../src/validate/rules.js';
import { minimalInput, withCheckDigit } from '../fixtures/builders.js';
import { tamper } from '../fixtures/files.js';

const OPTIONS = { today: () => '2024-06-30' };

function holder(idNumber: string, dividendRightsPercent?: number): Shareholder {
  return {
    idNumber,
    fullName: 'ישראל ישראלי',
    isControllingShareholder: false,
    dividendRightsPercent,
  };
}

/** Distinct, valid shareholder IDs. */
function id(index: number): string {
  return withCheckDigit(10_000_000 + index);
}

function issuesOf(shareholders: Shareholder[], ruleId: RuleId, kibbutz = false): Issue[] {
  const input = minimalInput({
    shareholders,
    ...(kibbutz ? { declarations: { isKibbutz: true }, amounts: { '226': 1 } } : {}),
  });
  return runPipeline(input, OPTIONS).issues.filter(issue => issue.ruleId === ruleId);
}

describe('shareholder rules (SPEC §10.4)', () => {
  describe('shareholders.dividendRights.total', () => {
    it.each([
      ['100', [100]],
      ['33.33 + 33.33 + 33.34', [33.33, 33.33, 33.34]],
      ['0.1 + 0.2 + 99.7 (hundredths, not floats)', [0.1, 0.2, 99.7]],
      ['50 + 50 and one without', [50, 50, undefined]],
      ['nobody states it', [undefined, undefined]],
    ])('%s passes', (_, percents) => {
      const shareholders = percents.map((percent, index) => holder(id(index), percent));
      expect(issuesOf(shareholders, 'shareholders.dividendRights.total')).toEqual([]);
    });

    it.each([
      ['50 + 49.99', [50, 49.99], 99.99],
      ['60 + 50', [60, 50], 110],
      ['50 and one without', [50, undefined], 50],
    ])('%s fails once, at shareholders', (_, percents, total) => {
      const shareholders = percents.map((percent, index) => holder(id(index), percent));
      expect(issuesOf(shareholders, 'shareholders.dividendRights.total')).toEqual([
        expect.objectContaining({
          severity: 'error',
          path: 'shareholders',
          recordType: '1020',
          value: total,
          expected: '100',
          specRef: { page: 23 },
        }),
      ]);
    });

    it('is reported on a parsed file', () => {
      const text = generate1214(minimalInput(), OPTIONS).text;
      expect(text.split('\r\n')[1]?.slice(198, 203)).toBe('00100');
      // 1020@199 (line 2): dividend rights 100 → 99.
      const tampered = tamper(text, { line: 2, position: 199, value: '00099' });
      expect(
        parse1214(tampered).issues.filter(
          issue => issue.ruleId === 'shareholders.dividendRights.total',
        ),
      ).toHaveLength(1);
    });
  });

  describe('shareholders.duplicateId', () => {
    it('reports every repeat after the first occurrence, at its idNumber', () => {
      const shareholders = [
        holder('123456782', 25),
        holder('234567899', 25),
        holder('123456782', 25),
        holder('123456782', 25),
      ];
      expect(issuesOf(shareholders, 'shareholders.duplicateId')).toEqual([
        expect.objectContaining({
          severity: 'warning',
          path: 'shareholders[2].idNumber',
          recordType: '1020',
          recordIndex: 2,
          value: '123456782',
          field: expect.objectContaining({ position: 139, length: 9 }),
        }),
        expect.objectContaining({ path: 'shareholders[3].idNumber', recordIndex: 3 }),
      ]);
    });

    it.each(['999999964', '999999998'])('ignores the special ID %s', special => {
      const shareholders = [holder(special, 50), holder(special, 50)];
      expect(issuesOf(shareholders, 'shareholders.duplicateId')).toEqual([]);
    });
  });
});

describe('shareholder counts (SPEC §10.1)', () => {
  it('struct.shareholders.min: none for a company that is not a kibbutz', () => {
    expect(issuesOf([], 'struct.shareholders.min')).toEqual([
      expect.objectContaining({ severity: 'error', path: 'shareholders', value: 0 }),
    ]);
    expect(issuesOf([], 'struct.shareholders.min', true)).toEqual([]);
  });

  it('struct.shareholders.min: a kibbutz file without 1020 records parses', () => {
    const input = minimalInput({
      declarations: { isKibbutz: true },
      amounts: { '226': 1 },
      shareholders: [],
    });
    const { text } = generate1214(input, OPTIONS);
    expect(parse1214(text).issues).toEqual([]);
  });

  it.each([
    [99, 0],
    [100, 1],
    [120, 1],
  ])('struct.shareholders.max: %i shareholders → %i issue(s)', (count, expected) => {
    const shareholders = Array.from({ length: count }, (_, index) => holder(id(index)));
    const issues = issuesOf(shareholders, 'struct.shareholders.max');
    expect(issues).toHaveLength(expected);
    if (expected > 0) {
      expect(issues[0]).toEqual(
        expect.objectContaining({
          severity: 'error',
          path: 'shareholders',
          value: count,
          expected: 'at most 99',
        }),
      );
    }
  });
});
