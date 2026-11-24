/**
 * Codecs of the trailing sections (SPEC §3.5, §3.6): the code-amount section of records 1000, 2000
 * and 30xx and the country-amount section of record 2200. Entries are concatenated with no
 * separators and the remainder is zero-filled (SPEC §15 A-10); codes are written in ascending
 * order (A-22). Decoding stops where the remainder is all zeros: exact, because no code is '000'
 * and every country entry starts with affiliation '1'.
 */
import { Opcn1214InternalError } from '../errors.js';
import { countryKey } from '../layout/countries.js';
import type { CodeDef } from '../layout/types.js';
import { codecFor } from './registry.js';
import { CodecDecodeError, type FieldShape, type Primitive } from './types.js';

/** Width of the code of a code-amount entry. */
export const CODE_LENGTH = 3;
const COUNTRY_LENGTH = 3;
const AFFILIATION = '1';
/** A country code as the model holds it: 1–3 digits or '-88'. */
const COUNTRY_CODE = /^(\d{1,3}|-88)$/;
const COUNTRY_KEY = /^(\d{3}|-88)$/;
const ALL_ZEROS = /^0*$/;
const INCOME_SHAPE: FieldShape = { length: 12, type: 'numeric', kind: 'amount' };
const COUNTRY_ENTRY_LENGTH = AFFILIATION.length + COUNTRY_LENGTH + INCOME_SHAPE.length;

/** One entry of a country-amount section (record 2200). */
export interface CountryEntry {
  country: string;
  income: number;
}

function codeShape(code: CodeDef): FieldShape {
  const shape: FieldShape = { length: code.length, type: 'numeric', kind: code.kind };
  return code.values ? { ...shape, values: code.values } : shape;
}

function fill(entries: string, length: number, what: string): string {
  if (entries.length > length) {
    throw new Opcn1214InternalError(
      `${what} entries take ${entries.length} characters; the section has ${length}`,
    );
  }
  return entries.padEnd(length, '0');
}

function checkSectionLength(raw: string, length: number): void {
  if (raw.length !== length) {
    throw new CodecDecodeError(
      'length',
      Math.min(raw.length, length),
      `Expected a section of ${length} characters, got ${raw.length}`,
    );
  }
}

function sectionError(offset: number, message: string): CodecDecodeError {
  return new CodecDecodeError('section', offset, `${message} at section offset ${offset}`);
}

/** Error raised for non-zero data found after the zero run that starts at `offset`. */
function gapError(raw: string, offset: number): CodecDecodeError {
  return sectionError(
    offset + raw.slice(offset).search(/[^0]/),
    'Non-zero data after an all-zero gap',
  );
}

/**
 * Decodes a value with its codec, translating a decode error to the section offset and prefixing
 * its message with `label` (the code or country entry the value belongs to), since the value
 * codec's message only gives the offset within the value.
 */
function decodeAt(raw: string, offset: number, shape: FieldShape, label: string): Primitive {
  try {
    return codecFor(shape.kind).decode(raw.slice(offset, offset + shape.length), shape);
  } catch (error) {
    if (error instanceof CodecDecodeError) {
      throw new CodecDecodeError(
        error.reason,
        offset + error.offset,
        `${label}: ${error.message}`,
        {
          cause: error,
        },
      );
    }
    throw error;
  }
}

function numberAt(raw: string, offset: number, shape: FieldShape, label: string): number {
  const value = decodeAt(raw, offset, shape, label);
  if (typeof value !== 'number') {
    throw new Opcn1214InternalError(`Codec of ${shape.kind} decoded a non-number`);
  }
  return value;
}

/**
 * Writes the code-amount section: each code of `values` (code → value in natural units) as its
 * 3-digit code plus the value encoded by the code's kind, in ascending code order, then zeros up to
 * `length`. Throws Opcn1214InternalError for a code `codes` does not list, a value its codec
 * rejects, or entries that do not fit.
 */
