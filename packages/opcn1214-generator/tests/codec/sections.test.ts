import {
  decodeCodeSection,
  decodeCountrySection,
  encodeCodeSection,
  encodeCountrySection,
  type CountryEntry,
} from '../../src/codec/sections.js';
import { CodecDecodeError } from '../../src/codec/types.js';
import { Opcn1214InternalError } from '../../src/errors.js';
import { getLayout, supportedTaxYears } from '../../src/layout/registry.js';
import type { CodeDef, RecordType } from '../../src/layout/types.js';

const LAYOUT = getLayout(2024);

function codesOf(record: RecordType): readonly CodeDef[] {
  return LAYOUT.records[record].codes;
}

function codeDef(record: RecordType, code: string): CodeDef {
  const def = codesOf(record).find(candidate => candidate.code === code);
  if (!def) {
    throw new Error(`no code ${code} in ${record}`);
  }
  return def;
}

const CODES_1000 = codesOf('1000');
const CODES_3027 = codesOf('3027');
const CODES_3077 = codesOf('3077');

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

function zeros(length: number): string {
  return '0'.repeat(length);
}

describe('layout invariant behind the section stop rule', () => {
  it('every code of every layout is 3 digits with a non-zero digit', () => {
    for (const year of supportedTaxYears()) {
      for (const record of Object.values(getLayout(year).records)) {
        for (const code of record.codes) {
          expect(code.code).toMatch(/^\d{3}$/);
          expect(code.code).not.toBe('000');
        }
      }
    }
  });
});

describe('encodeCodeSection', () => {
  it('writes entries in ascending code order, then zeros to the section length', () => {
    const section = encodeCodeSection(
      new Map([
        ['015', 3],
        ['010', 5000],
      ]),
      CODES_1000,
      2048,
    );
    expect(section).toHaveLength(2048);
    const first = `010${'5000'.padStart(12, '0')}`;
    expect(section.slice(0, 15)).toBe(first);
    expect(section.slice(15, 20)).toBe('01503');
    expect(section.slice(20)).toBe(zeros(2048 - 20));
  });

  it('writes an empty map as an all-zero section', () => {
    expect(encodeCodeSection(new Map(), CODES_1000, 2048)).toBe(zeros(2048));
  });

  it('writes capital-gains codes with 3 digits and scales ×100 kinds', () => {
    expect(codeDef('3027', '018').kind).toBe('rateX100');
    expect(codeDef('3027', '020').kind).toBe('amountX100');
    const section = encodeCodeSection(
      new Map([
        ['020', 1234.56],
        ['018', 23],
      ]),
      CODES_3027,
      1024,
    );
    expect(section.slice(0, 7)).toBe('0182300');
    expect(section.slice(7, 22)).toBe('020000000123456');
    expect(section.slice(22)).toBe(zeros(1024 - 22));
  });

  it('writes enum codes within their values and rejects others', () => {
    expect(codeDef('1000', '014').kind).toBe('enum');
    expect(encodeCodeSection(new Map([['014', 12]]), CODES_1000, 2048).slice(0, 6)).toBe('014012');
    expect(() => encodeCodeSection(new Map([['014', 7]]), CODES_1000, 2048)).toThrow(
      Opcn1214InternalError,
    );
  });

  it('rejects a code the record does not have', () => {
    expect(() => encodeCodeSection(new Map([['999', 1]]), CODES_1000, 2048)).toThrow(
      Opcn1214InternalError,
    );
  });

  it('rejects a value that does not fit the code width', () => {
    expect(() => encodeCodeSection(new Map([['010', 1e12]]), CODES_1000, 2048)).toThrow(
      Opcn1214InternalError,
    );
  });

  it('throws Opcn1214InternalError when the entries overflow the section', () => {
    const map = new Map([
      ['010', 1],
      ['015', 3],
    ]);
    expect(() => encodeCodeSection(map, CODES_1000, 19)).toThrow(Opcn1214InternalError);
    expect(encodeCodeSection(map, CODES_1000, 20)).toBe(`010${'1'.padStart(12, '0')}01503`);
  });
});

