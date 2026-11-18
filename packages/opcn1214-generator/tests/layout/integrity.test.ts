import { readFileSync } from 'node:fs';
import { parseCsvRecords } from '../../scripts/layout/csv.js';
import { countryKey } from '../../src/layout/countries.js';
import { getLayout } from '../../src/layout/registry.js';
import {
  CODE_KINDS,
  FIELD_KINDS,
  type CodeKind,
  type FieldKind,
  type RecordDef,
} from '../../src/layout/types.js';

const PREFIX_LENGTH = 136;
const DERIVED_PREFIX = '(derived) ';

const layout = getLayout(2024);
const records: RecordDef[] = Object.values(layout.records);
const readCsv = (file: string) =>
  parseCsvRecords(
    readFileSync(new URL(`../../documentation/layout/2024/${file}`, import.meta.url), 'utf8'),
  );
const csvFields = readCsv('fields.csv');
const csvCountries = readCsv('countries.csv');

/** `record:code` labels of the codes matching a predicate, sorted. */
function codeLabels(predicate: (code: RecordDef['codes'][number]) => boolean): string[] {
  return records
    .flatMap(record => record.codes)
    .filter(predicate)
    .map(code => `${code.record}:${code.code}`)
    .sort();
}

describe('layout 2024 — records and header fields', () => {
  it('has all 17 record types with 270 header fields in total', () => {
    expect(Object.keys(layout.records).sort()).toEqual([
      '1000',
      '1010',
      '1020',
      '1030',
      '2000',
      '2200',
      '3027',
      '3050',
      '3051',
      '3054',
      '3060',
      '3063',
      '3064',
      '3065',
      '3066',
      '3077',
      '9999',
    ]);
    expect(records.reduce((sum, record) => sum + record.fields.length, 0)).toBe(270);
  });

  it('keys every record by its own type, with unique canonical orders 1..17', () => {
    for (const [type, record] of Object.entries(layout.records)) {
      expect(record.type).toBe(type);
    }
    expect(records.map(record => record.order).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 17 }, (_, i) => i + 1),
    );
  });

  describe.each(records.map(record => [record.type, record] as const))('record %s', (_, record) => {
    it('has header fields sorted by position, contiguous from 137 to the header end', () => {
      expect(record.fields[0]?.position).toBe(PREFIX_LENGTH + 1);
      let next = PREFIX_LENGTH + 1;
      for (const field of record.fields) {
        expect(field.record).toBe(record.type);
        expect(field.position).toBe(next);
        expect(field.length).toBeGreaterThan(0);
        next = field.position + field.length;
      }
      expect(next - 1).toBe(PREFIX_LENGTH + record.headerLength);
    });

    it('adds up prefix, header and section to the record length', () => {
      expect(PREFIX_LENGTH + record.headerLength + (record.section?.length ?? 0)).toBe(
        record.length,
      );
      if (record.section) {
        expect(record.section.start).toBe(PREFIX_LENGTH + record.headerLength + 1);
      }
    });

    it('has unique keys (fillers aside)', () => {
      const keys = record.fields.filter(field => field.kind !== 'filler').map(field => field.key);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('uses only known field kinds and no "(derived) " key prefix', () => {
      const kinds: readonly string[] = FIELD_KINDS;
      for (const field of record.fields) {
        expect(kinds).toContain(field.kind satisfies FieldKind);
        expect(field.key.startsWith(DERIVED_PREFIX)).toBe(false);
      }
    });
  });

  it('marks exactly the "(derived) " rows of fields.csv as derived', () => {
    const expected = csvFields
      .filter(row => row.key?.startsWith(DERIVED_PREFIX))
      .map(row => `${row.record}@${row.position}:${row.key?.slice(DERIVED_PREFIX.length)}`)
      .sort();
    const actual = records
      .flatMap(record => record.fields)
      .filter(field => field.derived)
      .map(field => `${field.record}@${field.position}:${field.key}`)
      .sort();
    expect(expected).toHaveLength(37);
    expect(actual).toEqual(expected);
  });

  it('throws for a year without a layout', () => {
    expect(() => getLayout(2023)).toThrow(/2023/);
  });
});

