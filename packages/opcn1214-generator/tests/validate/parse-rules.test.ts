/**
 * Parse-only consistency rules (SPEC §8.2 step 3, §10.7): parse.occurrences (maximum record counts)
 * and parse.derivedMismatch (a derived value that disagrees with its source), each a golden file
 * with one deliberate defect.
 */
import { Opcn1214ParseError, parse1214, type Issue } from '../../src/index.js';
import { getLayout } from '../../src/layout/registry.js';
import type { RecordType } from '../../src/layout/types.js';
import { goldenText, repeatLine, tamper, type Tamper } from '../fixtures/files.js';

const CRLF = '\r\n';
const LAYOUT = getLayout(2024);

/** The golden file `name` with `edits` applied in order. */
function golden(name: string, ...edits: Tamper[]): string {
  return edits.reduce((text, edit) => tamper(text, edit), goldenText(name));
}

/** The issues of the Opcn1214ParseError parse1214 throws for `content`. */
function parseErrorIssues(content: string): readonly Issue[] {
  try {
    parse1214(content);
  } catch (error) {
    expect(error).toBeInstanceOf(Opcn1214ParseError);
    return (error as Opcn1214ParseError).issues;
  }
  throw new Error('Expected an Opcn1214ParseError');
}

function lineOf(text: string, line: number): string {
  const target = text.split(CRLF)[line - 1];
  if (target === undefined) {
    throw new Error(`no line ${line}`);
  }
  return target;
}

/**
 * The 1-based column where the entry of `code` starts in the code-amount section of `line` (a
 * record of `type`), read entry by entry with the code widths of the layout.
 */
function codeColumn(line: string, type: RecordType, code: string): number {
  const def = LAYOUT.records[type];
  const section = def.section;
  if (!section) {
    throw new Error(`record ${type} has no section`);
  }
  const end = section.start - 1 + section.length;
  for (let offset = section.start - 1; offset + 3 <= end;) {
    if (!/[^0]/.test(line.slice(offset, end))) {
      break;
    }
    const entry = line.slice(offset, offset + 3);
    if (entry === code) {
      return offset + 1;
    }
    const width = def.codes.find(candidate => candidate.code === entry)?.length;
    if (width === undefined) {
      throw new Error(`unknown code ${entry}`);
    }
    offset += 3 + width;
  }
  throw new Error(`code ${code} is not in the line`);
}

describe('parse.occurrences (maximum record counts, SPEC §3.2)', () => {
  it.each<[string, () => string, number]>([
    [
      '4 records 1010',
      // related-and-rd: 1000, 3 × 1010, 1020, 5 × 1030, 9999; 9999@139 counts 1010 records.
      () =>
        tamper(repeatLine(goldenText('related-and-rd'), 2), {
          line: 12,
          position: 139,
          value: '04',
        }),
      5,
    ],
    [
      '6 records 1030',
      // 9999@149 counts 1030 records.
      () =>
        tamper(repeatLine(goldenText('related-and-rd'), 6), {
          line: 12,
          position: 149,
          value: '06',
        }),
      11,
    ],
    [
      '2 records 2000',
      // foreign: 1000, 1020, 2000, 23 × 2200, 9999.
      () => repeatLine(goldenText('foreign'), 3),
      4,
    ],
    [
      '31 records 2200',
      // 9999@147 counts 2200 records.
      () =>
        tamper(repeatLine(goldenText('foreign'), 4, 8), { line: 35, position: 147, value: '31' }),
      34,
    ],
    [
      '15 capital-gains records',
      // capital-gains-max: 1000, 1020, 14 × 30xx (3077 last), 9999; 9999@145 counts them.
      () =>
        tamper(repeatLine(goldenText('capital-gains-max'), 16), {
          line: 18,
          position: 145,
          value: '15',
        }),
      17,
    ],
  ])('reports %s once, at the first record over the maximum', (_, file, line) => {
    const issues = parseErrorIssues(file()).filter(issue => issue.ruleId === 'parse.occurrences');
    expect(issues).toEqual([
      expect.objectContaining({ ruleId: 'parse.occurrences', severity: 'error', line, column: 5 }),
    ]);
  });

  it('accepts the maxima and never enforces a minimum (kibbutz has no 1020 record)', () => {
    for (const name of ['related-and-rd', 'foreign', 'capital-gains-max', 'kibbutz']) {
      expect(() => parse1214(goldenText(name))).not.toThrow();
    }
    expect(parse1214(goldenText('kibbutz')).report.shareholders).toEqual([]);
  });
});

