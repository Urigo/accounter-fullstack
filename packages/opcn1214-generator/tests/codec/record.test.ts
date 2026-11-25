import { decodeRecord, encodeRecord } from '../../src/codec/record.js';
import { codecFor } from '../../src/codec/registry.js';
import { encodeCodeSection, encodeCountrySection } from '../../src/codec/sections.js';
import { CodecDecodeError, type FieldShape, type Primitive } from '../../src/codec/types.js';
import { Opcn1214InternalError } from '../../src/errors.js';
import { getLayout } from '../../src/layout/registry.js';
import type { FieldDef, FieldKind, RecordDef, RecordType } from '../../src/layout/types.js';
import { sampleRecord } from '../helpers/sample-values.js';

const LAYOUT = getLayout(2024);
const RECORDS = Object.values(LAYOUT.records);
const PREFIX_ZEROS = '0'.repeat(128);

const NUMERIC_VALUED_KINDS: readonly FieldKind[] = [
  'num',
  'year',
  'count',
  'serial',
  'const',
  'foreignCode',
  'enum',
  'amount',
  'amountX',
  'amountX100',
  'rateX100',
  'percentX100',
  'percentLiteral',
];
const DIGIT_STRING_KINDS: readonly FieldKind[] = ['id9', 'shareholderId', 'digits'];

function record(type: RecordType): RecordDef {
  return LAYOUT.records[type];
}

function shapeOf(field: FieldDef): FieldShape {
  const shape: FieldShape = { length: field.length, type: field.type, kind: field.kind };
  return field.values ? { ...shape, values: field.values } : shape;
}

function slice(line: string, position: number, length: number): string {
  return line.slice(position - 1, position - 1 + length);
}

function field(def: RecordDef, key: string): FieldDef {
  const found = def.fields.find(candidate => candidate.key === key);
  if (!found) {
    throw new Error(`no field ${key} in ${def.type}`);
  }
  return found;
}

/** Replaces the text at a 1-based position. */
function overwrite(line: string, position: number, text: string): string {
  return line.slice(0, position - 1) + text + line.slice(position - 1 + text.length);
}

