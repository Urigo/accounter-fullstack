import { encodeWindows1255 } from '../../src/codec/windows1255.js';
import { splitFile as split } from '../../src/file/split.js';
import type { ParseOptions } from '../../src/model/options.js';

/** The text of each line. */
function splitFile(content: string | Uint8Array, options?: ParseOptions): string[] {
  return split(content, options).map(line => line.text);
}

const BOM = String.fromCodePoint(0xfe_ff);
const UTF8_BOM_BYTES = [0xef, 0xbb, 0xbf];

function withUtf8Bom(bytes: Uint8Array): Uint8Array {
  return new Uint8Array([...UTF8_BOM_BYTES, ...bytes]);
}

describe('splitFile', () => {
  it('decodes bytes as windows-1255 by default', () => {
    expect(splitFile(encodeWindows1255('1214 שלום\r\nB\r\n'))).toEqual(['1214 שלום', 'B']);
  });

  it('decodes bytes as UTF-8 when asked', () => {
    const bytes = new TextEncoder().encode('1214 שלום\r\nB\r\n');
    expect(splitFile(bytes, { encoding: 'utf-8' })).toEqual(['1214 שלום', 'B']);
    expect(splitFile(bytes)).not.toEqual(['1214 שלום', 'B']);
  });

  it('takes strings as already decoded', () => {
    expect(splitFile('1214 שלום\r\nB\r\n')).toEqual(['1214 שלום', 'B']);
    expect(splitFile('1214 שלום\r\nB\r\n', { encoding: 'utf-8' })).toEqual(['1214 שלום', 'B']);
  });

  it('strips a UTF-8 BOM from strings and from bytes in either encoding', () => {
    expect(splitFile(`${BOM}A\r\nB\r\n`)).toEqual(['A', 'B']);
    expect(splitFile(withUtf8Bom(encodeWindows1255('א\r\nB\r\n')))).toEqual(['א', 'B']);
    expect(
      splitFile(withUtf8Bom(new TextEncoder().encode('א\r\nB\r\n')), { encoding: 'utf-8' }),
    ).toEqual(['א', 'B']);
  });

  it('accepts CRLF and LF line endings', () => {
    expect(splitFile('A\nB\n')).toEqual(['A', 'B']);
    expect(splitFile('A\r\nB\nC\r\n')).toEqual(['A', 'B', 'C']);
  });

  it('ignores one trailing empty line only', () => {
    expect(splitFile('A\r\nB')).toEqual(['A', 'B']);
    expect(splitFile('A\r\n\r\n')).toEqual(['A', '']);
    expect(splitFile('')).toEqual([]);
  });

  it('marks the first undecodable character of a line', () => {
    const utf8 = new Uint8Array([0x41, 0x0d, 0x0a, 0x42, 0x43, 0xc3, 0x0d, 0x0a]);
    expect(split(utf8, { encoding: 'utf-8' })).toEqual([
      { text: 'A' },
      { text: 'BC\uFFFD', invalidAt: 2 },
    ]);
    expect(split(new Uint8Array([0x41, 0xff, 0x0a]))).toEqual([{ text: 'A\uFFFD', invalidAt: 1 }]);
    expect(split('A\uFFFD')).toEqual([{ text: 'A\uFFFD' }]);
  });
});