describe('layout 2024 — code-amount sections', () => {
  it('has 260 codes: 102 in 1000, 51 in 2000 and 107 in the capital-gains appendices', () => {
    const count = (types: readonly string[]) =>
      records
        .filter(record => types.includes(record.type))
        .reduce((sum, record) => sum + record.codes.length, 0);
    expect(count(Object.keys(layout.records))).toBe(260);
    expect(layout.records['1000'].codes).toHaveLength(102);
    expect(layout.records['2000'].codes).toHaveLength(51);
    expect(count(records.map(record => record.type).filter(type => type.startsWith('30')))).toBe(
      107,
    );
  });

  describe.each(records.map(record => [record.type, record] as const))('record %s', (_, record) => {
    it('has codes only when it has a code-amount section', () => {
      if (record.section?.kind !== 'codeAmount') {
        expect(record.codes).toEqual([]);
      } else {
        expect(record.codes.length).toBeGreaterThan(0);
      }
    });

    it('has unique 3-digit codes sorted ascending, each 1–12 wide with a known kind', () => {
      const kinds: readonly string[] = CODE_KINDS;
      const codes = record.codes.map(code => code.code);
      expect(new Set(codes).size).toBe(codes.length);
      expect(codes).toEqual([...codes].sort());
      for (const code of record.codes) {
        expect(code.record).toBe(record.type);
        expect(code.code).toMatch(/^\d{3}$/);
        expect(code.length).toBeGreaterThanOrEqual(1);
        expect(code.length).toBeLessThanOrEqual(12);
        expect(kinds).toContain(code.kind satisfies CodeKind);
      }
    });

    it('fits every code of the record into its section at once (D-10: no overflow)', () => {
      if (record.section?.kind === 'codeAmount') {
        const used = record.codes.reduce((sum, code) => sum + 3 + code.length, 0);
        expect(used).toBeLessThanOrEqual(record.section.length);
      }
    });

    it('limits the section entries: 1000 → 61, 2200 → 10, otherwise its number of codes', () => {
      if (record.section) {
        const expected =
          record.type === '1000' ? 61 : record.type === '2200' ? 10 : record.codes.length;
        expect(record.section.maxEntries).toBe(expected);
      }
    });
  });

  it('flags exactly 23 codes of 2000 for a per-country breakdown, and no other code', () => {
    const flagged = codeLabels(code => code.perCountryBreakdown);
    expect(flagged).toHaveLength(23);
    expect(flagged.every(label => label.startsWith('2000:'))).toBe(true);
  });

  it('allows zero exactly for the codes listed in SPEC §4.5', () => {
    expect(codeLabels(code => code.zeroAllowed)).toEqual(
      [
        ...['032', '072', '080', '081', '084', '086', '094', '096', '097', '121', '159'].map(
          code => `1000:${code}`,
        ),
        '2000:442',
        '3054:016',
      ].sort(),
    );
  });

  it('marks exactly the derived codes of SPEC §7.4', () => {
    expect(codeLabels(code => code.derived)).toEqual(
      [
        ...['008', '028', '273', '277', '278', '280', '297'].map(code => `1000:${code}`),
        ...['501', '502', '503', '504', '505'].map(code => `3077:${code}`),
      ].sort(),
    );
  });
});

describe('layout 2024 — countries and limits', () => {
  it('has 255 unique countries keyed by 3-digit code, plus "-88"', () => {
    expect(csvCountries).toHaveLength(255);
    expect(layout.countries.size).toBe(255);
    expect(new Set(csvCountries.map(row => countryKey(row.code ?? ''))).size).toBe(255);
    for (const row of csvCountries) {
      expect(layout.countries.get(countryKey(row.code ?? ''))).toBe(row.nameHe);
    }
    for (const key of layout.countries.keys()) {
      expect(key === '-88' || /^\d{3}$/.test(key)).toBe(true);
    }
    expect(layout.countries.has('-88')).toBe(true);
  });

  it('pads country codes to 3 digits and keeps "-88"', () => {
    expect(countryKey('4')).toBe('004');
    expect(countryKey('40')).toBe('040');
    expect(countryKey('376')).toBe('376');
    expect(countryKey('-88')).toBe('-88');
  });

  it('exposes the per-file and per-record limits', () => {
    expect(layout.limits).toEqual({
      reportsPerFile: 50,
      capitalGainsAppendices: 14,
      mainCodePairs: 61,
      countriesPerRecord: 10,
    });
  });
});
