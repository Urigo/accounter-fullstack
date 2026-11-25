import { isAllowedTextChar, normalizeText } from '../../src/normalize/text.js';

describe('normalizeText (SPEC §4.3)', () => {
  it('applies Unicode NFC', () => {
    // 'e' + combining acute → precomposed 'é'
    expect(normalizeText('Cafe\u0301')).toBe('Caf\u00E9');
  });

  it.each([
    ['\u200E', 'LRM'],
    ['\u200F', 'RLM'],
    ['\u202A', 'LRE'],
    ['\u202B', 'RLE'],
    ['\u202C', 'PDF'],
    ['\u202D', 'LRO'],
    ['\u202E', 'RLO'],
    ['\u2066', 'LRI'],
    ['\u2067', 'RLI'],
    ['\u2068', 'FSI'],
    ['\u2069', 'PDI'],
  ])('removes the bidi control %j (%s)', control => {
    expect(normalizeText(`אב${control}ג abc${control}`)).toBe('אבג abc');
  });

  it.each([
    ['NBSP', 'a\u00A0b', 'a b'],
    ['TAB', 'a\tb', 'a b'],
    ['left double quote', '\u201Cx', '"x'],
    ['right double quote', 'x\u201D', 'x"'],
    ['low double quote', '\u201Ex', '"x'],
    ['left single quote', '\u2018x', "'x"],
    ['right single quote', 'x\u2019', "x'"],
    ['en dash', 'a\u2013b', 'a-b'],
    ['em dash', 'a\u2014b', 'a-b'],
  ])('replaces %s', (_name, value, expected) => {
    expect(normalizeText(value)).toBe(expected);
  });

  it('trims and collapses runs of spaces', () => {
    expect(normalizeText('   חברה   בע"מ  ')).toBe('חברה בע"מ');
    expect(normalizeText('\u00A0\t a \t\u00A0 b\t')).toBe('a b');
  });

  it('keeps Hebrew in logical order', () => {
    expect(normalizeText('שלום עולם 123')).toBe('שלום עולם 123');
  });

  it('keeps geresh, gershayim and niqqud', () => {
    expect(normalizeText('צ\u05F3יפס')).toBe('צ\u05F3יפס');
    expect(normalizeText('בע\u05F4מ')).toBe('בע\u05F4מ');
    expect(normalizeText('ש\u05B8\u05C1לו\u05B9ם')).toBe('ש\u05B8\u05C1לו\u05B9ם'.normalize('NFC'));
  });

  it('does not remove control characters (validation reports them)', () => {
    expect(normalizeText('a\u0001b')).toBe('a\u0001b');
    expect(normalizeText('a\u007Fb')).toBe('a\u007Fb');
    expect(normalizeText('a\r\nb')).toBe('a\r\nb');
  });

  it.each([
    ['trailing LF', 'abc\n'],
    ['leading VT', '\u000Babc'],
    ['trailing CR', 'abc\r'],
    ['leading FF', '\u000Cabc'],
    ['trailing BOM', 'abc\uFEFF'],
    ['leading line separator', '\u2028abc'],
    ['trailing em space', 'abc\u2003'],
    ['leading ideographic space', '\u3000abc'],
  ])('trims only spaces: keeps a %s for validation to report', (_name, value) => {
    expect(normalizeText(value)).toBe(value);
    expect(normalizeText(` ${value} `)).toBe(value);
  });

  it('removes bidi controls before NFC, so the result is NFC and idempotent', () => {
    // shin, shin dot, RLM, qamats: the RLM blocked canonical reordering of the two marks.
    const once = normalizeText('\u05E9\u05C1\u200F\u05B8');
    expect(once).toBe('\u05E9\u05C1\u05B8'.normalize('NFC'));
    expect(once).toBe(once.normalize('NFC'));
    expect(normalizeText(once)).toBe(once);
  });

  it('returns an empty string for whitespace-only input', () => {
    expect(normalizeText(' \t\u00A0\u200F ')).toBe('');
  });
});

describe('isAllowedTextChar', () => {
  it.each(['a', 'Z', '0', ' ', '"', "'", '-', 'א', 'ת', '\u05F3', '\u05F4', '\u05B8', '₪'])(
    '%j is allowed',
    ch => {
      expect(isAllowedTextChar(ch)).toBe(true);
    },
  );

  it('is false for every C0 control character and DEL', () => {
    for (let code = 0; code <= 0x1f; code++) {
      expect(isAllowedTextChar(String.fromCodePoint(code))).toBe(false);
    }
    expect(isAllowedTextChar('\u007F')).toBe(false);
  });

  it.each(['😀', '中', '\u0416', '\u2066', '\uFFFD'])(
    '%j (not in windows-1255) is not allowed',
    ch => {
      expect(isAllowedTextChar(ch)).toBe(false);
    },
  );
});
