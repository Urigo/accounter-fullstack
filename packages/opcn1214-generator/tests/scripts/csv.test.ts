import { parseCsv, parseCsvRecords } from '../../scripts/layout/csv.js';

describe('parseCsv', () => {
  it('splits plain rows and fields', () => {
    expect(parseCsv('a,b,c\n1,2,3\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('keeps commas inside quoted fields', () => {
    expect(parseCsv('a,"b, c",d\n')).toEqual([['a', 'b, c', 'd']]);
  });

  it('unescapes doubled quotes inside quoted fields', () => {
    expect(parseCsv('"say ""hi""",x\n')).toEqual([['say "hi"', 'x']]);
  });

  it('keeps newlines inside quoted fields', () => {
    expect(parseCsv('"line 1\nline 2",x\r\n"a\r\nb",y\r\n')).toEqual([
      ['line 1\nline 2', 'x'],
      ['a\r\nb', 'y'],
    ]);
  });

  it('accepts CRLF and LF line endings alike', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual(parseCsv('a,b\n1,2\n'));
  });

  it('does not need a trailing newline and does not emit an empty last row', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseCsv('a,b\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('keeps empty fields', () => {
    expect(parseCsv('a,,c,\n')).toEqual([['a', '', 'c', '']]);
  });

  it('keeps Hebrew text unchanged', () => {
    expect(parseCsv('1000,מספר תיק,"שם, חברה"\n')).toEqual([['1000', 'מספר תיק', 'שם, חברה']]);
  });

  it('throws on an unterminated quoted field', () => {
    expect(() => parseCsv('a,"b\n')).toThrow(/line 1/);
  });

  it('throws on text after a closing quote', () => {
    expect(() => parseCsv('a\n"b"c\n')).toThrow(/line 2/);
  });
});

describe('parseCsvRecords', () => {
  it('maps every row to an object keyed by the header row', () => {
    expect(parseCsvRecords('record,key\r\n1000,taxYear\r\n1010,"a,b"\r\n')).toEqual([
      { record: '1000', key: 'taxYear' },
      { record: '1010', key: 'a,b' },
    ]);
  });

  it('returns no rows for a header-only file', () => {
    expect(parseCsvRecords('a,b\n')).toEqual([]);
  });

  it('throws with the line number of a row with too few or too many columns', () => {
    expect(() => parseCsvRecords('a,b,c\n1,2,3\n4,5\n')).toThrow(/line 3.*expected 3.*got 2/);
    expect(() => parseCsvRecords('a,b\n"x\ny",2\n1,2,3\n')).toThrow(/line 4.*expected 2.*got 3/);
  });

  it('throws on an empty file', () => {
    expect(() => parseCsvRecords('')).toThrow(/header/);
  });
});