/** The zero value of a field as written in the file (numeric zeros or an alnum-padded '0'). */
function zeroText(field: FieldDef): string {
  return field.type === 'numeric' ? '0'.repeat(field.length) : '0'.padStart(field.length, ' ');
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

function isZeroable(field: FieldDef): boolean {
  return NUMERIC_VALUED_KINDS.includes(field.kind) || DIGIT_STRING_KINDS.includes(field.kind);
}

describe('encodeRecord / decodeRecord on every record type of 2024', () => {
  it('covers all 17 record types', () => {
    expect(RECORDS).toHaveLength(17);
  });

  describe.each(RECORDS.map(def => [def.type, def] as const))('record %s', (_type, def) => {
    const sample = sampleRecord(def);
    const line = encodeRecord(def, sample);

    it('has the record length and the 136-character prefix', () => {
      expect(line).toHaveLength(def.length);
      expect(line.slice(0, 136)).toBe(`1214${def.type}${PREFIX_ZEROS}`);
    });

    it('writes every header field with its codec at its position', () => {
      for (const fieldDef of def.fields) {
        const value: Primitive =
          fieldDef.kind === 'filler' ? undefined : sample.values[fieldDef.key];
        expect(slice(line, fieldDef.position, fieldDef.length), fieldDef.key).toBe(
          codecFor(fieldDef.kind).encode(value, shapeOf(fieldDef)),
        );
      }
    });

    it('writes the section after the header', () => {
      if (!def.section) {
        expect(line).toHaveLength(136 + def.headerLength);
        return;
      }
      expect(def.section.start).toBe(137 + def.headerLength);
      const section = slice(line, def.section.start, def.section.length);
      expect(section).toBe(
        def.section.kind === 'codeAmount'
          ? encodeCodeSection(sample.codes, def.codes, def.section.length)
          : encodeCountrySection(sample.countries, def.section.length),
      );
    });

    it('decodes back to the sample', () => {
      expect(decodeRecord(def, line, 0)).toEqual(sample);
    });
  });

  it('samples cover every code kind of each code-amount record', () => {
    for (const def of RECORDS) {
      const kinds = new Set(def.codes.map(code => code.kind));
      const sampled = new Set(
        [...sampleRecord(def).codes.keys()].map(
          code => def.codes.find(candidate => candidate.code === code)?.kind,
        ),
      );
      expect(sampled, def.type).toEqual(kinds);
    }
  });

  it('decodes the record index it is given', () => {
    const def = record('1020');
    const decoded = decodeRecord(def, encodeRecord(def, sampleRecord(def)), 4);
    expect(decoded.index).toBe(4);
    expect(decoded.paths).toEqual({});
  });
});

describe('encodeRecord internal errors', () => {
  it('throws when the produced length differs from the record length', () => {
    const def = record('1030');
    const corrupted: RecordDef = { ...def, length: def.length + 1 };
    expect(() => encodeRecord(corrupted, sampleRecord(def))).toThrow(Opcn1214InternalError);
  });

  it('throws when the fields leave a gap in the header', () => {
    const def = record('9999');
    const corrupted: RecordDef = { ...def, fields: def.fields.slice(1) };
    expect(() => encodeRecord(corrupted, sampleRecord(def))).toThrow(Opcn1214InternalError);
  });

  it('throws for a model record of another type', () => {
    expect(() => encodeRecord(record('1010'), sampleRecord(record('1030')))).toThrow(
      Opcn1214InternalError,
    );
  });

  it('throws for codes or countries on a record without that section', () => {
    const def = record('1030');
    expect(() => encodeRecord(def, { ...sampleRecord(def), codes: new Map([['010', 1]]) })).toThrow(
      Opcn1214InternalError,
    );
    expect(() =>
      encodeRecord(def, { ...sampleRecord(def), countries: [{ country: '040', income: 1 }] }),
    ).toThrow(Opcn1214InternalError);
  });

  it('throws for a value its field codec rejects', () => {
    const def = record('1030');
    const sample = sampleRecord(def);
    const target = def.fields.find(candidate => candidate.kind === 'amount');
    expect(target).toBeDefined();
    if (!target) return;
    expect(() =>
      encodeRecord(def, { ...sample, values: { ...sample.values, [target.key]: -1 } }),
    ).toThrow(Opcn1214InternalError);
  });
});

describe('decodeRecord structural errors', () => {
  const def = record('1030');
  const line = encodeRecord(def, sampleRecord(def));

  it.each([
    ['short', line.slice(0, -1), def.length - 1],
    ['long', `${line}0`, def.length],
    ['empty', '', 0],
  ])('rejects a %s line with reason length', (_name, raw, offset) => {
    const error = decodeError(() => decodeRecord(def, raw, 0));
    expect(error.reason).toBe('length');
    expect(error.offset).toBe(offset);
  });

  it.each([
    ['form type', 3, '5'],
    ['record type', 6, '1'],
    ['reserved zeros (position 9)', 9, '1'],
    ['reserved zeros (position 136)', 136, ' '],
  ])('rejects a prefix mismatch in the %s with reason format', (_name, position, char) => {
    const error = decodeError(() => decodeRecord(def, overwrite(line, position, char), 0));
    expect(error.reason).toBe('format');
    expect(error.offset).toBe(position - 1);
  });

  it('reports a field decode error at its line offset', () => {
    const target = def.fields.find(candidate => candidate.kind === 'amount');
    expect(target).toBeDefined();
    if (!target) return;
    const bad = overwrite(line, target.position + 2, 'x');
    const error = decodeError(() => decodeRecord(def, bad, 0));
    expect(error.reason).toBe('numeric');
    expect(error.offset).toBe(target.position + 1);
  });

  it('reports a section decode error at its line offset', () => {
    const def1000 = record('1000');
    const section = def1000.section;
    expect(section).toBeDefined();
    if (!section) return;
    const sample = { ...sampleRecord(def1000), codes: new Map<string, number>() };
    const bad = overwrite(encodeRecord(def1000, sample), section.start, '999');
    const error = decodeError(() => decodeRecord(def1000, bad, 0));
    expect(error.reason).toBe('section');
    expect(error.offset).toBe(section.start - 1);
  });

  it('ignores the content of header fillers', () => {
    const filler = def.fields.find(candidate => candidate.kind === 'filler');
    expect(filler).toBeDefined();
    if (!filler) return;
    const bad = overwrite(line, filler.position, 'x'.repeat(filler.length));
    expect(decodeRecord(def, bad, 0)).toEqual(sampleRecord(def));
  });
});

describe('absent values on decode', () => {
  it('decodes optional fields encoded as absent to undefined', () => {
    for (const def of RECORDS) {
      const sample = sampleRecord(def);
      const values = { ...sample.values };
      for (const fieldDef of def.fields) {
        if (fieldDef.required !== 'yes' && fieldDef.kind !== 'filler') {
          values[fieldDef.key] = undefined;
        }
      }
      const decoded = decodeRecord(def, encodeRecord(def, { ...sample, values }), 0);
      for (const fieldDef of def.fields) {
        if (fieldDef.required !== 'yes' && fieldDef.kind !== 'filler') {
          expect(decoded.values[fieldDef.key], `${def.type} ${fieldDef.key}`).toBeUndefined();
        }
      }
      // Absent values are left out of `values` (toEqual cannot tell a key holding undefined).
      const kept = def.fields.filter(
        fieldDef => fieldDef.required === 'yes' && fieldDef.kind !== 'filler',
      );
      expect(Object.keys(decoded.values), def.type).toEqual(kept.map(fieldDef => fieldDef.key));
    }
  });

  it('maps zero to undefined for optional numeric and digit-string fields, except amountX', () => {
    let checked = 0;
    for (const def of RECORDS) {
      let line = encodeRecord(def, sampleRecord(def));
      const targets = def.fields.filter(
        fieldDef => fieldDef.required !== 'yes' && isZeroable(fieldDef),
      );
      for (const target of targets) {
        line = overwrite(line, target.position, zeroText(target));
      }
      const decoded = decodeRecord(def, line, 0);
      for (const target of targets) {
        const expected = target.kind === 'amountX' ? 0 : undefined;
        expect(decoded.values[target.key], `${def.type} ${target.key}`).toBe(expected);
        checked++;
      }
    }
    expect(checked).toBe(87);
  });

  it('keeps 0 in required fields (9999 counts)', () => {
    const def = record('9999');
    const sample = sampleRecord(def);
    const values = Object.fromEntries(Object.keys(sample.values).map(key => [key, 0]));
    const decoded = decodeRecord(def, encodeRecord(def, { ...sample, values }), 0);
    const required = def.fields.filter(fieldDef => fieldDef.required === 'yes');
    expect(required.length).toBeGreaterThan(0);
    for (const fieldDef of def.fields) {
      expect(decoded.values[fieldDef.key], fieldDef.key).toBe(
        fieldDef.required === 'yes' ? 0 : undefined,
      );
    }
  });

  it('keeps an all-zero digit string and zero numbers in every required field', () => {
    for (const def of RECORDS) {
      let line = encodeRecord(def, sampleRecord(def));
      const targets = def.fields.filter(
        fieldDef => fieldDef.required === 'yes' && isZeroable(fieldDef),
      );
      for (const target of targets) {
        line = overwrite(line, target.position, zeroText(target));
      }
      const decoded = decodeRecord(def, line, 0);
      for (const target of targets) {
        const expected = DIGIT_STRING_KINDS.includes(target.kind) ? '0'.repeat(target.length) : 0;
        expect(decoded.values[target.key], `${def.type} ${target.key}`).toBe(expected);
      }
    }
  });

  it('keeps the amountX 0 of record 1000 through encode and decode', () => {
    const def = record('1000');
    const target = def.fields.find(candidate => candidate.kind === 'amountX');
    expect(target?.required).not.toBe('yes');
    if (!target) return;
    const sample = sampleRecord(def);
    const line = encodeRecord(def, { ...sample, values: { ...sample.values, [target.key]: 0 } });
    expect(slice(line, target.position, target.length)).toBe('           0');
    expect(decodeRecord(def, line, 0).values[target.key]).toBe(0);
  });
});
