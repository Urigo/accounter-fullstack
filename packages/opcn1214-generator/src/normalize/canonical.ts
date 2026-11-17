/**
 * Canonical form (SPEC §8.4): the input as the parser reconstructs it from the generated file, so
 * that parse1214(generate1214(x).bytes).report deep-equals canonicalize(x, options).
 */
import { COUNTRY_INCOME_SHAPE } from '../codec/sections.js';
import type { Primitive } from '../codec/types.js';
import { Opcn1214InternalError } from '../errors.js';
import { capitalGainsRecordType } from '../layout/capital-gains.js';
import { countryKey } from '../layout/countries.js';
import { getLayout } from '../layout/registry.js';
import type { FieldDef, FieldKind, RecordDef, YearLayout } from '../layout/types.js';
import {
  PHONE_PREFIXES,
  type CapitalGainsAppendix,
  type CountryBreakdown,
  type Report1214Input,
} from '../model/input.js';
import type { GenerateOptions } from '../model/options.js';
import {
  CAPITAL_GAINS_INPUT_KEYS,
  hasWithholders,
  placeCapitalGains,
} from './capital-gains/index.js';
import { readWithholders, withholderKey } from './capital-gains/securities.js';
import {
  COUNTRY_BREAKDOWN_INPUT_KEYS,
  FOREIGN_APPENDIX_INPUT_KEYS,
  MAIN_INPUT_KEYS,
  RD_INVESTMENT_INPUT_KEYS,
  RELATED_COMPANY_INPUT_KEYS,
  setKey,
  SHAREHOLDER_INPUT_KEYS,
  type InputTree,
} from './denormalize.js';
import { BANK_ACCOUNT_DIGITS, hasUntransmittedAppendices } from './derive.js';
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

/**
 * The breakdowns of `breakdowns` as the parser reads their 2200 records back: deductions like any
 * header amount, countries as their layout keys ('40' → '040'), incomes rounded (an income of 0
 * is kept); an empty map is removed. Undefined entries are left out.
 */
