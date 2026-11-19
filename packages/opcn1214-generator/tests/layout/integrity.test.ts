import { readFileSync } from 'node:fs';
import { parseCsvRecords } from '../../scripts/layout/csv.js';
import { getLayout } from '../../src/layout/registry.js';
import { FIELD_KINDS, type FieldKind, type RecordDef } from '../../src/layout/types.js';

const PREFIX_LENGTH = 136;
const DERIVED_PREFIX = '(derived) ';

const layout = getLayout(2024);
const records: RecordDef[] = Object.values(layout.records);
const csvFields = parseCsvRecords(
  readFileSync(new URL('../../documentation/layout/2024/fields.csv', import.meta.url), 'utf8'),
);

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
