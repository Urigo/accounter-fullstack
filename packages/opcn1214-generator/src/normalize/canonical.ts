/**
 * Canonical form (SPEC §8.4): the input as the parser reconstructs it from the generated file, so
 * that parse1214(generate1214(x).bytes).report deep-equals canonicalize(x, options).
 */
import type { Primitive } from '../codec/types.js';
import { Opcn1214InternalError } from '../errors.js';
import { getLayout } from '../layout/registry.js';
import type { FieldDef, FieldKind, RecordDef } from '../layout/types.js';
import { PHONE_PREFIXES, type Report1214Input } from '../model/input.js';
import type { GenerateOptions } from '../model/options.js';
import { MAIN_INPUT_KEYS, setKey, SHAREHOLDER_INPUT_KEYS, type InputTree } from './denormalize.js';
import { roundAmount } from './fields.js';
import { DEFAULT_SOFTWARE_NAME } from './main.js';
import { normalizeText } from './text.js';
import { todayInJerusalem } from './today.js';

const TEXT_KINDS: ReadonlySet<FieldKind> = new Set(['text', 'hebrewText']);
const DIGIT_STRING_KINDS: ReadonlySet<FieldKind> = new Set(['id9', 'shareholderId', 'digits']);
const PREFIXES: ReadonlySet<string> = new Set(PHONE_PREFIXES);
const DIGITS = /^\d+$/;
const ALL_ZEROS = /^0+$/;

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
 * the field width, amounts rounded per `rounding`, and values written as the absent value
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
      const rounded = roundAmount(field.kind, value, rounding);
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
    const rounded = roundAmount(kind, value, rounding);
    if (rounded !== 0 || zeroAllowed) {
      output[code] = rounded;
    }
  }
  return output;
}

/**
 * The canonical form of a valid `input` (SPEC §8.4) under the generation `options`: meta set to
 * the values written (software name default, save date from `options.today`), text normalized,
 * digit strings padded to the field width, empty optional values and non-zeroAllowed zero codes
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
      softwareName: input.meta?.softwareName ?? DEFAULT_SOFTWARE_NAME,
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
  // The tree has the members of Report1214Input; values keep their input types.
  return output as unknown as Report1214Input;
}
