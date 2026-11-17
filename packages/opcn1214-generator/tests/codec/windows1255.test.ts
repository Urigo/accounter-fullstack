import {
  decodeWindows1255,
  encodeWindows1255,
  isWindows1255Representable,
} from '../../src/codec/windows1255.js';
import { Opcn1214InternalError } from '../../src/errors.js';

describe('windows-1255 helpers', () => {
  it('round-trips Hebrew, ASCII and CRLF', () => {
    const text = 'שלום abc\r\n';
    const bytes = encodeWindows1255(text);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(decodeWindows1255(bytes)).toBe(text);
  });

  it('writes one byte per character', () => {
    const text = 'שלום abc\r\n';
    expect(encodeWindows1255(text)).toHaveLength(text.length);
  });

  it('encodes Hebrew letters to their code-page bytes', () => {
    expect([...encodeWindows1255('אתa')]).toEqual([0xe0, 0xfa, 0x61]);
  });

  it.each(['שלום', 'abc 123', '\r\n', 'בע\u05F4מ', 'ש\u05B8\u05C1לו\u05B9ם'.normalize('NFC'), '?'])(
    '%j is representable',
    text => {
      expect(isWindows1255Representable(text)).toBe(true);
    },
  );

  it.each(['😀', '中文', 'a😀b', '\u0416', '\uFFFD'])('%j is not representable', text => {
    expect(isWindows1255Representable(text)).toBe(false);
  });

  it('control characters are in the code page (the charset rule owns them, D-14)', () => {
    expect(isWindows1255Representable('\u0001\u007F')).toBe(true);
  });

  it.each(['😀', 'abc中', 'שלום😀', 'a\uFFFD'])(
    'encodeWindows1255(%j) throws Opcn1214InternalError instead of emitting "?"',
    text => {
      expect(() => encodeWindows1255(text)).toThrow(Opcn1214InternalError);
    },
  );
});
