/**
 * What each golden fixture claims to cover (SPEC §13.5), checked on its input and generated file.
 */
import { generate1214, parse1214, validate1214 } from '../../src/index.js';
import { getLayout } from '../../src/layout/registry.js';
import { normalizeReport } from '../../src/normalize/report.js';
import * as kibbutz from '../fixtures/golden/kibbutz.input.js';
import * as mainFull from '../fixtures/golden/main-full.input.js';
import { unmappedHeaderKeys } from '../helpers/coverage.js';

const LAYOUT = getLayout(2024);

function linesOf(text: string): string[] {
  return text.split('\r\n').filter(line => line !== '');
}

describe('golden main-full', () => {
  const { input, options } = mainFull;

  it('is valid against every rule: no errors and no warnings', () => {
    expect(validate1214(input, options)).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it('sets every non-filler header field of record 1000', () => {
    const report = normalizeReport(input, LAYOUT, options);
    expect(unmappedHeaderKeys(LAYOUT.records['1000'], report.records)).toEqual([]);
  });

  it('holds exactly 61 code-amount pairs after derivations, without code 165', () => {
    const report = normalizeReport(input, LAYOUT, options);
    const codes = report.records[0]?.codes;
    expect(codes?.size).toBe(LAYOUT.limits.mainCodePairs);
    expect(codes?.has('165')).toBe(false);
    expect([...(codes?.keys() ?? [])]).toEqual(
      expect.arrayContaining(['008', '028', '273', '277', '278', '280', '297']),
    );
  });

  it('has a bank account and 99 shareholders whose dividend rights total 100', () => {
    expect(input.bankAccount).toBeDefined();
    expect(input.declarations.isKibbutz).not.toBe(true);
    expect(input.declarations.hasCapitalGainsAppendix).toBeUndefined();
    expect(input.shareholders).toHaveLength(99);
    const hundredths = input.shareholders.reduce(
      (sum, shareholder) => sum + Math.round((shareholder.dividendRightsPercent ?? 0) * 100),
      0,
    );
    expect(hundredths).toBe(10_000);
  });

  it('writes 1000 + 99 × 1020 + 9999, counting 99 shareholders (9999@141)', () => {
    const lines = linesOf(generate1214(input, options).text);
    expect(lines).toHaveLength(101);
    expect(lines.slice(1, 100).every(line => line.slice(4, 8) === '1020')).toBe(true);
    expect(lines[100]?.slice(140, 142)).toBe('99');
  });
});

describe('golden kibbutz', () => {
  const { input, options } = kibbutz;

  it('is a kibbutz with code 226 and no shareholders, valid without warnings', () => {
    expect(input.declarations.isKibbutz).toBe(true);
    expect(input.amounts['226']).toBe(1);
    expect(input.shareholders).toEqual([]);
    expect(validate1214(input, options)).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it('writes 1000 + 9999 only, counting 00 shareholders (9999@141), and parses back', () => {
    const { text } = generate1214(input, options);
    const lines = linesOf(text);
    expect(lines.map(line => line.slice(4, 8))).toEqual(['1000', '9999']);
    expect(lines[1]?.slice(140, 142)).toBe('00');
    // 1000@877: the kibbutz flag.
    expect(lines[0]?.slice(876, 877)).toBe('1');
    const parsed = parse1214(text);
    expect(parsed.issues).toEqual([]);
    expect(parsed.report.shareholders).toEqual([]);
  });
});