describe('decodeCodeSection', () => {
  it('is the exact inverse of encodeCodeSection', () => {
    const values = new Map([
      ['010', 5000],
      ['015', 3],
      ['014', 12],
    ]);
    const section = encodeCodeSection(values, CODES_1000, 2048);
    const decoded = decodeCodeSection(section, CODES_1000, 2048);
    expect(decoded).toEqual(values);
    expect([...decoded.keys()]).toEqual(['010', '014', '015']);
    expect(encodeCodeSection(decoded, CODES_1000, 2048)).toBe(section);
  });

  it('round-trips ×100 codes in natural units', () => {
    const values = new Map([
      ['018', 50],
      ['020', 1234.56],
      ['501', 0.01],
    ]);
    const section = encodeCodeSection(values, CODES_3077, 1024);
    expect(decodeCodeSection(section, CODES_3077, 1024)).toEqual(values);
  });

  it('round-trips every code of every record filled at once', () => {
    for (const record of Object.values(LAYOUT.records)) {
      if (record.section?.kind !== 'codeAmount') {
        continue;
      }
      const values = new Map(
        record.codes.map(code => [code.code, code.values?.at(-1)?.value ?? 1] as const),
      );
      const section = encodeCodeSection(values, record.codes, record.section.length);
      expect(decodeCodeSection(section, record.codes, record.section.length)).toEqual(values);
    }
  });

  it('decodes an all-zero section to an empty map', () => {
    expect(decodeCodeSection(zeros(2048), CODES_1000, 2048).size).toBe(0);
  });

  it('decodes a section filled to the last character', () => {
    const map = new Map([
      ['010', 1],
      ['015', 3],
    ]);
    expect(decodeCodeSection(encodeCodeSection(map, CODES_1000, 20), CODES_1000, 20)).toEqual(map);
  });

  it('keeps a zeroAllowed code with value 0 as the last entry', () => {
    expect(codeDef('1000', '159').zeroAllowed).toBe(true);
    const values = new Map([
      ['010', 5000],
      ['159', 0],
    ]);
    const section = encodeCodeSection(values, CODES_1000, 2048);
    expect(section.slice(15, 18)).toBe('159');
    expect(decodeCodeSection(section, CODES_1000, 2048)).toEqual(values);
  });

  it('rejects text of the wrong length', () => {
    const error = decodeError(() => decodeCodeSection(zeros(2047), CODES_1000, 2048));
    expect(error.reason).toBe('length');
  });

  it('rejects an unknown code at its offset', () => {
    const raw = `010${'5'.padStart(12, '0')}999${zeros(2048 - 18)}`;
    const error = decodeError(() => decodeCodeSection(raw, CODES_1000, 2048));
    expect(error.reason).toBe('section');
    expect(error.offset).toBe(15);
  });

  it('rejects a non-digit code at its offset', () => {
    const raw = `01A${zeros(2048 - 3)}`;
    const error = decodeError(() => decodeCodeSection(raw, CODES_1000, 2048));
    expect(error.reason).toBe('section');
    expect(error.offset).toBe(0);
  });

  it('rejects a truncated entry at its offset', () => {
    // 010 (12 digits) starts at 11 in a 20-character section: only 6 value digits fit.
    const raw = `01401201503010000001`;
    expect(raw).toHaveLength(20);
    const error = decodeError(() => decodeCodeSection(raw, CODES_1000, 20));
    expect(error.reason).toBe('section');
    expect(error.offset).toBe(11);
  });

  it('rejects a code too short to read at its offset', () => {
    const raw = `0150301`;
    const error = decodeError(() => decodeCodeSection(raw, CODES_1000, 7));
    expect(error.reason).toBe('section');
    expect(error.offset).toBe(5);
  });

  it('rejects a duplicate code at its offset', () => {
    const raw = `0150301504${zeros(2048 - 10)}`;
    const error = decodeError(() => decodeCodeSection(raw, CODES_1000, 2048));
    expect(error.reason).toBe('section');
    expect(error.offset).toBe(5);
  });

  it('rejects non-zero data after an all-zero gap at the first non-zero character', () => {
    const raw = `01503${zeros(10)}010${'5'.padStart(12, '0')}${zeros(2048 - 30)}`;
    const error = decodeError(() => decodeCodeSection(raw, CODES_1000, 2048));
    expect(error.reason).toBe('section');
    expect(error.offset).toBe(16);
  });

  it('translates a value error to its offset within the section', () => {
    const raw = `01503010${'12a'.padStart(12, '0')}${zeros(2048 - 20)}`;
    const error = decodeError(() => decodeCodeSection(raw, CODES_1000, 2048));
    expect(error.reason).toBe('numeric');
    expect(error.offset).toBe(19);
  });
});