export function encodeCodeSection(
  values: ReadonlyMap<string, number>,
  codes: readonly CodeDef[],
  length: number,
): string {
  const byCode = new Map(codes.map(code => [code.code, code]));
  const entries = [...values.keys()].sort().map(key => {
    const code = byCode.get(key);
    if (!code) {
      throw new Opcn1214InternalError(`Code "${key}" is not a code of this record`);
    }
    return code.code + codecFor(code.kind).encode(values.get(key), codeShape(code));
  });
  return fill(entries.join(''), length, 'Code-amount');
}

/**
 * Inverse of encodeCodeSection: returns code → value in section order. Throws CodecDecodeError
 * 'section' (offset within the section) for an unknown code, a truncated entry, a duplicate code
 * or non-zero data after an all-zero gap; value errors keep their reason, with a section offset
 * and a message that names the code.
 */
export function decodeCodeSection(
  raw: string,
  codes: readonly CodeDef[],
  length: number,
): Map<string, number> {
  checkSectionLength(raw, length);
  const byCode = new Map(codes.map(code => [code.code, code]));
  const values = new Map<string, number>();
  let offset = 0;
  while (offset < length && !ALL_ZEROS.test(raw.slice(offset))) {
    if (offset + CODE_LENGTH > length) {
      throw sectionError(offset, 'Truncated code-amount entry');
    }
    const key = raw.slice(offset, offset + CODE_LENGTH);
    if (ALL_ZEROS.test(key)) {
      throw gapError(raw, offset);
    }
    const code = byCode.get(key);
    if (!code) {
      throw sectionError(offset, `Unknown code "${key}"`);
    }
    if (values.has(key)) {
      throw sectionError(offset, `Duplicate code ${key}`);
    }
    if (offset + CODE_LENGTH + code.length > length) {
      throw sectionError(offset, `Truncated entry of code ${key}`);
    }
    values.set(key, numberAt(raw, offset + CODE_LENGTH, codeShape(code), `code ${key}`));
    offset += CODE_LENGTH + code.length;
  }
  return values;
}

/**
 * Writes the country-amount section: per entry, affiliation '1', the 3-character country key
 * ('40' → '040', '-88' literally) and the 12-digit income, then zeros up to `length`. Throws
 * Opcn1214InternalError for a malformed country code, an invalid income or entries that do not
 * fit.
 */
export function encodeCountrySection(entries: readonly CountryEntry[], length: number): string {
  const text = entries.map(({ country, income }) => {
    if (!COUNTRY_CODE.test(country)) {
      throw new Opcn1214InternalError(`Cannot encode country code "${country}"`);
    }
    return (
      AFFILIATION + countryKey(country) + codecFor(INCOME_SHAPE.kind).encode(income, INCOME_SHAPE)
    );
  });
  return fill(text.join(''), length, 'Country-amount');
}

/**
 * Inverse of encodeCountrySection: returns the entries in section order, countries as their
 * 3-character keys. Throws CodecDecodeError 'section' (offset within the section) for a truncated
 * entry, an affiliation other than '1', a malformed country code or non-zero data after an all-zero
 * gap; income errors keep their reason, with a section offset and a message that names the entry
 * (1-based) and its country.
 */
export function decodeCountrySection(raw: string, length: number): CountryEntry[] {
  checkSectionLength(raw, length);
  const entries: CountryEntry[] = [];
  let offset = 0;
  while (offset < length && !ALL_ZEROS.test(raw.slice(offset))) {
    if (offset + COUNTRY_ENTRY_LENGTH > length) {
      throw sectionError(offset, 'Truncated country-amount entry');
    }
    const affiliation = raw.charAt(offset);
    if (affiliation === '0') {
      throw gapError(raw, offset);
    }
    if (affiliation !== AFFILIATION) {
      throw sectionError(offset, `Unexpected affiliation "${affiliation}"`);
    }
    const countryOffset = offset + AFFILIATION.length;
    const country = raw.slice(countryOffset, countryOffset + COUNTRY_LENGTH);
    if (!COUNTRY_KEY.test(country)) {
      throw sectionError(countryOffset, `Malformed country code "${country}"`);
    }
    const label = `country entry ${entries.length + 1} (${country})`;
    entries.push({
      country,
      income: numberAt(raw, countryOffset + COUNTRY_LENGTH, INCOME_SHAPE, label),
    });
    offset += COUNTRY_ENTRY_LENGTH;
  }
  return entries;
}
