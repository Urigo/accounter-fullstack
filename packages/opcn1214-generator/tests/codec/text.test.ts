import { codecFor } from '../../src/codec/registry.js';
import { CodecDecodeError, type FieldShape, type Primitive } from '../../src/codec/types.js';
import { Opcn1214InternalError } from '../../src/errors.js';
import { getLayout, supportedTaxYears } from '../../src/layout/registry.js';
import type { CodeKind, EnumValue, FieldKind } from '../../src/layout/types.js';

type Kind = FieldKind | CodeKind;

/** Allowed phone prefixes (SPEC §4.2), as the layout stores them (numbers, leading zero lost). */
const PHONE_PREFIXES = [
  '02',
  '03',
  '04',
  '08',
  '09',
  '072',
  '073',
  '074',
  '076',
  '077',
  '050',
  '052',
  '053',
  '054',
  '055',
  '057',
  '058',
  '059',
] as const;
const PREFIX_VALUES: readonly EnumValue[] = PHONE_PREFIXES.map(prefix => ({
  value: Number(prefix),
}));

function shape(
  kind: Kind,
  length: number,
  type: FieldShape['type'],
  values?: readonly EnumValue[],
): FieldShape {
  return values ? { kind, length, type, values } : { kind, length, type };
}

function encode(
  kind: Kind,
  value: Primitive,
  length: number,
  type: FieldShape['type'],
  values?: readonly EnumValue[],
): string {
  return codecFor(kind).encode(value, shape(kind, length, type, values));
}

