import { encodeWindows1255 } from '../../src/codec/windows1255.js';
import {
  Opcn1214ParseError,
  parseResponseFile,
  type Issue,
  type ResponseRecord,
} from '../../src/index.js';

/** The issues of the Opcn1214ParseError `run` throws; fails when it throws nothing or another error. */
function parseErrorIssues(run: () => unknown): readonly Issue[] {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(Opcn1214ParseError);
    return (error as Opcn1214ParseError).issues;
  }
  throw new Error('expected an Opcn1214ParseError');
}

const HEBREW_DETAIL = 'שדה 150 שם התוכנה';

describe('parseResponseFile', () => {
  it('parses one record per line with the SPEC §3.9 meaning; only 00 is accepted', () => {
    const file = [
      '123456789202400',
      '000000012202405',
      '987654321202533field 150 software name   ',
    ].join('\r\n');
    expect(parseResponseFile(file)).toEqual<ResponseRecord[]>([
      {
        fileNumber: '123456789',
        taxYear: 2024,
        code: '00',
        meaning: 'Valid; saved in a temporary state',
        accepted: true,
        line: 1,
      },
      {
        fileNumber: '000000012',
        taxYear: 2024,
        code: '05',
        meaning: 'Report already filed',
        accepted: false,
        line: 2,
      },
      {
        fileNumber: '987654321',
        taxYear: 2025,
        code: '33',
        meaning: 'Invalid value + field detail',
        accepted: false,
        detail: 'field 150 software name',
        line: 3,
      },
    ]);
  });

  it.each([
    ['01', 'File type closed, or after the last year allowed for filing'],
    ['04', 'Year blocked'],
    ['06', 'You are not the representative of this file'],
    ['07', 'No file exists for the requested tax year'],
    ['08', 'Non-numeric value + field detail'],
    ['09', 'Report was transmitted'],
    ['15', 'Cannot transmit for the requested tax year'],
    ['16', 'Files mismatch'],
    ['20', 'Calculation type mismatch'],
    ['21', 'Report was transmitted via the internet'],
    ['23', 'A file exists for the spouse too; contact the account card'],
    ['31', 'Invalid record type'],
    ['32', 'Invalid form type'],
    ['97', 'Report is being handled by the tax office'],
    ['98', 'Representatives-registry connection problem; notify SHAAM'],
    ['99', 'Input data problem; notify SHAAM'],
  ])('code %s means "%s"', (code, meaning) => {
    expect(parseResponseFile(`1234567892024${code}`)).toEqual([
      expect.objectContaining({ code, meaning, accepted: false }),
    ]);
  });

  it.each(['02', '42', 'AB'])('an unknown code %s means a general error', code => {
    expect(parseResponseFile(`1234567892024${code}`)).toEqual([
      expect.objectContaining({ code, meaning: 'General error; notify SHAAM', accepted: false }),
    ]);
  });

  it('decodes windows-1255 bytes, Hebrew detail text included', () => {
    const bytes = encodeWindows1255(`123456789202408${HEBREW_DETAIL}  \r\n`);
    expect(parseResponseFile(bytes)).toEqual<ResponseRecord[]>([
      {
        fileNumber: '123456789',
        taxYear: 2024,
        code: '08',
        meaning: 'Non-numeric value + field detail',
        accepted: false,
        detail: HEBREW_DETAIL,
        line: 1,
      },
    ]);
  });

  it('accepts LF and CRLF line endings and ignores blank lines, keeping file line numbers', () => {
    const text = '\n123456789202400\r\n   \r\n\n000000012202405\n';
    const fromText = parseResponseFile(text);
    expect(fromText.map(({ fileNumber, line }) => ({ fileNumber, line }))).toEqual([
      { fileNumber: '123456789', line: 2 },
      { fileNumber: '000000012', line: 5 },
    ]);
    expect(parseResponseFile(encodeWindows1255(text))).toEqual(fromText);
  });

  it('returns no records for an empty file', () => {
    expect(parseResponseFile('')).toEqual([]);
    expect(parseResponseFile(new Uint8Array())).toEqual([]);
    expect(parseResponseFile('\r\n\r\n')).toEqual([]);
  });

  it('omits detail when only spaces follow the code', () => {
    expect(parseResponseFile('123456789202400     ')[0]).not.toHaveProperty('detail');
  });

  it('throws Opcn1214ParseError with every malformed line, by line and column', () => {
    const file = [
      '123456789202400',
      '12345678920240',
      '12345678X202400',
      '1234567892O2400',
      '',
      '12A45',
    ].join('\n');
    const issues = parseErrorIssues(() => parseResponseFile(file));
    expect(
      issues.map(({ ruleId, severity, line, column, value }) => ({
        ruleId,
        severity,
        line,
        column,
        value,
      })),
    ).toEqual([
      { ruleId: 'parse.lineLength', severity: 'error', line: 2, column: 15, value: undefined },
      { ruleId: 'parse.numeric', severity: 'error', line: 3, column: 9, value: '12345678X' },
      { ruleId: 'parse.numeric', severity: 'error', line: 4, column: 11, value: '2O24' },
      { ruleId: 'parse.numeric', severity: 'error', line: 6, column: 3, value: '12A45' },
      { ruleId: 'parse.lineLength', severity: 'error', line: 6, column: 6, value: undefined },
    ]);
    expect(issues.every(issue => issue.path === '')).toBe(true);
    expect(issues[0]?.message).toBe(
      'Line 2, column 15: A response line must have at least 15 characters, not 14.',
    );
  });
});