describe('parse.derivedMismatch', () => {
  /** The one parse.derivedMismatch issue of `file`. */
  function mismatch(file: string): Issue {
    const issues = parseErrorIssues(file).filter(issue => issue.ruleId === 'parse.derivedMismatch');
    expect(issues).toHaveLength(1);
    return issues[0]!;
  }

  it('reports code 273 that disagrees with 1029/1030', () => {
    // minimal: 1029 = 2 → 1 (yes), so 273 must be 1, but the file has 9.
    const file = golden('minimal', { line: 1, position: 1029, value: '1' });
    expect(mismatch(file)).toMatchObject({
      severity: 'error',
      path: '',
      code: '273',
      recordType: '1000',
      recordIndex: 0,
      value: 9,
      expected: '1',
      line: 1,
      column: codeColumn(lineOf(file, 1), '1000', '273'),
    });
  });

  it('reports 832 = yes without a 2000 record', () => {
    expect(mismatch(golden('minimal', { line: 1, position: 832, value: '1' }))).toMatchObject({
      path: '',
      field: expect.objectContaining({ position: 832, length: 1 }),
      value: true,
      expected: 'false',
      line: 1,
      column: 832,
    });
  });

  it('reports 833 = no with capital-gains appendices', () => {
    expect(mismatch(golden('cg-63', { line: 1, position: 833, value: '2' }))).toMatchObject({
      path: 'declarations.hasCapitalGainsAppendix',
      field: expect.objectContaining({ position: 833 }),
      value: false,
      expected: 'true',
      line: 1,
      column: 833,
    });
  });

  it('reports 833 = no with untransmitted appendices (and the code 028 they call for)', () => {
    const file = golden('minimal', { line: 1, position: 962, value: '01' });
    const issues = parseErrorIssues(file).filter(issue => issue.ruleId === 'parse.derivedMismatch');
    expect(issues).toEqual([
      expect.objectContaining({ path: 'declarations.hasCapitalGainsAppendix', column: 833 }),
      expect.objectContaining({ code: '028', expected: '1', column: 2185 }),
    ]);
    expect(issues[1]).not.toHaveProperty('value');
  });

  it('reads 833 = yes without appendices back as hasCapitalGainsAppendix, not as a mismatch', () => {
    const { report } = parse1214(golden('minimal', { line: 1, position: 833, value: '1' }));
    expect(report.declarations.hasCapitalGainsAppendix).toBe(true);
  });

  it('reports a missing code 008 while 882 = yes', () => {
    expect(mismatch(golden('minimal', { line: 1, position: 882, value: '1' }))).toMatchObject({
      code: '008',
      expected: '1',
      column: 2185,
    });
  });

  it('reports a missing code 297 while 834 = obliged', () => {
    expect(mismatch(golden('minimal', { line: 1, position: 834, value: '1' }))).toMatchObject({
      code: '297',
      expected: '8',
      column: 2185,
    });
  });

  it('reports code 297 while 834 = not relevant', () => {
    const file = golden('main-full', { line: 1, position: 834, value: '3' });
    expect(mismatch(file)).toMatchObject({
      code: '297',
      expected: 'absent',
      column: codeColumn(lineOf(file, 1), '1000', '297'),
    });
  });

  it('reports code 028 that does not count the appendices and untransmitted ones', () => {
    // cg-63: one appendix, 028 = 1; 962 = 1 untransmitted makes it 2.
    const file = golden('cg-63', { line: 1, position: 962, value: '01' });
    expect(mismatch(file)).toMatchObject({
      code: '028',
      value: 1,
      expected: '2',
      column: codeColumn(lineOf(file, 1), '1000', '028'),
    });
  });

  it('reports a bank code 280 other than 1', () => {
    const text = goldenText('main-full');
    const column = codeColumn(lineOf(text, 1), '1000', '280');
    const file = tamper(text, { line: 1, position: column + 3, value: '2' });
    expect(mismatch(file)).toMatchObject({ code: '280', value: 2, expected: '1', column });
  });

  it.each<[string, string, Tamper, Partial<Issue>]>([
    [
      'a wrong 1020 serial number',
      'minimal',
      { line: 2, position: 137, value: '02' },
      { recordType: '1020', recordIndex: 0, value: 2, expected: '1' },
    ],
    [
      'a wrong 1010 serial number',
      'related-and-rd',
      { line: 3, position: 137, value: '01' },
      { recordType: '1010', recordIndex: 1, value: 1, expected: '2' },
    ],
    [
      'a 1030 affiliation other than 1',
      'related-and-rd',
      { line: 6, position: 137, value: '2' },
      { recordType: '1030', recordIndex: 0, value: 2, expected: '1' },
    ],
    [
      'a transaction symbol that is not the record type',
      'cg-63',
      { line: 3, position: 137, value: '64' },
      { recordType: '3063', recordIndex: 0, value: 64, expected: '63' },
    ],
    [
      'a wrong appendix number',
      // capital-gains-max: lines 3 and 4 are the two 3027 appendices.
      'capital-gains-max',
      { line: 4, position: 139, value: '001' },
      { recordType: '3027', recordIndex: 1, value: 1, expected: '2' },
    ],
    [
      'a wrong "מספר בתל"ם" sequence number',
      'capital-gains-max',
      { line: 3, position: 255, value: '05' },
      { recordType: '3027', recordIndex: 0, value: 5, expected: '1' },
    ],
    [
      'a 3077@245 improvement count that is not the filled slots',
      // cg-77: five improvements.
      'cg-77',
      { line: 3, position: 245, value: '04' },
      { recordType: '3077', recordIndex: 0, value: 4, expected: '5' },
    ],
  ])('reports %s at the field', (_, name, edit, expected) => {
    expect(mismatch(golden(name, edit))).toMatchObject({
      ...expected,
      path: '',
      field: expect.objectContaining({ position: edit.position }),
      line: edit.line,
      column: edit.position,
    });
  });

  it('finds no mismatch in any golden file', () => {
    for (const name of ['minimal', 'main-full', 'related-and-rd', 'foreign', 'cg-77']) {
      expect(() => parse1214(goldenText(name))).not.toThrow();
    }
  });
});
