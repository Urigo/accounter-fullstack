/**
 * The shopcn probes of 2026-11-24 (SPEC §15 A-24, A-36, A-37): each is a verified golden with only
 * the stated bytes changed, and shopcn accepted every one. The parser must accept them too, and
 * the matching input must validate and generate.
 */
import { generate1214 } from '../../src/api/generate.js';
import { parse1214 } from '../../src/api/parse.js';
import { validate1214 } from '../../src/api/validate.js';
import type { CapitalGainsAppendix, Withholder } from '../../src/model/input.js';
import {
  minimalInput,
  noWithholding1322Appendix,
  reitAppendix,
  securitiesAppendix,
  withholders,
} from '../fixtures/builders.js';
import { dropLine, goldenText, tamper } from '../fixtures/files.js';

const OPTIONS = { today: () => '2025-03-31' };
const CRLF = '\r\n';

function lineOf(text: string, line: number): string {
  const target = text.split(CRLF)[line - 1];
  if (target === undefined) {
    throw new Error(`no line ${line}`);
  }
  return target;
}

describe('shopcn probes of 2026-11-24', () => {
  describe('percentages below 1% (A-36)', () => {
    const golden = goldenText('main-full');

    it('main-full has voting rights 00050 at 1020@204 (line 2)', () => {
      expect(lineOf(golden, 2).slice(203, 208)).toBe('00050');
    });

    it.each([
      ['00.50', 0.5],
      ['01.50', 1.5],
    ])('accepts %s', (written, percent) => {
      const { report, issues } = parse1214(
        tamper(golden, { line: 2, position: 204, value: written }),
      );
      expect(issues).toEqual([]);
      expect(report.shareholders[0]?.votingRightsPercent).toBe(percent);
    });
  });

  describe('code 442 = 0 (A-24)', () => {
    const golden = goldenText('foreign');
    // 2000@1161 is the code-amount section (15 characters per pair); 442 is written with 32,100.
    const section = lineOf(golden, 3).slice(1160);
    const pair = section.indexOf('442000000032100');
    const p1 = tamper(golden, { line: 3, position: 1161 + pair + 3, value: '0'.repeat(12) });

    it('foreign has 442 in the 2000 section and its 2200 record on line 19, 23 of them in 9999', () => {
      expect(pair % 15).toBe(0);
      expect(lineOf(golden, 19).slice(4, 8)).toBe('2200');
      expect(lineOf(golden, 19).slice(136, 139)).toBe('442');
      expect(lineOf(golden, 27).slice(146, 148)).toBe('23');
    });

    it('P1: accepts 442 = 0 that keeps its 2200 record', () => {
      const { report, issues } = parse1214(p1);
      expect(issues).toEqual([]);
      expect(report.foreignAppendix?.amounts['442']).toBe(0);
      expect(report.foreignAppendix?.countryBreakdown?.['442']).toBeDefined();
    });

    it('P2: accepts 442 = 0 without a 2200 record (9999@147 lowered to 22)', () => {
      // After dropping line 19 the 9999 record is line 26.
      const p2 = tamper(dropLine(p1, 19), { line: 26, position: 147, value: '22' });
      const { report, issues } = parse1214(p2);
      expect(issues).toEqual([]);
      expect(report.foreignAppendix?.amounts['442']).toBe(0);
      expect(report.foreignAppendix?.countryBreakdown?.['442']).toBeUndefined();
    });
  });

  describe('withholder blocks (A-37)', () => {
    const golden = goldenText('cg-60');
    // An empty block as the generator writes it: the name blank, branch and account zeros.
    const emptyBlock = ' '.repeat(30) + '0'.repeat(12);

    it('cg-60 has four withholders in record 3060 (line 3)', () => {
      const line = lineOf(golden, 3);
      expect(line.slice(4, 8)).toBe('3060');
      expect(line.slice(187, 229)).not.toBe(emptyBlock);
    });

    it('W1: accepts block B (3060@188–229) empty while A, C and D are filled', () => {
      const { report, issues } = parse1214(
        tamper(golden, { line: 3, position: 188, value: emptyBlock }),
      );
      expect(issues).toEqual([]);
      const appendix = report.capitalGains?.[0];
      const parsed = appendix && 'withholders' in appendix ? appendix.withholders : undefined;
      expect(parsed?.map(withholder => Object.keys(withholder))).toEqual([
        ['name', 'branch', 'account'],
        [],
        ['name', 'branch', 'account'],
        ['name', 'branch', 'account'],
      ]);
    });

    it('W2: accepts block A with a name only, branch and account zeroed', () => {
      const { report, issues } = parse1214(
        tamper(golden, { line: 3, position: 176, value: '0'.repeat(12) }),
      );
      expect(issues).toEqual([]);
      const appendix = report.capitalGains?.[0];
      const parsed = appendix && 'withholders' in appendix ? appendix.withholders : undefined;
      expect(parsed?.[0]).toEqual({ name: 'בנק הפועלים בע"מ' });
    });

    const [a, b, c, d] = withholders(4) as [Withholder, Withholder, Withholder, Withholder];
    const nameOnly: Withholder = { name: a.name };
    describe.each([
      [
        '3060',
        (list: Withholder[]): CapitalGainsAppendix => ({
          ...securitiesAppendix(),
          withholders: list,
        }),
      ],
      [
        '3064',
        (list: Withholder[]): CapitalGainsAppendix => ({
          ...reitAppendix(),
          withholders: list,
        }),
      ],
      [
        '3065',
        (list: Withholder[]): CapitalGainsAppendix => ({
          ...noWithholding1322Appendix(),
          withholders: list,
        }),
      ],
    ])('record %s', (_type, appendixWith) => {
      it.each([
        ['a gap between blocks (A, -, C, D)', [a, {}, c, d]],
        ['a block with a name only', [nameOnly, b]],
        ['a name-only block after a gap', [a, {}, nameOnly]],
      ])('validates, generates and round-trips %s', (_, list) => {
        const input = minimalInput({ capitalGains: [appendixWith(list)] });
        expect(validate1214(input, OPTIONS)).toEqual({ valid: true, errors: [], warnings: [] });
        const { text } = generate1214(input, OPTIONS);
        const { report, issues } = parse1214(text);
        expect(issues).toEqual([]);
        const parsed = report.capitalGains?.[0];
        expect(parsed && 'withholders' in parsed ? parsed.withholders : undefined).toEqual(list);
      });
    });
  });
});
