import { ALPHANUMERIC_PAD_SIDE, padAlphanumeric, padNumeric } from '../../src/codec/padding.js';
import { codecFor, CODECS } from '../../src/codec/registry.js';
import { CodecDecodeError, type FieldShape, type Primitive } from '../../src/codec/types.js';
import { Opcn1214InternalError } from '../../src/errors.js';
import type { CodeKind, FieldKind } from '../../src/layout/types.js';

type Kind = FieldKind | CodeKind;

function shape(kind: Kind, length: number, type: FieldShape['type'] = 'numeric'): FieldShape {
  return { kind, length, type };
}

function encode(kind: Kind, value: Primitive, length: number, type?: FieldShape['type']): string {
  return codecFor(kind).encode(value, shape(kind, length, type));
}

function decode(kind: Kind, raw: string, type?: FieldShape['type']): Primitive {
  return codecFor(kind).decode(raw, shape(kind, raw.length, type));
}

function decodeError(fn: () => unknown): CodecDecodeError {
  try {
    fn();
  } catch (error) {
    if (error instanceof CodecDecodeError) {
      return error;
    }
    throw error;
  }
  throw new Error('expected a CodecDecodeError');
}

const INTEGER_KINDS = [
  'num',
  'year',
  'count',
  'serial',
  'const',
  'foreignCode',
  'amount',
  'amountX',
] as const satisfies readonly Kind[];
const DIGIT_STRING_KINDS = ['id9', 'shareholderId', 'digits'] as const satisfies readonly Kind[];
const SCALED_KINDS = ['amountX100', 'rateX100'] as const satisfies readonly Kind[];
const NUMERIC_KINDS = [
  ...INTEGER_KINDS,
  ...DIGIT_STRING_KINDS,
  ...SCALED_KINDS,
  'filler',
] as const satisfies readonly Kind[];

describe('padding', () => {
  it('pads alphanumeric values with spaces on the left (SPEC §15 A-1)', () => {
    expect(ALPHANUMERIC_PAD_SIDE).toBe('left');
  });

  it.each([
    ['1234', 12, '000000001234'],
    ['0', 3, '000'],
    ['123', 3, '123'],
    ['', 2, '00'],
  ])('padNumeric(%j, %i) → %j', (value, width, expected) => {
    expect(padNumeric(value, width)).toBe(expected);
  });

  it.each([
    ['abc', 5, 'left', '  abc'],
    ['abc', 5, 'right', 'abc  '],
    ['abc', 3, 'left', 'abc'],
    ['', 2, 'left', '  '],
  ] as const)('padAlphanumeric(%j, %i, %s) → %j', (value, width, side, expected) => {
    expect(padAlphanumeric(value, width, side)).toBe(expected);
  });

  it('padAlphanumeric defaults to ALPHANUMERIC_PAD_SIDE', () => {
    expect(padAlphanumeric('0', 12)).toBe('           0');
  });

  it('throws Opcn1214InternalError for a value longer than the width', () => {
    expect(() => padNumeric('1234', 3)).toThrow(Opcn1214InternalError);
    expect(() => padAlphanumeric('abcd', 3)).toThrow(Opcn1214InternalError);
  });
});