function decode(
  kind: Kind,
  raw: string,
  type: FieldShape['type'],
  values?: readonly EnumValue[],
): Primitive {
  return codecFor(kind).decode(raw, shape(kind, raw.length, type, values));
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

const ENUM_VALUES: readonly EnumValue[] = [{ value: 1 }, { value: 2 }, { value: 12 }];
const FLAG_VALUES: readonly EnumValue[] = [{ value: 1, label: 'marked' }];
const YES_NO_VALUES: readonly EnumValue[] = [
  { value: 1, label: 'yes' },
  { value: 2, label: 'no' },
];

describe('text and hebrewText', () => {
  it.each(['text', 'hebrewText'] as const)('%s: alphanumeric padding', kind => {
    expect(encode(kind, 'abc', 6, 'alphanumeric')).toBe('   abc');
    expect(encode(kind, 'שלום', 6, 'alphanumeric')).toBe('  שלום');
    expect(encode(kind, 'abcdef', 6, 'alphanumeric')).toBe('abcdef');
    expect(encode(kind, undefined, 4, 'alphanumeric')).toBe('    ');
  });

  it.each(['text', 'hebrewText'] as const)('%s: round trip', kind => {
    const fieldShape = shape(kind, 50, 'alphanumeric');
    const codec = codecFor(kind);
    for (const value of ['חברה בע"מ', 'Acme Ltd', 'x', 'א'.repeat(50)]) {
      const encoded = codec.encode(value, fieldShape);
      expect(encoded).toHaveLength(50);
      expect(codec.decode(encoded, fieldShape)).toBe(value);
    }
  });

  it.each(['text', 'hebrewText'] as const)('%s: all spaces decode to undefined', kind => {
    expect(decode(kind, '     ', 'alphanumeric')).toBeUndefined();
  });

  it('decoding trims padding spaces (SPEC §8.2)', () => {
    expect(decode('text', '  a b  ', 'alphanumeric')).toBe('a b');
  });

  it.each(['  abc\n', '\u000Babc  ', '  abc\u00A0', '\tabc  '])(
    'decoding trims only spaces: %j keeps its other whitespace',
    raw => {
      expect(decode('text', raw, 'alphanumeric')).toBe(raw.replaceAll(/^ +| +$/g, ''));
    },
  );

  it('whitespace other than spaces is not blank', () => {
    expect(decode('text', '\t\t', 'alphanumeric')).toBe('\t\t');
  });

  it.each<[Kind, Primitive]>([
    ['text', 'abcdefg'],
    ['hebrewText', 'אבגדהוז'],
    ['text', 12],
    ['text', true],
  ])('%s %j (width 6) throws Opcn1214InternalError', (kind, value) => {
    expect(() => encode(kind, value, 6, 'alphanumeric')).toThrow(Opcn1214InternalError);
  });

  it('decode checks the raw width', () => {
    const error = decodeError(() =>
      codecFor('text').decode('abc', shape('text', 5, 'alphanumeric')),
    );
    expect(error.reason).toBe('length');
    expect(error.offset).toBe(3);
  });
});

describe('date', () => {
  it('encodes ISO dates as DD/MM/YYYY', () => {
    expect(encode('date', '2024-12-31', 10, 'alphanumeric')).toBe('31/12/2024');
    expect(encode('date', '2024-02-29', 10, 'alphanumeric')).toBe('29/02/2024');
    expect(encode('date', undefined, 10, 'alphanumeric')).toBe(' '.repeat(10));
  });

  it('decodes DD/MM/YYYY to ISO', () => {
    expect(decode('date', '31/12/2024', 'alphanumeric')).toBe('2024-12-31');
    expect(decode('date', '01/01/2000', 'alphanumeric')).toBe('2000-01-01');
  });

  it('all spaces decode to undefined', () => {
    expect(decode('date', ' '.repeat(10), 'alphanumeric')).toBeUndefined();
  });

  it.each(['\t'.repeat(10), '\u00A0'.repeat(10)])(
    'blank means spaces only: %j throws CodecDecodeError date at offset 0',
    raw => {
      const error = decodeError(() => decode('date', raw, 'alphanumeric'));
      expect(error.reason).toBe('date');
      expect(error.offset).toBe(0);
    },
  );

  it.each(['2024-12-31', '2024-02-29', '2000-02-29', '2023-01-01', '1999-11-30'])(
    'round trip %s',
    value => {
      const fieldShape = shape('date', 10, 'alphanumeric');
      const codec = codecFor('date');
      expect(codec.decode(codec.encode(value, fieldShape), fieldShape)).toBe(value);
    },
  );

  it.each<Primitive>([
    '2023-02-29',
    '2024-13-01',
    '2024-04-31',
    '2024-00-10',
    '2024-01-00',
    '31/12/2024',
    '2024-1-1',
    '',
    20_241_231,
  ])('encode %j throws Opcn1214InternalError', value => {
    expect(() => encode('date', value, 10, 'alphanumeric')).toThrow(Opcn1214InternalError);
  });

  it.each<[string, number]>([
    ['31-12-2024', 2],
    ['3a/12/2024', 1],
    ['31/12/20 4', 8],
    ['2024-12-31', 2],
    ['00/00/0000', 0],
    ['29/02/2023', 0],
    ['29/02/1900', 0],
    ['31/04/2024', 0],
    ['01/13/2024', 0],
    ['0000000000', 2],
  ])('decode %j throws CodecDecodeError date at offset %i', (raw, offset) => {
    const error = decodeError(() => decode('date', raw, 'alphanumeric'));
    expect(error.reason).toBe('date');
    expect(error.offset).toBe(offset);
  });

  it('decode checks the raw width', () => {
    const error = decodeError(() =>
      codecFor('date').decode('31/12/24', shape('date', 10, 'alphanumeric')),
    );
    expect(error.reason).toBe('length');
  });
});

describe('flag', () => {
  it('encodes true → 1, false and undefined → 0', () => {
    expect(encode('flag', true, 1, 'numeric', FLAG_VALUES)).toBe('1');
    expect(encode('flag', false, 1, 'numeric', FLAG_VALUES)).toBe('0');
    expect(encode('flag', undefined, 1, 'numeric', FLAG_VALUES)).toBe('0');
  });

  it('decodes 1 → true, 0 → undefined', () => {
    expect(decode('flag', '1', 'numeric', FLAG_VALUES)).toBe(true);
    expect(decode('flag', '0', 'numeric', FLAG_VALUES)).toBeUndefined();
  });

  it.each<Primitive>([1, 'true', 0])('encode %j throws Opcn1214InternalError', value => {
    expect(() => encode('flag', value, 1, 'numeric')).toThrow(Opcn1214InternalError);
  });

  it.each<[string, CodecDecodeError['reason']]>([
    ['2', 'format'],
    ['9', 'format'],
    [' ', 'numeric'],
    ['x', 'numeric'],
  ])('decode %j throws CodecDecodeError %s', (raw, reason) => {
    const error = decodeError(() => decode('flag', raw, 'numeric'));
    expect(error.reason).toBe(reason);
    expect(error.offset).toBe(0);
  });
});

describe('yesNo', () => {
  it('encodes true → 1, false → 2, undefined → 0 (SPEC §15 A-20)', () => {
    expect(encode('yesNo', true, 1, 'numeric', YES_NO_VALUES)).toBe('1');
    expect(encode('yesNo', false, 1, 'numeric', YES_NO_VALUES)).toBe('2');
    expect(encode('yesNo', undefined, 1, 'numeric', YES_NO_VALUES)).toBe('0');
  });

  it('decodes 1 → true, 2 → false, 0 → undefined', () => {
    expect(decode('yesNo', '1', 'numeric')).toBe(true);
    expect(decode('yesNo', '2', 'numeric')).toBe(false);
    expect(decode('yesNo', '0', 'numeric')).toBeUndefined();
  });

  it.each([true, false, undefined])('round trip %j', value => {
    const fieldShape = shape('yesNo', 1, 'numeric', YES_NO_VALUES);
    const codec = codecFor('yesNo');
    expect(codec.decode(codec.encode(value, fieldShape), fieldShape)).toBe(value);
  });

  it.each<Primitive>([1, 2, 'yes'])('encode %j throws Opcn1214InternalError', value => {
    expect(() => encode('yesNo', value, 1, 'numeric')).toThrow(Opcn1214InternalError);
  });

  it.each<[string, CodecDecodeError['reason']]>([
    ['3', 'format'],
    [' ', 'numeric'],
    ['-', 'numeric'],
  ])('decode %j throws CodecDecodeError %s', (raw, reason) => {
    const error = decodeError(() => decode('yesNo', raw, 'numeric'));
    expect(error.reason).toBe(reason);
    expect(error.offset).toBe(0);
  });
});

describe('enum', () => {
  it('encodes the mapped value, zero-padded', () => {
    expect(encode('enum', 12, 3, 'numeric', ENUM_VALUES)).toBe('012');
    expect(encode('enum', 1, 3, 'numeric', ENUM_VALUES)).toBe('001');
    expect(encode('enum', undefined, 3, 'numeric', ENUM_VALUES)).toBe('000');
  });

  it.each<[Primitive, readonly EnumValue[] | undefined]>([
    [3, ENUM_VALUES],
    [0, ENUM_VALUES],
    ['12', ENUM_VALUES],
    [12, undefined],
  ])('encode %j throws Opcn1214InternalError when not in values', (value, values) => {
    expect(() => encode('enum', value, 3, 'numeric', values)).toThrow(Opcn1214InternalError);
  });

  it('decodes to a number; values outside the list are left to field.enum', () => {
    expect(decode('enum', '012', 'numeric', ENUM_VALUES)).toBe(12);
    expect(decode('enum', '007', 'numeric', ENUM_VALUES)).toBe(7);
    expect(decode('enum', '000', 'numeric', ENUM_VALUES)).toBe(0);
  });

  it('round trip', () => {
    const fieldShape = shape('enum', 3, 'numeric', ENUM_VALUES);
    const codec = codecFor('enum');
    for (const { value } of ENUM_VALUES) {
      expect(codec.decode(codec.encode(value, fieldShape), fieldShape)).toBe(value);
    }
  });

  it.each<[string, number]>([
    ['   ', 0],
    ['0a1', 1],
  ])('decode %j throws CodecDecodeError numeric at offset %i', (raw, offset) => {
    const error = decodeError(() => decode('enum', raw, 'numeric', ENUM_VALUES));
    expect(error.reason).toBe('numeric');
    expect(error.offset).toBe(offset);
  });
});

describe('phonePrefix (SPEC §15 A-19)', () => {
  it('every phone-prefix field of every layout allows exactly the SPEC §4.2 prefixes', () => {
    for (const year of supportedTaxYears()) {
      const fields = Object.values(getLayout(year).records).flatMap(record =>
        record.fields.filter(field => field.kind === 'phonePrefix'),
      );
      expect(fields.length).toBeGreaterThan(0);
      for (const field of fields) {
        expect(field.values?.map(({ value }) => `0${value}`)).toEqual(PHONE_PREFIXES);
      }
    }
  });

  it.each<[string, FieldShape['type'], string]>([
    ['02', 'alphanumeric', ' 02'],
    ['02', 'numeric', '002'],
    ['052', 'alphanumeric', '052'],
    ['052', 'numeric', '052'],
    ['072', 'numeric', '072'],
  ])('%j (%s width 3) → %j and back', (value, type, expected) => {
    expect(encode('phonePrefix', value, 3, type, PREFIX_VALUES)).toBe(expected);
    expect(decode('phonePrefix', expected, type, PREFIX_VALUES)).toBe(value);
  });

  it('absent: spaces (alphanumeric) or zeros (numeric), decoded to undefined', () => {
    expect(encode('phonePrefix', undefined, 3, 'alphanumeric', PREFIX_VALUES)).toBe('   ');
    expect(encode('phonePrefix', undefined, 3, 'numeric', PREFIX_VALUES)).toBe('000');
    expect(decode('phonePrefix', '   ', 'alphanumeric', PREFIX_VALUES)).toBeUndefined();
    expect(decode('phonePrefix', '000', 'numeric', PREFIX_VALUES)).toBeUndefined();
  });

  it.each(PHONE_PREFIXES)('round trip %s in both field types', prefix => {
    for (const type of ['alphanumeric', 'numeric'] as const) {
      const fieldShape = shape('phonePrefix', 3, type, PREFIX_VALUES);
      const codec = codecFor('phonePrefix');
      expect(codec.decode(codec.encode(prefix, fieldShape), fieldShape)).toBe(prefix);
    }
  });

  it.each<[Primitive, readonly EnumValue[] | undefined]>([
    ['01', PREFIX_VALUES],
    ['2', PREFIX_VALUES],
    ['0052', PREFIX_VALUES],
    ['052', undefined],
    [52, PREFIX_VALUES],
  ])('encode %j throws Opcn1214InternalError', (value, values) => {
    expect(() => encode('phonePrefix', value, 3, 'numeric', values)).toThrow(Opcn1214InternalError);
  });

  it.each<[string, FieldShape['type'], CodecDecodeError['reason'], number]>([
    ['   ', 'numeric', 'numeric', 0],
    [' 02', 'numeric', 'numeric', 0],
    ['0x2', 'numeric', 'numeric', 1],
    ['001', 'numeric', 'format', 0],
    [' 51', 'alphanumeric', 'format', 1],
  ])('decode %j (%s) throws CodecDecodeError %s', (raw, type, reason, offset) => {
    const error = decodeError(() => decode('phonePrefix', raw, type, PREFIX_VALUES));
    expect(error.reason).toBe(reason);
    expect(error.offset).toBe(offset);
  });
});

describe('percentX100 (SPEC §15 A-2)', () => {
  it.each<[number, string]>([
    [10.23, ' 1023'],
    [100, '10000'],
    [1, '  100'],
    [5.5, '  550'],
  ])('%j → %j', (value, expected) => {
    expect(encode('percentX100', value, 5, 'alphanumeric')).toBe(expected);
    expect(decode('percentX100', expected, 'alphanumeric')).toBe(value);
  });

  it('absent → spaces → undefined', () => {
    expect(encode('percentX100', undefined, 5, 'alphanumeric')).toBe('     ');
    expect(decode('percentX100', '     ', 'alphanumeric')).toBeUndefined();
  });

  it.each<Primitive>([10.234, -1, Number.NaN, 1000, '10'])(
    'encode %j throws Opcn1214InternalError',
    value => {
      expect(() => encode('percentX100', value, 5, 'alphanumeric')).toThrow(Opcn1214InternalError);
    },
  );

  it('decode of non-digits throws CodecDecodeError numeric', () => {
    const error = decodeError(() => decode('percentX100', '10.23', 'alphanumeric'));
    expect(error.reason).toBe('numeric');
    expect(error.offset).toBe(2);
  });
});

describe('percentLiteral (SPEC §15 A-3)', () => {
  it.each<[number, string]>([
    [100, '00100'],
    [10.23, '10.23'],
    [5.5, '05.50'],
    [1, '00001'],
    [0.5, '00.50'],
    [99.99, '99.99'],
  ])('%j → %j and back', (value, expected) => {
    expect(encode('percentLiteral', value, 5, 'numeric')).toBe(expected);
    expect(decode('percentLiteral', expected, 'numeric')).toBe(value);
  });

  it('floating-point noise is scaled, not printed', () => {
    expect(encode('percentLiteral', 0.1 + 0.2, 5, 'numeric')).toBe('00.30');
    expect(encode('percentLiteral', 10.000_000_000_1, 5, 'numeric')).toBe('00010');
  });

  it('absent → zeros → 0 (the record codec decides absence)', () => {
    expect(encode('percentLiteral', undefined, 5, 'numeric')).toBe('00000');
    expect(decode('percentLiteral', '00000', 'numeric')).toBe(0);
  });

  it('10 and 10.0 encode alike (SPEC §8.4)', () => {
    expect(encode('percentLiteral', 10.0, 5, 'numeric')).toBe('00010');
  });

  it.each<Primitive>([10.234, -1, Number.NaN, 1000.5, 100_000, '10'])(
    'encode %j throws Opcn1214InternalError',
    value => {
      expect(() => encode('percentLiteral', value, 5, 'numeric')).toThrow(Opcn1214InternalError);
    },
  );

  it.each<[string, number]>([
    ['     ', 0],
    ['1.2.3', 3],
    ['10,23', 2],
    ['00a10', 2],
    ['.1234', 0],
    ['1234.', 4],
  ])('decode %j throws CodecDecodeError numeric at offset %i', (raw, offset) => {
    const error = decodeError(() => decode('percentLiteral', raw, 'numeric'));
    expect(error.reason).toBe('numeric');
    expect(error.offset).toBe(offset);
  });

  it('decode checks the raw width', () => {
    const error = decodeError(() =>
      codecFor('percentLiteral').decode('10.2', shape('percentLiteral', 5, 'numeric')),
    );
    expect(error.reason).toBe('length');
  });
});

describe('every B2 codec checks the raw width', () => {
  it.each<Kind>([
    'text',
    'hebrewText',
    'date',
    'flag',
    'yesNo',
    'enum',
    'phonePrefix',
    'percentX100',
    'percentLiteral',
  ])('%s', kind => {
    for (const type of ['numeric', 'alphanumeric'] as const) {
      const error = decodeError(() =>
        codecFor(kind).decode('0', shape(kind, 3, type, PREFIX_VALUES)),
      );
      expect(error.reason).toBe('length');
      expect(error.offset).toBe(1);
    }
  });
});
