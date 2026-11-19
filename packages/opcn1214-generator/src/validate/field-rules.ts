/**
 * Generic field rules (SPEC §9.3, §10.2): one pass over the header fields and codes of every
 * record, driven by their FieldDef/CodeDef, and over the incomes of the country entries of 2200
 * records.
 */
import { isIsoDate } from '../codec/date.js';
import { scaleBy100Exact } from '../codec/numeric.js';
import { COUNTRY_INCOME_SHAPE } from '../codec/sections.js';
import type { Primitive } from '../codec/types.js';
import type { CodeDef, EnumValue, FieldDef, FieldKind, RecordDef } from '../layout/types.js';
import type { NormalizedRecord, NormalizedReport } from '../model/normalized.js';
import { codeKey, incomeEntryKey, inputIndexOf, pathFor } from '../normalize/paths.js';
import { isAllowedTextChar } from '../normalize/text.js';
import { makeIssue, type Issue } from './issue.js';
import type { RuleId } from './rules.js';

const DIGITS = /^\d+$/;
/** First and last Hebrew letter, א and ת (SPEC §4.2 hebrewText). */
const ALEF = 0x05_d0;
const TAV = 0x05_ea;
/** Digits of a phone or fax number (SPEC §10.2 field.phoneNumber). */
const PHONE_NUMBER_LENGTH = 7;
/** The leading slot of a header key: `improvements[1]` of `improvements[1].date` (SPEC §9.3). */
const SLOT = /^[^[]*\[\d+\]/;

const TEXT_KINDS: ReadonlySet<FieldKind> = new Set(['text', 'hebrewText']);
const DIGIT_STRING_KINDS: ReadonlySet<FieldKind> = new Set(['id9', 'shareholderId', 'digits']);
// The kind sets below apply to fields and codes alike: every CodeKind is also a FieldKind.
/** Kinds whose value must be an integer (SPEC §4.4, §10.2 field.integer). */
const WHOLE_KINDS: ReadonlySet<FieldKind> = new Set(['amount', 'amountX', 'num']);
/** Kinds allowing at most 2 decimals (SPEC §4.4, §10.2 field.decimals). */
const DECIMAL_KINDS: ReadonlySet<FieldKind> = new Set([
  'amountX100',
  'percentX100',
  'percentLiteral',
  'rateX100',
]);
/** Kinds whose `values` are the exhaustive list of allowed values (SPEC §10.2, D-14). */
const ENUM_KINDS: ReadonlySet<FieldKind> = new Set(['enum', 'rateX100']);
/** Percentages, 1–100 (SPEC §10.2 field.percentRange). */
const PERCENT_KINDS: ReadonlySet<FieldKind> = new Set(['percentX100', 'percentLiteral']);
/** Kinds written as value × 100 (SPEC §4.2). */
const SCALED_KINDS: ReadonlySet<FieldKind> = new Set(['amountX100', 'rateX100', 'percentX100']);
/** Kinds written as the integer value (fractions are field.integer's concern). */
const INTEGER_KINDS: ReadonlySet<FieldKind> = new Set([
  'num',
  'year',
  'count',
  'serial',
  'const',
  'foreignCode',
  'enum',
  'amount',
  'amountX',
]);

function slotOf(key: string): string | undefined {
  return SLOT.exec(key)?.[0];
}

/** Keys of `record` with a value in the same slot as `key`, other than `key` itself. */
function slotSiblings(record: NormalizedRecord, key: string, slot: string): string[] {
  return Object.keys(record.values).filter(
    other => other !== key && record.values[other] !== undefined && slotOf(other) === slot,
  );
}

/**
 * The input path of a header key without a value. Inside a slot it is derived from the path of a
 * sibling that has one (the slot is in use, so one exists); otherwise pathFor gives it.
 */
function missingPath(record: NormalizedRecord, key: string, siblings: readonly string[]): string {
  for (const sibling of siblings) {
    const path = record.paths[sibling];
    if (path?.endsWith(sibling)) {
      return path.slice(0, path.length - sibling.length) + key;
    }
  }
  return pathFor(record.recordType, inputIndexOf(record), key);
}

/** True when `value`, written per its kind (×100, percent literal or integer), exceeds `width`. */
function tooManyDigits(kind: FieldKind, value: number, width: number): boolean {
  const magnitude = Math.abs(value);
  if (SCALED_KINDS.has(kind)) {
    return Math.round(magnitude * 100) >= 10 ** width;
  }
  if (kind === 'percentLiteral') {
    // Written as the integer, or as `whole.cc` with 3 more characters (SPEC §15 A-3).
    const scaled = Math.round(magnitude * 100);
    const fraction = scaled % 100 === 0 ? 0 : 3;
    return Math.trunc(scaled / 100) >= 10 ** (width - fraction);
  }
  return INTEGER_KINDS.has(kind) && Math.trunc(magnitude) >= 10 ** width;
}

/** The input path of a key: its `paths` entry (every key with a value has one), else pathFor. */
function pathOf(record: NormalizedRecord, key: string): string {
  return record.paths[key] ?? pathFor(record.recordType, inputIndexOf(record), key);
}

function codePoint(char: string): string {
  return `U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`;
}

/** A rule violation of a value, before it is located in a record. */
interface Finding {
  ruleId: RuleId;
  message: string;
  expected: string;
}

/** The field.enum finding of a value of `kind`, whose allowed values are `values`. */
function enumFindings(
  kind: FieldKind,
  values: readonly EnumValue[] | undefined,
  value: Primitive,
  name: string,
): Finding[] {
  if (!ENUM_KINDS.has(kind) || values?.some(allowed => allowed.value === value)) {
    return [];
  }
  const expected = `one of ${(values ?? []).map(allowed => allowed.value).join(', ')}`;
  return [{ ruleId: 'field.enum', message: `${name} must be ${expected}.`, expected }];
}

/** The findings of a number of `kind` in a field or code of `width` digits. */
function numberFindings(kind: FieldKind, value: number, width: number, name: string): Finding[] {
  const findings: Finding[] = [];
  if (value < 0) {
    findings.push({
      ruleId: 'field.negative',
      message: `${name} must not be negative.`,
      expected: 'a number ≥ 0',
    });
  }
  if (WHOLE_KINDS.has(kind) && !Number.isInteger(value)) {
    findings.push({
      ruleId: 'field.integer',
      message: `${name} must be an integer.`,
      expected: 'an integer',
    });
  }
  if (DECIMAL_KINDS.has(kind) && scaleBy100Exact(value) === undefined) {
    findings.push({
      ruleId: 'field.decimals',
      message: `${name} has more than 2 decimals.`,
      expected: 'at most 2 decimals',
    });
  }
  if (PERCENT_KINDS.has(kind) && !(value >= 1 && value <= 100)) {
    findings.push({
      ruleId: 'field.percentRange',
      message: `${name} must be a percentage between 1 and 100.`,
      expected: '1–100',
    });
  }
  if (Number.isFinite(value) && tooManyDigits(kind, value, width)) {
    findings.push({
      ruleId: 'field.length',
      message: `${name} has more than ${width} digits.`,
      expected: `at most ${width} digits`,
    });
  }
  return findings;
}

/** The findings of a digit string (id9, shareholderId, digits). */
function digitStringFindings(
  value: string,
  width: number,
  isPhoneNumber: boolean,
  name: string,
): Finding[] {
  const findings: Finding[] = [];
  const digitsOnly = DIGITS.test(value);
  if (!digitsOnly) {
    findings.push({
      ruleId: 'field.numeric',
      message: `${name} must contain digits only.`,
      expected: 'digits only',
    });
  }
  if (value.length > width) {
    findings.push({
      ruleId: 'field.length',
      message: `${name} has more than ${width} digits.`,
      expected: `at most ${width} digits`,
    });
  } else if (isPhoneNumber && digitsOnly && value.length !== PHONE_NUMBER_LENGTH) {
    // Non-digits and overlong numbers are already field.numeric / field.length.
    findings.push({
      ruleId: 'field.phoneNumber',
      message: `${name} must have exactly ${PHONE_NUMBER_LENGTH} digits.`,
      expected: `exactly ${PHONE_NUMBER_LENGTH} digits`,
    });
  }
  return findings;
}

/** The findings of a text value (text, hebrewText), already normalized (SPEC §4.3). */
function textFindings(kind: FieldKind, value: string, width: number, name: string): Finding[] {
  const findings: Finding[] = [];
  const chars = [...value];
  if (chars.length > width) {
    findings.push({
      ruleId: 'field.length',
      message: `${name} is longer than ${width} characters.`,
      expected: `at most ${width} characters`,
    });
  }
  const invalid = chars.find(char => !isAllowedTextChar(char));
  if (invalid !== undefined) {
    findings.push({
      ruleId: 'field.charset',
      message: `${name} contains ${codePoint(invalid)}, a control character or a character outside windows-1255.`,
      expected: 'windows-1255 characters without control characters',
    });
  }
  const first = value.codePointAt(0) ?? 0;
  if (kind === 'hebrewText' && (first < ALEF || first > TAV)) {
    findings.push({
      ruleId: 'field.hebrewFirstLetter',
      message: `${name} must start with a Hebrew letter (א–ת).`,
      expected: 'a first character in א–ת',
    });
  }
  return findings;
}

/** The findings of a header value; `isPhoneNumber` marks the number of a phone or fax. */
function valueFindings(
  field: FieldDef,
  value: Primitive,
  isPhoneNumber: boolean,
  name: string,
): Finding[] {
  const findings = enumFindings(field.kind, field.values, value, name);
  if (field.kind === 'date' && !isIsoDate(value)) {
    findings.push({
      ruleId: 'field.date',
      message: `${name} must be a real calendar date YYYY-MM-DD.`,
      expected: 'a real calendar date YYYY-MM-DD',
    });
  } else if (typeof value === 'string' && DIGIT_STRING_KINDS.has(field.kind)) {
    findings.push(...digitStringFindings(value, field.length, isPhoneNumber, name));
  } else if (typeof value === 'string' && TEXT_KINDS.has(field.kind)) {
    findings.push(...textFindings(field.kind, value, field.length, name));
  } else if (typeof value === 'number') {
    findings.push(...numberFindings(field.kind, value, field.length, name));
  }
  return findings;
}

/**
 * Keys of the phone and fax numbers of `def`: the digit fields that directly follow a phone-prefix
 * field (1000@496/506/825).
 */
function phoneNumberKeys(def: RecordDef): ReadonlySet<string> {
  return new Set(
    def.fields
      .filter((field, i) => field.kind === 'digits' && def.fields[i - 1]?.kind === 'phonePrefix')
      .map(field => field.key),
  );
}

function checkField(record: NormalizedRecord, field: FieldDef, isPhoneNumber: boolean): Issue[] {
  const value = record.values[field.key];
  const name = `Field ${field.key} (${record.recordType}@${field.position})`;
  const located = (ruleId: RuleId, message: string, path: string, expected?: string): Issue =>
    makeIssue(ruleId, {
      message,
      path,
      recordType: record.recordType,
      recordIndex: record.index,
      field: { position: field.position, length: field.length, nameHe: field.nameHe },
      ...(value === undefined ? {} : { value }),
      ...(expected === undefined ? {} : { expected }),
      specRef: { page: field.specPage },
    });

  if (value === undefined) {
    if (field.required !== 'yes') {
      return [];
    }
    const slot = slotOf(field.key);
    const siblings = slot === undefined ? [] : slotSiblings(record, field.key, slot);
    if (slot !== undefined && siblings.length === 0) {
      return [];
    }
    const path = missingPath(record, field.key, siblings);
    return [located('field.required', `${name} is required.`, path)];
  }

  const findings = valueFindings(field, value, isPhoneNumber, name);
  if (findings.length === 0) {
    return [];
  }
  const path = pathOf(record, field.key);
  return findings.map(finding => located(finding.ruleId, finding.message, path, finding.expected));
}

function checkCode(record: NormalizedRecord, def: CodeDef): Issue[] {
  const value = record.codes.get(def.code);
  const key = codeKey(def.code);
  const issue = (ruleId: RuleId, message: string, expected?: string): Issue =>
    makeIssue(ruleId, {
      message,
      path: pathOf(record, key),
      recordType: record.recordType,
      recordIndex: record.index,
      code: def.code,
      ...(value === undefined ? {} : { value }),
      ...(expected === undefined ? {} : { expected }),
      specRef: { page: def.specPage },
    });
  const name = `Code ${def.code} of record ${record.recordType}`;

  if (value === undefined || (value === 0 && !def.zeroAllowed)) {
    if (def.required !== 'yes') {
      return [];
    }
    return [
      issue(
        'field.required',
        `${name} is required${def.zeroAllowed ? '' : ' (0 counts as absent)'}.`,
      ),
    ];
  }
  return [
    ...enumFindings(def.kind, def.values, value, name),
    ...numberFindings(def.kind, value, def.length, name),
  ].map(finding => issue(finding.ruleId, finding.message, finding.expected));
}

/**
 * The issues of the income of every country entry of a 2200 record (SPEC §3.6): an amount of
 * COUNTRY_INCOME_SHAPE, checked like a code value (field.negative, field.integer, field.length).
 */
function checkCountryIncomes(record: NormalizedRecord): Issue[] {
  return record.countries.flatMap(({ income }, index) => {
    const name = `The income of country entry ${index + 1} of record ${record.recordType}`;
    const key = incomeEntryKey(index);
    return numberFindings(COUNTRY_INCOME_SHAPE.kind, income, COUNTRY_INCOME_SHAPE.length, name).map(
      finding =>
        makeIssue(finding.ruleId, {
          message: finding.message,
          path: pathOf(record, key),
          recordType: record.recordType,
          recordIndex: record.index,
          value: income,
          expected: finding.expected,
          specRef: { page: 31 },
        }),
    );
  });
}

/** Issues of the generic field rules over every record of `report` (unsorted). */
export function fieldRules(report: NormalizedReport): Issue[] {
  return report.records.flatMap(record => {
    const def = report.layout.records[record.recordType];
    const phoneNumbers = phoneNumberKeys(def);
    return [
      ...def.fields
        .filter(field => field.kind !== 'filler')
        .flatMap(field => checkField(record, field, phoneNumbers.has(field.key))),
      ...def.codes.flatMap(code => checkCode(record, code)),
      ...checkCountryIncomes(record),
    ];
  });
}