describe('numeric codecs', () => {
  it('every numeric kind resolves through codecFor', () => {
    for (const kind of NUMERIC_KINDS) {
      expect(codecFor(kind)).toBe(CODECS[kind]);
    }
  });

  describe('encode', () => {
    it.each<[Kind, Primitive, number, FieldShape['type'], string]>([
      ['num', 7, 5, 'numeric', '00007'],
      ['num', 0, 2, 'numeric', '00'],
      ['year', 2024, 4, 'numeric', '2024'],
      ['count', 3, 2, 'numeric', '03'],
      ['serial', 12, 3, 'numeric', '012'],
      ['const', 27, 2, 'numeric', '27'],
      ['const', 1, 1, 'numeric', '1'],
      ['foreignCode', 42, 3, 'numeric', '042'],
      ['amount', 1234, 12, 'numeric', '000000001234'],
      ['amount', 0, 12, 'numeric', '000000000000'],
      ['amount', 999_999_999_999, 12, 'numeric', '999999999999'],
      ['amountX', 0, 12, 'alphanumeric', '           0'],
      ['amountX', 1234, 12, 'alphanumeric', '        1234'],
      ['amountX', 1234, 12, 'numeric', '000000001234'],
      ['id9', '12345', 9, 'numeric', '000012345'],
      ['id9', '000012345', 9, 'numeric', '000012345'],
      ['shareholderId', '999999964', 9, 'numeric', '999999964'],
      ['digits', '12', 3, 'numeric', '012'],
      ['digits', '0', 3, 'numeric', '000'],
      ['amountX100', 1234.56, 12, 'numeric', '000000123456'],
      ['amountX100', 0.1 + 0.2, 12, 'numeric', '000000000030'],
      ['amountX100', 7, 12, 'numeric', '000000000700'],
      ['amountX100', 0, 12, 'numeric', '000000000000'],
      ['rateX100', 23, 4, 'numeric', '2300'],
      ['rateX100', 50, 4, 'numeric', '5000'],
      ['filler', undefined, 5, 'numeric', '00000'],
      ['filler', undefined, 5, 'alphanumeric', '     '],
    ])('%s %j (width %i, %s) → %j', (kind, value, length, type, expected) => {
      expect(encode(kind, value, length, type)).toBe(expected);
    });

    it.each(NUMERIC_KINDS)('%s: undefined → zeros (numeric) or spaces (alphanumeric)', kind => {
      expect(encode(kind, undefined, 4, 'numeric')).toBe('0000');
      expect(encode(kind, undefined, 4, 'alphanumeric')).toBe('    ');
    });

    it.each(NUMERIC_KINDS)('%s: always returns exactly the field width', kind => {
      for (const length of [1, 4, 12]) {
        expect(encode(kind, undefined, length)).toHaveLength(length);
      }
    });
  });

  describe('encode rejects values validation should have rejected', () => {
    it.each<[Kind, Primitive, number]>([
      // negative
      ['num', -1, 5],
      ['amount', -1, 12],
      ['amountX', -5, 12],
      ['amountX100', -0.01, 12],
      ['rateX100', -23, 4],
      // non-integer amount / number
      ['amount', 1.5, 12],
      ['amountX', 0.1, 12],
      ['num', 2.5, 5],
      ['year', 2024.1, 4],
      // NaN and infinities
      ['amount', Number.NaN, 12],
      ['amount', Number.POSITIVE_INFINITY, 12],
      ['amountX100', Number.NaN, 12],
      ['rateX100', Number.NaN, 4],
      // more than 2 decimals for ×100 kinds
      ['amountX100', 1.234, 12],
      ['amountX100', 0.001, 12],
      ['rateX100', 23.001, 4],
      // wider than the field
      ['amount', 1_000_000_000_000, 12],
      ['num', 100, 2],
      ['amountX', 1_000_000_000_000, 12],
      ['amountX100', 10_000_000_000, 12],
      ['rateX100', 100, 4],
      ['id9', '1234567890', 9],
      ['digits', '1234', 3],
      // non-digit digit strings
      ['id9', '12a45', 9],
      ['id9', '-12345', 9],
      ['id9', '', 9],
      ['shareholderId', '12 45', 9],
      ['digits', '1.2', 3],
      // wrong primitive type
      ['amount', '12', 12],
      ['num', true, 5],
      ['id9', 12_345, 9],
      ['digits', false, 3],
      ['amountX100', '1.5', 12],
      // filler never carries a value
      ['filler', 0, 3],
      ['filler', '', 3],
    ])('%s %j (width %i) throws Opcn1214InternalError', (kind, value, length) => {
      expect(() => encode(kind, value, length)).toThrow(Opcn1214InternalError);
    });

    // Width 20 fits every digit, so only the safe-integer guard can reject these.
    it.each<[Kind, number]>([
      ['amount', 2 ** 53],
      ['amountX100', Number.MAX_SAFE_INTEGER],
    ])('%s %d is not a safe integer (after scaling) and throws', (kind, value) => {
      expect(() => encode(kind, value, 20)).toThrow(Opcn1214InternalError);
    });
  });

  describe('decode', () => {
    it.each<[Kind, string, FieldShape['type'], Primitive]>([
      ['num', '00007', 'numeric', 7],
      ['year', '2024', 'numeric', 2024],
      ['amount', '000000001234', 'numeric', 1234],
      ['amountX', '        1234', 'alphanumeric', 1234],
      ['amountX', '           0', 'alphanumeric', 0],
      ['amountX', '000000001234', 'numeric', 1234],
      ['amountX100', '000000123456', 'numeric', 1234.56],
      ['amountX100', '000000000030', 'numeric', 0.3],
      ['rateX100', '2300', 'numeric', 23],
      ['id9', '000012345', 'numeric', '000012345'],
      ['digits', '012', 'numeric', '012'],
    ])('%s %j (%s) → %j', (kind, raw, type, expected) => {
      expect(decode(kind, raw, type)).toBe(expected);
    });

    it.each([...INTEGER_KINDS, ...SCALED_KINDS])('%s: all-zero numeric text decodes to 0', kind => {
      expect(decode(kind, '0000')).toBe(0);
    });

    it.each(DIGIT_STRING_KINDS)('%s: all-zero text decodes to the full-width string', kind => {
      expect(decode(kind, '000')).toBe('000');
    });

    it.each([...INTEGER_KINDS, ...DIGIT_STRING_KINDS, ...SCALED_KINDS])(
      '%s: all-space text in a numeric field throws CodecDecodeError numeric at offset 0',
      kind => {
        const error = decodeError(() => decode(kind, '    ', 'numeric'));
        expect(error.reason).toBe('numeric');
        expect(error.offset).toBe(0);
      },
    );

    it.each(NUMERIC_KINDS)(
      '%s: all-space text in an alphanumeric field decodes to undefined',
      kind => {
        expect(decode(kind, '    ', 'alphanumeric')).toBeUndefined();
      },
    );

    it('amountX: all-space alphanumeric text decodes to undefined', () => {
      expect(decode('amountX', ' '.repeat(12), 'alphanumeric')).toBeUndefined();
    });

    it('filler: all-space text in a numeric field decodes to undefined', () => {
      expect(decode('filler', '    ', 'numeric')).toBeUndefined();
    });

    it('filler: any content decodes to undefined (D-4)', () => {
      expect(decode('filler', '000')).toBeUndefined();
      expect(decode('filler', 'x1 ', 'alphanumeric')).toBeUndefined();
    });

    it.each<[Kind, string, FieldShape['type'], number]>([
      ['num', '12a45', 'numeric', 2],
      ['amount', 'x00000001234', 'numeric', 0],
      ['amount', '00000000123-', 'numeric', 11],
      ['amount', '  0000001234', 'numeric', 0],
      ['year', '20 4', 'numeric', 2],
      ['amountX100', '0000001234.5', 'numeric', 10],
      ['rateX100', '23.0', 'numeric', 2],
      ['id9', '00001234x', 'numeric', 8],
      ['shareholderId', '-12345678', 'numeric', 0],
      ['digits', '0 2', 'numeric', 1],
      ['amountX', '      12 34', 'alphanumeric', 8],
      ['amountX', '        12a4', 'alphanumeric', 10],
      ['amountX', '1234        ', 'alphanumeric', 4],
      // Padding is the space character only: other whitespace is not padding (p.61).
      ['amountX', '\t\t\t\t\t\t\t\t1234', 'alphanumeric', 0],
      ['amountX', '\u00a0'.repeat(12), 'alphanumeric', 0],
      ['amountX', '\t'.repeat(12), 'alphanumeric', 0],
      ['amountX', '       1234\u000b', 'alphanumeric', 11],
    ])('%s %j (%s) throws CodecDecodeError numeric at offset %i', (kind, raw, type, offset) => {
      const error = decodeError(() => decode(kind, raw, type));
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('CodecDecodeError');
      expect(error.reason).toBe('numeric');
      expect(error.offset).toBe(offset);
    });

    it.each(NUMERIC_KINDS)(
      '%s: raw text of the wrong length throws CodecDecodeError length',
      kind => {
        const error = decodeError(() => codecFor(kind).decode('00', shape(kind, 3)));
        expect(error.reason).toBe('length');
        expect(error.offset).toBe(2);
      },
    );
  });

  describe('round trip', () => {
    it.each<[Kind, Primitive, number, FieldShape['type']]>([
      ['num', 0, 5, 'numeric'],
      ['num', 99_999, 5, 'numeric'],
      ['year', 2024, 4, 'numeric'],
      ['count', 30, 2, 'numeric'],
      ['serial', 1, 3, 'numeric'],
      ['const', 66, 2, 'numeric'],
      ['foreignCode', 401, 3, 'numeric'],
      ['amount', 0, 12, 'numeric'],
      ['amount', 123_456_789, 12, 'numeric'],
      ['amountX', 0, 12, 'alphanumeric'],
      ['amountX', 987_654, 12, 'alphanumeric'],
      ['amountX100', 0, 12, 'numeric'],
      ['amountX100', 1234.56, 12, 'numeric'],
      ['amountX100', 0.01, 12, 'numeric'],
      ['amountX100', 0.3, 12, 'numeric'],
      ['amountX100', 9_999_999_999.99, 12, 'numeric'],
      ['rateX100', 23, 4, 'numeric'],
      ['rateX100', 50, 4, 'numeric'],
      ['id9', '000012345', 9, 'numeric'],
      ['id9', '123456789', 9, 'numeric'],
      ['shareholderId', '999999998', 9, 'numeric'],
      ['digits', '052', 3, 'numeric'],
      ['digits', '1234567', 7, 'numeric'],
      ['filler', undefined, 3, 'numeric'],
      ['filler', undefined, 3, 'alphanumeric'],
    ])('%s %j (width %i, %s)', (kind, value, length, type) => {
      const fieldShape = shape(kind, length, type);
      const codec = codecFor(kind);
      expect(codec.decode(codec.encode(value, fieldShape), fieldShape)).toBe(value);
    });

    it.each(DIGIT_STRING_KINDS)('%s: a short digit string comes back full width', kind => {
      const fieldShape = shape(kind, 3);
      const codec = codecFor(kind);
      const encoded = codec.encode('12', fieldShape);
      expect(encoded).toBe('012');
      expect(codec.decode(encoded, fieldShape)).toBe('012');
    });
  });
});
