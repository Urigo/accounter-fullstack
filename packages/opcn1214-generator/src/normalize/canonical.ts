/**
 * Canonical form (SPEC §8.4): the input as the parser reconstructs it from the generated file, so
 * that parse1214(generate1214(x).bytes).report deep-equals canonicalize(x, options).
 */
import { scaleBy100Exact } from '../codec/numeric.js';
import type { Primitive } from '../codec/types.js';
import { Opcn1214InternalError } from '../errors.js';
import { getLayout } from '../layout/registry.js';
import type { CodeKind, FieldDef, FieldKind, RecordDef } from '../layout/types.js';
import { PHONE_PREFIXES, type Report1214Input } from '../model/input.js';
import type { GenerateOptions } from '../model/options.js';
import { MAIN_INPUT_KEYS, setKey, SHAREHOLDER_INPUT_KEYS, type InputTree } from './denormalize.js';
import { hasUntransmittedAppendices } from './derive.js';
import { roundAmount } from './fields.js';
import { DEFAULT_SOFTWARE_NAME } from './main.js';
import { PRESENCE_OBJECTS, REPORTABLE_POSITION_KEYS, REPORTABLE_POSITIONS } from './paths.js';
import { normalizeText } from './text.js';
import { todayInJerusalem } from './today.js';

const TEXT_KINDS: ReadonlySet<FieldKind> = new Set(['text', 'hebrewText']);
const DIGIT_STRING_KINDS: ReadonlySet<FieldKind> = new Set(['id9', 'shareholderId', 'digits']);
const PREFIXES: ReadonlySet<string> = new Set(PHONE_PREFIXES);
const DIGITS = /^\d+$/;
const ALL_ZEROS = /^0+$/;
/** Kinds written as round(value × 100) and read back in hundredths (SPEC §4.4, §13.7). */
const SCALED_KINDS: ReadonlySet<FieldKind | CodeKind> = new Set([
  'amountX100',
  'rateX100',
  'percentX100',
  'percentLiteral',
]);

/**
 * `value` as the parser reads it back: ×100 kinds in hundredths (float residue such as
 * 1.1 + 2.2 removed; `scaled / 100` is the double the codecs decode), other amounts rounded per
 * `rounding`.
 */
function canonicalNumber(
  kind: FieldKind | CodeKind,
  value: number,
  rounding: GenerateOptions['rounding'],
): number {
  const scaled = SCALED_KINDS.has(kind) ? scaleBy100Exact(value) : undefined;
  return scaled === undefined ? roundAmount(kind, value, rounding) : scaled / 100;
}

function fieldOf(def: RecordDef, key: string): FieldDef {
  const field = def.fields.find(candidate => candidate.key === key);
  if (!field) {
    throw new Opcn1214InternalError(`Record ${def.type} has no field "${key}"`);
  }
  return field;
}

/** The value at the dotted `key` of `source`, or undefined. */
function getKey(source: unknown, key: string): unknown {
  let node = source;
  for (const segment of key.split('.')) {
    if (typeof node !== 'object' || node === null) {
      return undefined;
    }
    node = (node as InputTree)[segment];
  }
  return node;
}

/** A field that keeps 0 / an all-zero digit string when decoded (record codec, SPEC §8.4). */
function keepsZero(field: FieldDef): boolean {
  return field.required === 'yes' || field.kind === 'amountX';
}

function canonicalString(field: FieldDef, value: string): Primitive {
  let text = value;
  if (TEXT_KINDS.has(field.kind)) {
    text = normalizeText(value);
  } else if (DIGIT_STRING_KINDS.has(field.kind) && DIGITS.test(value)) {
    text = value.padStart(field.length, '0');
    if (!keepsZero(field) && ALL_ZEROS.test(text)) {
      return undefined;
    }
  } else if (field.kind === 'phonePrefix' && !PREFIXES.has(value)) {
    // The normalizer drops a prefix that is not allowed (field.phonePrefix warning).
    return undefined;
  }
  return text === '' ? undefined : text;
}

