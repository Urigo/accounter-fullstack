/**
 * Negative and edge cases (SPEC §13.7): one test per item of the list, each asserting the precise
 * outcome the specification gives it (rule ID and path, parse error line and column, or bytes).
 */
import {
  generate1214,
  getLayout,
  Opcn1214ParseError,
  parse1214,
  validate1214,
  type Issue,
  type RecordType,
  type Report1214Input,
} from '../src/index.js';
import {
  foreignAppendixWithBreakdown,
  minimalInput,
  sharesAppendix,
  type DeepPartial,
} from './fixtures/builders.js';
import { swapLines, tamper } from './fixtures/files.js';

const OPTIONS = { today: () => '2025-03-31' };
const CRLF = '\r\n';

/** The rule ID, severity and path of every issue validate1214 reports for `input`. */
function issuesOf(input: unknown): Array<Pick<Issue, 'ruleId' | 'severity' | 'path'>> {
  const { errors, warnings } = validate1214(input, OPTIONS);
  return [...errors, ...warnings].map(({ ruleId, severity, path }) => ({ ruleId, severity, path }));
}

/** The issues of the Opcn1214ParseError `run` throws; fails when it throws nothing or another error. */
function parseErrorIssues(run: () => unknown): readonly Issue[] {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(Opcn1214ParseError);
    return (error as Opcn1214ParseError).issues;
  }
  throw new Error('Expected an Opcn1214ParseError');
}

function withShareholder(shareholder: DeepPartial<Report1214Input['shareholders'][number]>) {
  return minimalInput({
    shareholders: [
      {
        idNumber: '123456782',
        fullName: 'ישראל ישראלי',
        isControllingShareholder: true,
        dividendRightsPercent: 100,
        ...shareholder,
      },
    ],
  });
}

/** The `code → raw value` entries of the code-amount section of line `lineIndex` (0-based). */
function sectionEntries(text: string, lineIndex = 0): Map<string, string> {
  const line = text.split(CRLF)[lineIndex] ?? '';
  const def = getLayout(2024).records[line.slice(4, 8) as RecordType];
  const widths = new Map(def.codes.map(code => [code.code, code.length]));
  const entries = new Map<string, string>();
  let at = (def.section?.start ?? 0) - 1;
  while (at < line.length && !/^0*$/.test(line.slice(at))) {
    const code = line.slice(at, at + 3);
    const width = widths.get(code);
    if (width === undefined) {
      throw new Error(`Unknown code ${code} at ${def.type}@${at + 1}`);
    }
    entries.set(code, line.slice(at + 3, at + 3 + width));
    at += 3 + width;
  }
  return entries;
}

const error = (ruleId: string, path: string) => ({ ruleId, severity: 'error', path });