describe('country section', () => {
  const COUNTRY_SECTION = LAYOUT.records['2200'].section;
  const LENGTH = COUNTRY_SECTION?.length ?? 0;

  it('uses the 2200 country-amount section of 1024 characters with up to 10 entries', () => {
    expect(COUNTRY_SECTION).toMatchObject({ kind: 'countryAmount', length: 1024, maxEntries: 10 });
  });

  it('writes affiliation, 3-character country and 12-digit income, then zeros', () => {
    const section = encodeCountrySection(
      [
        { country: '40', income: 1500 },
        { country: '-88', income: 7 },
      ],
      LENGTH,
    );
    expect(section).toHaveLength(LENGTH);
    expect(section.slice(0, 16)).toBe(`1040${'1500'.padStart(12, '0')}`);
    expect(section.slice(16, 32)).toBe(`1-88${'7'.padStart(12, '0')}`);
    expect(section.slice(32)).toBe(zeros(LENGTH - 32));
  });

  it('writes no entries as an all-zero section', () => {
    expect(encodeCountrySection([], LENGTH)).toBe(zeros(LENGTH));
  });

  it('round-trips up to 10 entries in input order, countries as 3-character keys', () => {
    const entries: CountryEntry[] = Array.from({ length: 10 }, (_, index) => ({
      country: String(index * 7 + 1),
      income: index * 1000,
    }));
    entries[9] = { country: '-88', income: 42 };
    const section = encodeCountrySection(entries, LENGTH);
    const decoded = decodeCountrySection(section, LENGTH);
    expect(decoded).toEqual(
      entries.map(entry => ({
        country: entry.country === '-88' ? '-88' : entry.country.padStart(3, '0'),
        income: entry.income,
      })),
    );
    expect(encodeCountrySection(decoded, LENGTH)).toBe(section);
  });

  it('rejects a country code that is not 3 digits or -88', () => {
    for (const country of ['1234', '4a', '-1', '']) {
      expect(() => encodeCountrySection([{ country, income: 1 }], LENGTH)).toThrow(
        Opcn1214InternalError,
      );
    }
  });

  it('rejects an invalid income', () => {
    expect(() => encodeCountrySection([{ country: '040', income: -1 }], LENGTH)).toThrow(
      Opcn1214InternalError,
    );
  });

  it('throws Opcn1214InternalError when the entries overflow the section', () => {
    expect(() => encodeCountrySection([{ country: '040', income: 1 }], 15)).toThrow(
      Opcn1214InternalError,
    );
  });

  it('decodes an all-zero section to no entries', () => {
    expect(decodeCountrySection(zeros(LENGTH), LENGTH)).toEqual([]);
  });

  it('rejects text of the wrong length', () => {
    expect(decodeError(() => decodeCountrySection(zeros(10), LENGTH)).reason).toBe('length');
  });

  it.each([
    ['a bad affiliation', `2040${zeros(11)}1${zeros(LENGTH - 16)}`, 0],
    ['a malformed country', `1-40${zeros(11)}1${zeros(LENGTH - 16)}`, 1],
    ['a non-digit country', `104a${zeros(11)}1${zeros(LENGTH - 16)}`, 1],
    ['a truncated entry', `1040${zeros(11)}11040${zeros(10)}`, 16],
    ['data after an all-zero gap', `1040${zeros(11)}1${zeros(16)}1040${zeros(LENGTH - 36)}`, 32],
  ])('rejects %s at its offset', (_name, raw, offset) => {
    const error = decodeError(() => decodeCountrySection(raw, raw.length));
    expect(error.reason).toBe('section');
    expect(error.offset).toBe(offset);
  });

  it('translates an income error to its offset within the section', () => {
    const raw = `1040${zeros(11)}11040${'x'.padStart(12, '0')}${zeros(LENGTH - 32)}`;
    const error = decodeError(() => decodeCountrySection(raw, LENGTH));
    expect(error.reason).toBe('numeric');
    expect(error.offset).toBe(31);
  });
});