/**
 * The value of `field` as the parser reads it back: text normalized, digit strings zero-padded to
 * the field width, ×100 kinds in hundredths, other amounts rounded per `rounding`, and values written as the absent value
 * (empty strings, `false` flags, optional zeros except amountX) removed.
 */
function canonicalValue(
  field: FieldDef,
  value: unknown,
  rounding: GenerateOptions['rounding'],
): Primitive {
  switch (typeof value) {
    case 'string':
      return canonicalString(field, value);
    case 'number': {
      const rounded = canonicalNumber(field.kind, value, rounding);
      return rounded === 0 && !keepsZero(field) ? undefined : rounded;
    }
    case 'boolean':
      return field.kind === 'flag' && !value ? undefined : value;
    default:
      return undefined;
  }
}

function canonicalAmounts(
  def: RecordDef,
  amounts: Readonly<Partial<Record<string, number>>>,
  rounding: GenerateOptions['rounding'],
): Record<string, number> {
  const output: Record<string, number> = {};
  for (const { code, derived, kind, zeroAllowed } of def.codes) {
    const value = amounts[code];
    if (derived || value === undefined) {
      continue;
    }
    const rounded = canonicalNumber(kind, value, rounding);
    if (rounded !== 0 || zeroAllowed) {
      output[code] = rounded;
    }
  }
  return output;
}

/**
 * The canonical form of a valid `input` (SPEC §8.4) under the generation `options`: meta set to
 * the values written (software name default, also for a blank name; save date from `options.today`), text normalized,
 * digit strings padded to the field width, ×100 kinds in hundredths, empty optional values and non-zeroAllowed zero codes
 * removed, amounts rounded per `options.rounding`. `input` is not changed.
 */
export function canonicalize(
  input: Report1214Input,
  options: GenerateOptions = {},
): Report1214Input {
  const layout = getLayout(input.taxYear);
  const mainDef = layout.records['1000'];
  const shareholderDef = layout.records['1020'];
  const { rounding } = options;
  const today = options.today ?? (() => todayInJerusalem());
  const source: InputTree = {
    ...input,
    meta: {
      // As the normalizer: a name that normalizes to '' gets the default (SPEC §7.4).
      softwareName: normalizeText(input.meta?.softwareName ?? '') || DEFAULT_SOFTWARE_NAME,
      saveDate: input.meta?.saveDate ?? today(),
    },
  };

  const output: InputTree = {
    taxYear: input.taxYear,
    company: {},
    declarations: {},
    amounts: canonicalAmounts(mainDef, input.amounts, rounding),
    shareholders: input.shareholders.map(shareholder => {
      const tree: InputTree = {};
      for (const key of SHAREHOLDER_INPUT_KEYS) {
        setKey(tree, key, canonicalValue(fieldOf(shareholderDef, key), shareholder[key], rounding));
      }
      return tree;
    }),
  };
  for (const key of MAIN_INPUT_KEYS) {
    setKey(output, key, canonicalValue(fieldOf(mainDef, key), getKey(source, key), rounding));
  }
  for (const [object, { member }] of Object.entries(PRESENCE_OBJECTS)) {
    if (getKey(source, object) !== undefined) {
      setKey(output, object, {});
      setKey(
        output,
        member,
        canonicalValue(fieldOf(mainDef, member), getKey(source, member), rounding),
      );
    }
  }
  // Only the first five positions are written (SPEC §7.3).
  const positions = REPORTABLE_POSITION_KEYS.map((key, index) =>
    canonicalValue(
      fieldOf(mainDef, key),
      input.declarations.reportablePositions?.[index],
      rounding,
    ),
  ).filter(value => value !== undefined);
  if (positions.length > 0) {
    setKey(output, REPORTABLE_POSITIONS, positions);
  }
  // 833 = yes is read back as hasCapitalGainsAppendix (denormalize) unless untransmitted
  // appendices explain it; `false` writes no.
  if (
    input.declarations.hasCapitalGainsAppendix === true &&
    !hasUntransmittedAppendices(input.capitalGainsSummary)
  ) {
    setKey(output, 'declarations.hasCapitalGainsAppendix', true);
  }
  // The tree has the members of Report1214Input; values keep their input types.
  return output as unknown as Report1214Input;
}
