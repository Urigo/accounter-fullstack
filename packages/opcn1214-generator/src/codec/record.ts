/**
 * Record codec (SPEC §3.2, §3.4): turns a NormalizedRecord into one line of the file and back,
 * walking the layout of its RecordDef. Every record is the 136-character prefix ('1214', the record
 * type, 128 zeros), the header fields in position order, then the code-amount or country-amount
 * section, if any.
 */
import { Opcn1214InternalError } from '../errors.js';
import type { FieldDef, FieldKind, RecordDef } from '../layout/types.js';
import type { NormalizedRecord } from '../model/normalized.js';
import { codecFor } from './registry.js';
import {
  decodeCodeSection,
  decodeCountrySection,
  encodeCodeSection,
  encodeCountrySection,
} from './sections.js';
import { CodecDecodeError, type FieldShape, type Primitive } from './types.js';

const FORM_TYPE = '1214';
const RESERVED = '0'.repeat(128);
/** Kinds decoded as digit strings: all zeros is their absent value in optional fields. */
const DIGIT_STRING_KINDS: ReadonlySet<FieldKind> = new Set(['id9', 'shareholderId', 'digits']);
const ALL_ZEROS = /^0+$/;

function prefix(def: RecordDef): string {
  return FORM_TYPE + def.type + RESERVED;
}

function shapeOf(field: FieldDef): FieldShape {
  const shape: FieldShape = { length: field.length, type: field.type, kind: field.kind };
  return field.values ? { ...shape, values: field.values } : shape;
}

function where(def: RecordDef, field: FieldDef): string {
  return `record ${def.type}, field ${field.key} (position ${field.position})`;
}

function internal(message: string, cause?: unknown): Opcn1214InternalError {
  return new Opcn1214InternalError(message, cause === undefined ? undefined : { cause });
}

function encodeField(def: RecordDef, field: FieldDef, value: Primitive): string {
  try {
    return codecFor(field.kind).encode(field.kind === 'filler' ? undefined : value, shapeOf(field));
  } catch (error) {
    if (error instanceof Opcn1214InternalError) {
      throw internal(`${where(def, field)}: ${error.message}`, error);
    }
    throw error;
  }
}

function encodeSection(def: RecordDef, record: NormalizedRecord): string {
  const section = def.section;
  if (section?.kind !== 'codeAmount' && record.codes.size > 0) {
    throw internal(`Record ${def.type} has no code-amount section but codes were given`);
  }
  if (section?.kind !== 'countryAmount' && record.countries.length > 0) {
    throw internal(`Record ${def.type} has no country-amount section but countries were given`);
  }
  if (!section) {
    return '';
  }
  try {
    return section.kind === 'codeAmount'
      ? encodeCodeSection(record.codes, def.codes, section.length)
      : encodeCountrySection(record.countries, section.length);
  } catch (error) {
    if (error instanceof Opcn1214InternalError) {
      throw internal(`Record ${def.type}, section: ${error.message}`, error);
    }
    throw error;
  }
}

/**
 * Encodes one record as a line (no line terminator) of exactly `def.length` characters. Fillers
 * are written as zeros or spaces; derived fields are encoded like any other field. Throws
 * Opcn1214InternalError for a record of another type, a value its codec rejects, codes or
 * countries on a record without that section, or a layout that does not produce `def.length`
 * characters.
 */
export function encodeRecord(def: RecordDef, record: NormalizedRecord): string {
  if (record.recordType !== def.type) {
    throw internal(`Cannot encode a ${record.recordType} record with the layout of ${def.type}`);
  }
  let line = prefix(def);
  for (const field of def.fields) {
    if (field.position !== line.length + 1) {
      throw internal(`${where(def, field)} does not follow position ${line.length}`);
    }
    line += encodeField(def, field, record.values[field.key]);
  }
  line += encodeSection(def, record);
  if (line.length !== def.length) {
    throw internal(`Record ${def.type} encoded to ${line.length} characters, not ${def.length}`);
  }
  return line;
}

/** Runs `decode`, translating a CodecDecodeError offset by `start` (0-based line offset). */
function atLineOffset<T>(start: number, context: string, decode: () => T): T {
  try {
    return decode();
  } catch (error) {
    if (error instanceof CodecDecodeError) {
      throw new CodecDecodeError(
        error.reason,
        start + error.offset,
        `${context}: ${error.message}`,
        {
          cause: error,
        },
      );
    }
    throw error;
  }
}

/**
 * The absent value of a decoded field (SPEC §8.4): in a field that is not required, 0 and an
 * all-zero digit string mean "absent" (amountX excepted, where 0 is meaningful). Required fields
 * keep 0 so their rules can report it.
 */
function absentToUndefined(field: FieldDef, value: Primitive): Primitive {
  if (field.required === 'yes' || field.kind === 'amountX') {
    return value;
  }
  if (value === 0) {
    return undefined;
  }
  if (typeof value === 'string' && DIGIT_STRING_KINDS.has(field.kind) && ALL_ZEROS.test(value)) {
    return undefined;
  }
  return value;
}

function checkLine(def: RecordDef, line: string): void {
  if (line.length !== def.length) {
    throw new CodecDecodeError(
      'length',
      Math.min(line.length, def.length),
      `Expected ${def.length} characters for record ${def.type}, got ${line.length}`,
    );
  }
  const expected = prefix(def);
  for (let offset = 0; offset < expected.length; offset++) {
    if (line[offset] !== expected[offset]) {
      throw new CodecDecodeError(
        'format',
        offset,
        `Unexpected "${line[offset]}" at column ${offset + 1} of the record ${def.type} prefix`,
      );
    }
  }
}

/**
 * Inverse of encodeRecord for the record at `index` (0-based among records of its type). Header
 * fillers are ignored; absent values are omitted from `values`; `paths` is left empty (the parser
 * fills it). Throws CodecDecodeError with a 0-based line offset: 'length' for a wrong length,
 * 'format' for a prefix other than '1214', the record type and 128 zeros, and the field's or
 * section's own reason for undecodable content.
 */
export function decodeRecord(def: RecordDef, line: string, index: number): NormalizedRecord {
  checkLine(def, line);
  const values: Record<string, Primitive> = {};
  for (const field of def.fields) {
    if (field.kind === 'filler') {
      continue;
    }
    const start = field.position - 1;
    const raw = line.slice(start, start + field.length);
    const decoded = atLineOffset(start, where(def, field), () =>
      codecFor(field.kind).decode(raw, shapeOf(field)),
    );
    const value = absentToUndefined(field, decoded);
    if (value !== undefined) {
      values[field.key] = value;
    }
  }
  const record: NormalizedRecord = {
    recordType: def.type,
    index,
    values,
    codes: new Map(),
    countries: [],
    paths: {},
  };
  const section = def.section;
  if (section) {
    const start = section.start - 1;
    const raw = line.slice(start, start + section.length);
    const context = `record ${def.type}, section`;
    if (section.kind === 'codeAmount') {
      record.codes = atLineOffset(start, context, () =>
        decodeCodeSection(raw, def.codes, section.length),
      );
    } else {
      record.countries = atLineOffset(start, context, () =>
        decodeCountrySection(raw, section.length),
      );
    }
  }
  return record;
}
