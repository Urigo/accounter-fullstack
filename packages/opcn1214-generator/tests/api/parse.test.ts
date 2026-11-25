import { encodeWindows1255 } from '../../src/codec/windows1255.js';
import { generate1214, Opcn1214ParseError, parse1214, type Issue } from '../../src/index.js';
import { canonicalize } from '../../src/normalize/canonical.js';
import { minimalInput, relatedCompanies } from '../fixtures/builders.js';
import { dropLine, goldenText, tamper as tamperAt } from '../fixtures/files.js';

const OPTIONS = { today: () => '2025-03-31' };
const CRLF = '\r\n';

function tamper(text: string, line: number, position: number, value: string): string {
  return tamperAt(text, { line, position, value });
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

describe('parse1214', () => {
  const { text, bytes } = generate1214(
    minimalInput({ meta: { softwareName: 'MY SOFT', saveDate: '2025-02-03' } }),
    OPTIONS,
  );

  it('returns the canonical report, the save date and the software name', () => {
    const result = parse1214(bytes);
    expect(result.saveDate).toBe('2025-02-03');
    expect(result.softwareName).toBe('MY SOFT');
    expect(result.report).toEqual(
      canonicalize(
        minimalInput({ meta: { softwareName: 'MY SOFT', saveDate: '2025-02-03' } }),
        OPTIONS,
      ),
    );
    expect(result.issues).toEqual([]);
  });

  it('accepts LF line endings', () => {
    expect(parse1214(text.replaceAll(CRLF, '\n')).report).toEqual(parse1214(bytes).report);
  });

  it('returns field issues of a well-formed but invalid file with input paths, without throwing', () => {
    const blankName = tamper(text, 1, 175, ' '.repeat(50));
    const result = parse1214(blankName);
    expect(result.report.company).not.toHaveProperty('registeredName');
    expect(result.issues).toEqual([
      expect.objectContaining({
        ruleId: 'field.required',
        severity: 'error',
        path: 'company.registeredName',
        recordType: '1000',
      }),
    ]);
  });

  it('locates issues of shareholder records by their input index', () => {
    const latinName = tamper(text, 2, 148, 'Israel Israeli'.padStart(50, ' '));
    expect(parse1214(latinName).issues).toEqual([
      expect.objectContaining({
        ruleId: 'field.hebrewFirstLetter',
        path: 'shareholders[0].fullName',
        recordType: '1020',
        recordIndex: 0,
      }),
    ]);
  });

  it('reads the layout from the tax year of record 1000', () => {
    const { bytes: bytes2025 } = generate1214(minimalInput({ taxYear: 2025 }), OPTIONS);
    const result = parse1214(bytes2025);
    expect(result.report.taxYear).toBe(2025);
    // A 2025 file is read with the provisional 2024 layout (SPEC §14).
    expect(result.issues).toEqual([
      expect.objectContaining({
        ruleId: 'struct.taxYear.provisionalLayout',
        severity: 'warning',
        path: 'taxYear',
        value: 2025,
      }),
    ]);
  });

  it('returns an empty save date and software name when the file leaves them blank', () => {
    const result = parse1214(tamper(text, 1, 150, ' '.repeat(25)));
    expect(result.saveDate).toBe('');
    expect(result.softwareName).toBe('');
    expect(result.report).not.toHaveProperty('meta');
    expect(result.issues.map(issue => [issue.ruleId, issue.path])).toEqual([
      ['field.required', 'meta.softwareName'],
      ['field.required', 'meta.saveDate'],
    ]);
  });

  it('returns the values of a file not written by generate1214 as read, not canonicalized', () => {
    // A double space in the registered name: generate1214 would have normalized it (SPEC §4.3).
    const result = parse1214(tamper(text, 1, 175, 'חברה  בעמ'.padStart(50, ' ')));
    expect(result.issues).toEqual([]);
    expect(result.report.company.registeredName).toBe('חברה  בעמ');
    expect(canonicalize(result.report, OPTIONS)).not.toEqual(result.report);
  });

  it('throws Opcn1214ParseError for an empty file and for a file that does not start with 1000', () => {
    expect(parseErrorIssues(() => parse1214(''))).toEqual([
      expect.objectContaining({ ruleId: 'parse.empty', line: 1, column: 1 }),
    ]);
    expect(parseErrorIssues(() => parse1214(dropLine(text, 1)))).toEqual([
      expect.objectContaining({ ruleId: 'parse.order', line: 1, column: 5 }),
    ]);
  });

  it('reports every structural problem of a file, sorted by line, each with line and column', () => {
    let broken = tamper(text, 3, 141, '07');
    broken = tamper(broken, 1, 165, '31/04/2025');
    broken = tamper(broken, 2, 9, '9');
    const issues = parseErrorIssues(() => parse1214(broken));
    expect(issues.map(({ ruleId, line, column }) => ({ ruleId, line, column }))).toEqual([
      { ruleId: 'parse.date', line: 1, column: 165 },
      { ruleId: 'parse.prefixFiller', line: 2, column: 9 },
      { ruleId: 'parse.control.counts', line: 3, column: 141 },
    ]);
    expect(issues[0]).toMatchObject({
      path: 'meta.saveDate',
      recordType: '1000',
      recordIndex: 0,
      field: { position: 165, length: 10 },
      severity: 'error',
    });
    expect(issues[2]).toMatchObject({ value: 7, expected: '1', recordType: '9999' });
  });

  it('continues with the next line after a problem', () => {
    const broken = tamper(tamper(text, 1, 137, 'X'), 2, 147, 'Y');
    expect(parseErrorIssues(() => parse1214(broken))).toEqual([
      expect.objectContaining({ ruleId: 'parse.numeric', line: 1, column: 137 }),
      expect.objectContaining({
        ruleId: 'parse.numeric',
        line: 2,
        column: 147,
        path: 'shareholders[0].idNumber',
      }),
    ]);
  });

  it('reports a line of the wrong length at the first missing or extra column', () => {
    const lines = text.split(CRLF);
    const short = [lines[0], lines[1], lines[2]?.slice(0, -1), ''].join(CRLF);
    const long = [lines[0], `${lines[1]}0`, lines[2], ''].join(CRLF);
    expect(parseErrorIssues(() => parse1214(short))).toEqual([
      expect.objectContaining({ ruleId: 'parse.lineLength', line: 3, column: 150 }),
    ]);
    expect(parseErrorIssues(() => parse1214(long))).toEqual([
      expect.objectContaining({ ruleId: 'parse.lineLength', line: 2, column: 1161 }),
    ]);
  });

  it('reports a second 1000 record and records after 9999 as out of order', () => {
    const lines = text.split(CRLF);
    const twoMains = [lines[0], lines[0], lines[1], lines[2], ''].join(CRLF);
    expect(parseErrorIssues(() => parse1214(twoMains))).toContainEqual(
      expect.objectContaining({ ruleId: 'parse.order', line: 2 }),
    );
  });

  it('reports a record after the 9999, and only that, without miscounting the 9999', () => {
    const lines = text.split(CRLF);
    const after = [lines[0], lines[1], lines[2], lines[1], ''].join(CRLF);
    expect(parseErrorIssues(() => parse1214(after))).toEqual([
      expect.objectContaining({
        ruleId: 'parse.order',
        line: 4,
        column: 5,
        message: 'Line 4, column 5: Record 1020 comes after the 9999 record that ends the report.',
      }),
    ]);
    const mainAfter = [lines[0], lines[1], lines[2], lines[0], ''].join(CRLF);
    expect(parseErrorIssues(() => parse1214(mainAfter))).toEqual([
      expect.objectContaining({
        ruleId: 'parse.order',
        line: 4,
        message: 'Line 4, column 5: Record 1000 comes after the 9999 record that ends the report.',
      }),
    ]);
  });

  it('reports a second 9999 record', () => {
    const lines = text.split(CRLF);
    const twoControls = [lines[0], lines[1], lines[2], lines[2], ''].join(CRLF);
    expect(parseErrorIssues(() => parse1214(twoControls))).toEqual([
      expect.objectContaining({ ruleId: 'parse.order', line: 4, recordType: '9999' }),
    ]);
  });

  it('reports a missing 9999 after the last line', () => {
    expect(parseErrorIssues(() => parse1214(dropLine(text, 3)))).toEqual([
      expect.objectContaining({ ruleId: 'parse.control.missing', line: 3, column: 1 }),
    ]);
  });

  it('reports an undecodable byte with parse.encoding at its line and column', () => {
    const bytes = new TextEncoder().encode(text);
    const secondLine = bytes.indexOf(0x0a) + 1;
    bytes[secondLine + 9] = 0xc3;
    expect(parseErrorIssues(() => parse1214(bytes, { encoding: 'utf-8' }))).toEqual([
      expect.objectContaining({ ruleId: 'parse.encoding', line: 2, column: 10 }),
    ]);
    const golden = new TextEncoder().encode('1214');
    const unassigned = new Uint8Array([...golden, 0xff]);
    expect(parseErrorIssues(() => parse1214(unassigned))).toContainEqual(
      expect.objectContaining({ ruleId: 'parse.encoding', line: 1, column: 5 }),
    );
  });

  it('still selects the layout when the bad byte of the 1000 line comes after the tax year', () => {
    // Byte 200 of line 1 is 0xFF (unassigned in windows-1255), and line 2 is one character short.
    const golden = goldenText('minimal');
    const lines = golden.split(CRLF);
    const bytes = encodeWindows1255(
      [lines[0], lines[1]?.slice(0, -1), ...lines.slice(2)].join(CRLF),
    );
    bytes[199] = 0xff;
    expect(parseErrorIssues(() => parse1214(bytes))).toEqual([
      expect.objectContaining({ ruleId: 'parse.encoding', line: 1, column: 200 }),
      expect.objectContaining({ ruleId: 'parse.lineLength', line: 2, column: 1160 }),
    ]);
    // Before the tax year, the layout is unknown: only the encoding problem is reported.
    const early = encodeWindows1255(goldenText('minimal'));
    early[140] = 0xff;
    expect(parseErrorIssues(() => parse1214(early))).toEqual([
      expect.objectContaining({ ruleId: 'parse.encoding', line: 1, column: 141 }),
    ]);
  });

  it('gives decode errors inside a code-amount entry the code and its input path', () => {
    // 1000@2185 is the code-amount section: code 018 (1 digit), then code 072 (value from 2192).
    expect(text.split(CRLF)[0]?.slice(2184, 2192)).toBe('01840720');
    expect(parseErrorIssues(() => parse1214(tamper(text, 1, 2195, 'X')))).toEqual([
      expect.objectContaining({
        ruleId: 'parse.numeric',
        code: '072',
        path: 'amounts["072"]',
        line: 1,
        column: 2195,
      }),
    ]);
    // An unknown code has no input path.
    const [issue] = parseErrorIssues(() => parse1214(tamper(text, 1, 2185, '999')));
    expect(issue).toMatchObject({ ruleId: 'parse.codeSection', path: '' });
    expect(issue).not.toHaveProperty('code');
  });

  it('reports an unsupported tax year in 1000@146 as struct.taxYear.unsupported', () => {
    expect(parseErrorIssues(() => parse1214(tamper(text, 1, 146, '2023')))).toEqual([
      expect.objectContaining({
        ruleId: 'struct.taxYear.unsupported',
        path: 'taxYear',
        value: 2023,
        line: 1,
        column: 146,
      }),
    ]);
  });

  it('reports a tax year that is not a number as parse.numeric', () => {
    expect(parseErrorIssues(() => parse1214(tamper(text, 1, 146, '20X4')))).toEqual([
      expect.objectContaining({ ruleId: 'parse.numeric', path: 'taxYear', line: 1, column: 146 }),
    ]);
  });

  it('maps format problems inside header fields to parse.fieldValue', () => {
    expect(parseErrorIssues(() => parse1214(tamper(text, 1, 493, '011')))).toEqual([
      expect.objectContaining({
        ruleId: 'parse.fieldValue',
        path: 'company.phone.prefix',
        line: 1,
        column: 493,
      }),
    ]);
  });

  describe('related companies (1010)', () => {
    const related = generate1214(
      minimalInput({ relatedCompanies: relatedCompanies(2) }),
      OPTIONS,
    ).text;

    it('reads 1010 records between 1000 and 1020 back as relatedCompanies', () => {
      const result = parse1214(related);
      expect(result.report.relatedCompanies).toEqual(relatedCompanies(2));
      expect(result.issues).toEqual([]);
    });

    it.each([
      ['before 1000', [1, 0, 2, 3, 4], 1],
      ['after 1020', [0, 1, 3, 2, 4], 4],
    ])('reports a 1010 record %s as parse.order', (_, order, line) => {
      const lines = related.split(CRLF);
      const reordered = [...order.map(index => lines[index]), ''].join(CRLF);
      expect(parseErrorIssues(() => parse1214(reordered))).toContainEqual(
        expect.objectContaining({ ruleId: 'parse.order', recordType: '1010', line }),
      );
    });

    it('locates issues of 1010 records by their input index', () => {
      // 1010@198 relation type 9 is not an allowed value.
      const result = parse1214(tamper(related, 3, 198, '9'));
      expect(result.issues).toEqual([
        expect.objectContaining({
          ruleId: 'field.enum',
          path: 'relatedCompanies[1].relationType',
          recordType: '1010',
          recordIndex: 1,
        }),
      ]);
      expect(result.report.relatedCompanies?.[1]?.relationType).toBe(9);
    });

    it('reports 1010 records the 9999 record does not count (9999@139)', () => {
      expect(parseErrorIssues(() => parse1214(tamper(related, 5, 139, '01')))).toEqual([
        expect.objectContaining({ ruleId: 'parse.control.counts', line: 5, column: 139 }),
      ]);
    });
  });

  it('never lets anything but Opcn1214ParseError escape for corrupted golden files', () => {
    const golden = goldenText('minimal');
    const lines = golden.split(CRLF);
    for (const [index, line] of lines.entries()) {
      for (let position = 1; position <= line.length; position += 37) {
        for (const value of ['X', ' ', '9', '\u05D0']) {
          const corrupted = tamper(golden, index + 1, position, value);
          try {
            parse1214(corrupted);
          } catch (error) {
            expect(error).toBeInstanceOf(Opcn1214ParseError);
            for (const issue of (error as Opcn1214ParseError).issues) {
              expect(issue.line).toBeGreaterThan(0);
              expect(issue.column).toBeGreaterThan(0);
            }
          }
        }
      }
    }
  });
});

describe('parse1214: declarations rebuilt from their flags (SPEC §7.3)', () => {
  const { text: declared } = generate1214(
    minimalInput({
      declarations: {
        tookReportablePosition: true,
        reportablePositions: [12, 7, 5],
        familyCompany: { representativeFileNumber: '300000007' },
      },
      amounts: { '080': 0 },
    }),
    OPTIONS,
  );

  it('drops a member whose flag is not marked (836 = 0, 837 filled)', () => {
    const { report } = parse1214(tamper(declared, 1, 836, '0'));
    expect(report.declarations).not.toHaveProperty('familyCompany');
  });

  it('keeps a marked object whose member is written as absent (837 = 0)', () => {
    const { report } = parse1214(tamper(declared, 1, 837, '000000000'));
    expect(report.declarations.familyCompany).toEqual({});
  });

  it('reads the reportable positions as the non-zero values in field order', () => {
    const { report } = parse1214(tamper(declared, 1, 1037, '000'));
    expect(report.declarations.reportablePositions).toEqual([12, 5]);
  });
});
