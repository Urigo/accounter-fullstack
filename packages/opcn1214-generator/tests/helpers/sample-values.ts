/**
 * Sample model values for the record codec tests: a valid, width-fitting, non-zero value for every
 * field and code kind, so any record of any layout can be encoded and decoded.
 */
import type { Primitive } from '../../src/codec/types.js';
import type { CodeDef, FieldDef, FieldKind, RecordDef } from '../../src/layout/types.js';
import type { NormalizedRecord } from '../../src/model/normalized.js';

const DIGITS = '123456789012';
/** Starts with a Hebrew letter (alef, bet, gimel). */
const HEBREW = '\u05d0\u05d1\u05d2';

/** A non-zero digit string of exactly `width` digits (width ≤ 12). */
function digitsOf(width: number): string {
  return DIGITS.slice(0, width);
}

function firstAllowed(def: FieldDef | CodeDef): number {
  const first = def.values?.[0];
  if (!first) {
    throw new Error(`${def.record}: no allowed values for a ${def.kind}`);
  }
  return first.value;
}

const FIELD_SAMPLES: { [K in Exclude<FieldKind, 'filler'>]: (field: FieldDef) => Primitive } = {
  text: field => `t${field.position}`,
  hebrewText: () => HEBREW,
  id9: () => '012345674',
  shareholderId: () => '123456782',
  digits: field => digitsOf(field.length),
  year: () => 2024,
  num: () => 7,
  count: () => 3,
  serial: () => 1,
  const: firstAllowed,
  foreignCode: () => 10,
  amount: field => Number(digitsOf(Math.min(field.length, 9))),
  amountX: () => 4321,
  amountX100: () => 1234.56,
  rateX100: firstAllowed,
  percentX100: () => 10.23,
  percentLiteral: () => 5.5,
  date: () => '2024-12-31',
  flag: () => true,
  yesNo: () => true,
  enum: firstAllowed,
  phonePrefix: () => '052',
};

/** The sample value of a header field; undefined for fillers (never stored). */
export function sampleFieldValue(field: FieldDef): Primitive {
  return field.kind === 'filler' ? undefined : FIELD_SAMPLES[field.kind](field);
}

/** The sample value of a code-amount code, in natural units. */
export function sampleCodeValue(code: CodeDef): number {
  switch (code.kind) {
    case 'amount':
    case 'num':
      return Number(digitsOf(Math.min(code.length, 9)));
    case 'amountX100':
      return 1234.56;
    case 'rateX100':
    case 'enum':
      return firstAllowed(code);
  }
}

/** Codes of the sample: the first code of every kind the record has, then more up to three. */
function sampleCodes(def: RecordDef): Map<string, number> {
  const picked: CodeDef[] = [];
  for (const code of def.codes) {
    if (!picked.some(other => other.kind === code.kind)) {
      picked.push(code);
    }
  }
  for (const code of def.codes) {
    if (picked.length >= 3) {
      break;
    }
    if (!picked.includes(code)) {
      picked.push(code);
    }
  }
  return new Map(picked.map(code => [code.code, sampleCodeValue(code)]));
}

/**
 * A record with a sample value for every non-filler field; for code-amount records the codes of
 * sampleCodes, for 2200 two countries (country keys as the decoder returns them).
 */
export function sampleRecord(def: RecordDef): NormalizedRecord {
  const values: Record<string, Primitive> = {};
  for (const field of def.fields) {
    if (field.kind !== 'filler') {
      values[field.key] = sampleFieldValue(field);
    }
  }
  return {
    recordType: def.type,
    index: 0,
    values,
    codes: def.section?.kind === 'codeAmount' ? sampleCodes(def) : new Map(),
    countries:
      def.section?.kind === 'countryAmount'
        ? [
            { country: '040', income: 1234 },
            { country: '-88', income: 567_890 },
          ]
        : [],
    paths: {},
  };
}