describe('SPEC §13.7 negative and edge cases', () => {
  it('text one character over the width is field.length', () => {
    const atWidth = minimalInput({ company: { registeredName: 'א'.repeat(50) } });
    const overWidth = minimalInput({ company: { registeredName: 'א'.repeat(51) } });
    expect(issuesOf(atWidth)).toEqual([]);
    expect(issuesOf(overWidth)).toEqual([error('field.length', 'company.registeredName')]);
  });

  it('a Hebrew name starting with a digit is field.hebrewFirstLetter', () => {
    expect(issuesOf(withShareholder({ fullName: '1 ישראל' }))).toEqual([
      error('field.hebrewFirstLetter', 'shareholders[0].fullName'),
    ]);
  });

  it('a Hebrew name starting with a quote is field.hebrewFirstLetter', () => {
    expect(issuesOf(withShareholder({ fullName: '"ישראל"' }))).toEqual([
      error('field.hebrewFirstLetter', 'shareholders[0].fullName'),
    ]);
    // A typographic quote is normalized to '"' first (SPEC §4.3) and fails the same way.
    expect(issuesOf(withShareholder({ fullName: '“ישראל”' }))).toEqual([
      error('field.hebrewFirstLetter', 'shareholders[0].fullName'),
    ]);
  });

  it('an emoji is field.charset', () => {
    const { errors } = validate1214(
      minimalInput({ company: { registeredName: 'חברה \u{1F600} בע"מ' } }),
      OPTIONS,
    );
    expect(errors).toEqual([
      expect.objectContaining({ ruleId: 'field.charset', path: 'company.registeredName' }),
    ]);
    expect(errors[0]?.message).toContain('U+1F600');
  });

  it('CR/LF inside text is field.charset', () => {
    const { errors } = validate1214(
      minimalInput({ company: { registeredName: 'חברה\r\nבע"מ' } }),
      OPTIONS,
    );
    expect(errors).toEqual([
      expect.objectContaining({ ruleId: 'field.charset', path: 'company.registeredName' }),
    ]);
    expect(errors[0]?.message).toContain('U+000D');
  });

  it('amount 1e21 is field.length', () => {
    const { errors } = validate1214(minimalInput({ amounts: { '081': 1e21 } }), OPTIONS);
    expect(errors).toEqual([
      expect.objectContaining({
        ruleId: 'field.length',
        path: 'amounts["081"]',
        code: '081',
        value: 1e21,
        expected: 'at most 12 digits',
      }),
    ]);
  });

  it('-0 is accepted and written exactly like 0', () => {
    const negativeZero = minimalInput({ amounts: { '081': -0 } });
    expect(issuesOf(negativeZero)).toEqual([]);
    expect(generate1214(negativeZero, OPTIONS).bytes).toEqual(
      generate1214(minimalInput({ amounts: { '081': 0 } }), OPTIONS).bytes,
    );
  });

  it('NaN is rejected by the shape stage (input.shape)', () => {
    expect(issuesOf(minimalInput({ amounts: { '081': Number.NaN } }))).toEqual([
      error('input.shape', 'amounts["081"]'),
    ]);
  });

  it('0.1 + 0.2 as a ×100 amount passes as 0.3 and is written as 30', () => {
    const input = minimalInput({
      capitalGains: [sharesAppendix({ amounts: { '020': 0.1 + 0.2 } })],
    });
    expect(issuesOf(input)).toEqual([]);
    const { text } = generate1214(input, OPTIONS);
    expect(text.split(CRLF)[2]?.slice(4, 8)).toBe('3027');
    expect(sectionEntries(text, 2).get('020')).toBe('000000000030');
    expect(parse1214(generate1214(input, OPTIONS).bytes).report.capitalGains?.[0]?.amounts).toEqual(
      expect.objectContaining({ '020': 0.3 }),
    );
  });

  it('percent 100.001 is field.decimals, not field.percentRange (100.00 as written)', () => {
    expect(issuesOf(withShareholder({ votingRightsPercent: 100.001 }))).toEqual([
      error('field.decimals', 'shareholders[0].votingRightsPercent'),
    ]);
  });

  it('date 2024-02-30 is field.date', () => {
    expect(
      issuesOf(
        minimalInput({ declarations: { beneficiaryEnterprise: { noticeDate: '2024-02-30' } } }),
      ),
    ).toEqual([error('field.date', 'declarations.beneficiaryEnterprise.noticeDate')]);
  });

  it('taxYear 2023 is struct.taxYear.unsupported, alone', () => {
    const input = { ...minimalInput(), taxYear: 2023 };
    expect(issuesOf(input)).toEqual([error('struct.taxYear.unsupported', 'taxYear')]);
  });

  it('62 code pairs in record 1000 is struct.mainCodePairs.max (61 is fine)', () => {
    const main = getLayout(2024).records['1000'];
    // Optional input codes whose presence calls for nothing else (no investment-law flag, no R&D).
    const free = main.codes.filter(
      code =>
        !code.derived && code.required !== 'yes' && !['101', '102', '165'].includes(code.code),
    );
    const withPairs = (pairs: number): Report1214Input => {
      // minimalInput writes 5 required codes and the derived 273.
      const extra = free.slice(0, pairs - 6);
      return minimalInput({
        amounts: Object.fromEntries(
          extra.map(code => [code.code, code.values?.[0]?.value ?? 1]),
        ) as Report1214Input['amounts'],
      });
    };
    expect(free.length).toBeGreaterThanOrEqual(56);
    expect(issuesOf(withPairs(61))).toEqual([]);
    expect(generate1214(withPairs(61), OPTIONS).summary.mainCodePairs).toBe(61);
    const { errors } = validate1214(withPairs(62), OPTIONS);
    expect(errors).toEqual([
      expect.objectContaining({
        ruleId: 'struct.mainCodePairs.max',
        path: 'amounts',
        value: 62,
        expected: 'at most 61',
      }),
    ]);
  });

  it('a zero for a non-zeroAllowed code is omitted and reported in omittedZeroCodes', () => {
    const input = minimalInput({ amounts: { '010': 0 } });
    expect(issuesOf(input)).toEqual([]);
    const { text, summary } = generate1214(input, OPTIONS);
    expect(summary.omittedZeroCodes).toEqual([{ record: '1000', recordIndex: 0, code: '010' }]);
    expect(summary.mainCodePairs).toBe(6);
    expect([...sectionEntries(text).keys()]).toEqual(['018', '072', '081', '094', '263', '273']);
  });

  it('a zero for 080 in a family company is written', () => {
    const input = minimalInput({
      declarations: { familyCompany: { representativeFileNumber: '300000007' } },
      amounts: { '080': 0 },
    });
    expect(issuesOf(input)).toEqual([]);
    const { text, summary } = generate1214(input, OPTIONS);
    expect(summary.omittedZeroCodes).toEqual([]);
    const entries = sectionEntries(text);
    expect([...entries.keys()]).toEqual(['018', '072', '080', '081', '094', '263', '273']);
    expect(entries.get('080')).toBe('000000000000');
    expect(text).toContain('080000000000000');
  });

  it('an unknown country is foreign.breakdown.country.unknown', () => {
    const input = minimalInput({
      foreignAppendix: foreignAppendixWithBreakdown('420', {
        countries: [{ country: '001' as never, income: 5 }],
      }),
    });
    expect(issuesOf(input)).toEqual([
      error(
        'foreign.breakdown.country.unknown',
        'foreignAppendix.countryBreakdown["420"].countries[0].country',
      ),
    ]);
  });

  it('-88 on code 420 is foreign.breakdown.country.unknownOnlyFor439', () => {
    const input = minimalInput({
      foreignAppendix: foreignAppendixWithBreakdown('420', {
        countries: [{ country: '-88', income: 5 }],
      }),
    });
    expect(issuesOf(input)).toEqual([
      error(
        'foreign.breakdown.country.unknownOnlyFor439',
        'foreignAppendix.countryBreakdown["420"].countries[0].country',
      ),
    ]);
  });

  it('a file with LF endings parses like the CRLF file', () => {
    const { text, bytes } = generate1214(minimalInput(), OPTIONS);
    const lf = text.replaceAll(CRLF, '\n');
    expect(lf).not.toContain('\r');
    const parsed = parse1214(lf);
    expect(parsed.issues).toEqual([]);
    expect(parsed).toEqual(parse1214(bytes));
  });

  it('a file with one byte missing on line 3 is parse.lineLength at line 3', () => {
    const { text, bytes } = generate1214(
      minimalInput({
        shareholders: [
          {
            idNumber: '123456782',
            fullName: 'א',
            isControllingShareholder: true,
            dividendRightsPercent: 50,
          },
          {
            idNumber: '18',
            fullName: 'ב',
            isControllingShareholder: false,
            dividendRightsPercent: 50,
          },
        ],
      }),
      OPTIONS,
    );
    const [first = '', second = '', third = ''] = text.split(CRLF);
    expect(third.slice(4, 8)).toBe('1020');
    // Single-byte encoding: the byte offset of line 3 is its character offset.
    const offset = first.length + second.length + 2 * CRLF.length + 500;
    const broken = new Uint8Array([...bytes.subarray(0, offset), ...bytes.subarray(offset + 1)]);
    expect(broken.length).toBe(bytes.length - 1);
    expect(parseErrorIssues(() => parse1214(broken))).toEqual([
      expect.objectContaining({
        ruleId: 'parse.lineLength',
        severity: 'error',
        line: 3,
        column: 1160,
        recordType: '1020',
      }),
    ]);
  });

  it('a 9999 with a wrong count is parse.control.counts at the count field', () => {
    const { text } = generate1214(minimalInput(), OPTIONS);
    const wrongCount = tamper(text, { line: 3, position: 141, value: '03' });
    expect(parseErrorIssues(() => parse1214(wrongCount))).toEqual([
      expect.objectContaining({
        ruleId: 'parse.control.counts',
        line: 3,
        column: 141,
        recordType: '9999',
        value: 3,
        expected: '1',
      }),
    ]);
  });

  it('a 2200 before its 2000 is parse.order', () => {
    const { text } = generate1214(
      minimalInput({ foreignAppendix: foreignAppendixWithBreakdown('420') }),
      OPTIONS,
    );
    expect(text.split(CRLF).map(line => line.slice(4, 8))).toEqual([
      '1000',
      '1020',
      '2000',
      '2200',
      '9999',
      '',
    ]);
    // The 2200 has no 2000 before it, and the 2000 then follows a record of a later type (§3.3).
    expect(parseErrorIssues(() => parse1214(swapLines(text, 3, 4)))).toEqual([
      expect.objectContaining({ ruleId: 'parse.order', line: 3, column: 5, recordType: '2200' }),
      expect.objectContaining({ ruleId: 'parse.order', line: 4, column: 5, recordType: '2000' }),
    ]);
  });

  it('a 2-digit phone prefix on the numeric field 822 is zero-padded (alphanumeric 493 is space-padded)', () => {
    const input = minimalInput({
      company: { phone: { prefix: '02', number: '1234567' } },
      preparer: { phone: { prefix: '02', number: '6543210' } },
    });
    expect(issuesOf(input)).toEqual([]);
    const { text, bytes } = generate1214(input, OPTIONS);
    expect(text.slice(821, 824)).toBe('002');
    expect(text.slice(824, 831)).toBe('6543210');
    expect(text.slice(492, 495)).toBe(' 02');
    expect([...bytes.subarray(821, 824)]).toEqual([0x30, 0x30, 0x32]);
    expect(parse1214(bytes).report.preparer?.phone).toEqual({ prefix: '02', number: '6543210' });
  });
});