function canonicalBreakdowns(
  def: RecordDef,
  breakdowns: Readonly<Partial<Record<string, CountryBreakdown>>> | undefined,
  rounding: GenerateOptions['rounding'],
): InputTree | undefined {
  const output: InputTree = {};
  for (const [code, breakdown] of Object.entries(breakdowns ?? {})) {
    if (!breakdown) {
      continue;
    }
    const tree: InputTree = {};
    for (const key of COUNTRY_BREAKDOWN_INPUT_KEYS) {
      setKey(tree, key, canonicalValue(fieldOf(def, key), breakdown[key], rounding));
    }
    tree.countries = breakdown.countries.map(({ country, income }) => ({
      country: countryKey(country),
      income: roundAmount(COUNTRY_INCOME_SHAPE.kind, income, rounding),
    }));
    output[code] = tree;
  }
  return Object.keys(output).length > 0 ? output : undefined;
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
 * The capital-gains appendices as the parser reads their 30xx records back: in emission order
 * (grouped by symbol ascending, input order within a symbol, SPEC §3.3), header members like any
 * header value, withholders slot by slot (readWithholders: each member like a header value,
 * trailing empty slots and an empty list removed), amounts like the 1000 amounts.
 */
function canonicalCapitalGains(
  layout: YearLayout,
  appendices: readonly CapitalGainsAppendix[],
  rounding: GenerateOptions['rounding'],
): InputTree[] {
  return placeCapitalGains(appendices).map(({ appendix }) => {
    const def = layout.records[capitalGainsRecordType(appendix.symbol)];
    const tree: InputTree = { symbol: appendix.symbol };
    for (const key of CAPITAL_GAINS_INPUT_KEYS[appendix.symbol]) {
      setKey(tree, key, canonicalValue(fieldOf(def, key), getKey(appendix, key), rounding));
    }
    const given = 'withholders' in appendix ? (appendix.withholders ?? []) : [];
    const withholders = hasWithholders(appendix.symbol)
      ? readWithholders((slot, member) =>
          canonicalValue(
            fieldOf(def, withholderKey(slot, member)),
            given[slot]?.[member],
            rounding,
          ),
        )
      : undefined;
    if (withholders) {
      tree.withholders = withholders;
    }
    tree.amounts = canonicalAmounts(def, appendix.amounts, rounding);
    return tree;
  });
}

/**
 * The canonical form of a valid `input` (SPEC §8.4) under the generation `options`: meta set to
 * the values written (software name default, save date from `options.today`), text normalized,
 * digit strings padded to the field width (the bank account number to 9 digits), empty optional
 * values, empty `relatedCompanies` and `rdInvestments` lists, an empty `countryBreakdown` and
 * non-zeroAllowed zero codes (of `amounts`, `foreignAppendix.amounts` and the capital-gains
 * amounts) removed, country codes zero-padded, capital-gains appendices in emission order and an
 * empty `capitalGains` list removed, withholders as their slots are read back (trailing empty ones
 * removed), amounts rounded per `options.rounding`. `input` is not changed.
 */
export function canonicalize(
  input: Report1214Input,
  options: GenerateOptions = {},
): Report1214Input {
  const layout = getLayout(input.taxYear);
  const mainDef = layout.records['1000'];
  const relatedDef = layout.records['1010'];
  const shareholderDef = layout.records['1020'];
  const rdDef = layout.records['1030'];
  const foreignDef = layout.records['2000'];
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
  // No 1010 record is written for an empty list, so the parser reads none back.
  if (input.relatedCompanies && input.relatedCompanies.length > 0) {
    output.relatedCompanies = input.relatedCompanies.map(company => {
      const tree: InputTree = {};
      for (const key of RELATED_COMPANY_INPUT_KEYS) {
        setKey(tree, key, canonicalValue(fieldOf(relatedDef, key), company[key], rounding));
      }
      return tree;
    });
  }
  // Likewise for 1030 records.
  if (input.rdInvestments && input.rdInvestments.length > 0) {
    output.rdInvestments = input.rdInvestments.map(investment => {
      const tree: InputTree = {};
      for (const key of RD_INVESTMENT_INPUT_KEYS) {
        setKey(tree, key, canonicalValue(fieldOf(rdDef, key), investment[key], rounding));
      }
      return tree;
    });
  }
  // The 2000 record: header members as written, amounts like the 1000 amounts.
  if (input.foreignAppendix) {
    const appendix = input.foreignAppendix;
    const tree: InputTree = {};
    for (const key of FOREIGN_APPENDIX_INPUT_KEYS) {
      setKey(tree, key, canonicalValue(fieldOf(foreignDef, key), appendix[key], rounding));
    }
    tree.amounts = canonicalAmounts(foreignDef, appendix.amounts, rounding);
    setKey(
      tree,
      'countryBreakdown',
      canonicalBreakdowns(layout.records['2200'], appendix.countryBreakdown, rounding),
    );
    output.foreignAppendix = tree;
  }
  // No 30xx record is written for an empty list either.
  const appendices = input.capitalGains ?? [];
  if (appendices.length > 0) {
    output.capitalGains = canonicalCapitalGains(layout, appendices, rounding);
  }
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
  // appendices or capital-gains appendices explain it; `false` writes no.
  if (
    input.declarations.hasCapitalGainsAppendix === true &&
    !hasUntransmittedAppendices(input.capitalGainsSummary) &&
    appendices.length === 0
  ) {
    setKey(output, 'declarations.hasCapitalGainsAppendix', true);
  }
  // Read back from 277/278/280 (denormalize): the account as 277 holds it, padded to 9 digits.
  if (input.bankAccount) {
    const { bank, branch, account } = input.bankAccount;
    setKey(output, 'bankAccount', {
      bank,
      branch,
      account: account.padStart(BANK_ACCOUNT_DIGITS, '0'),
    });
  }
  // The tree has the members of Report1214Input; values keep their input types.
  return output as unknown as Report1214Input;
}
