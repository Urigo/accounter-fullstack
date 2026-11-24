/**
 * Generic field rules (SPEC §9.3, §10.2): one pass over the header fields and codes of every
 * record, driven by their FieldDef/CodeDef.
 */
import type { Primitive } from '../codec/types.js';
import type { CodeDef, FieldDef, FieldKind } from '../layout/types.js';
import type { NormalizedRecord, NormalizedReport } from '../model/normalized.js';
import { codeKey, pathFor } from '../normalize/paths.js';
import { isAllowedTextChar } from '../normalize/text.js';
import { makeIssue, type Issue } from './issue.js';
import type { RuleId } from './rules.js';

const DIGITS = /^\d+$/;
/** The leading slot of a header key: `improvements[1]` of `improvements[1].date` (SPEC §9.3). */
const SLOT = /^[^[]*\[\d+\]/;

const TEXT_KINDS: ReadonlySet<FieldKind> = new Set(['text', 'hebrewText']);
const DIGIT_STRING_KINDS: ReadonlySet<FieldKind> = new Set(['id9', 'shareholderId', 'digits']);
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
  return pathFor(record.recordType, record.index, key);
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
  return record.paths[key] ?? pathFor(record.recordType, record.index, key);
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

/** The field.numeric / field.length / field.charset findings of a header value. */
function valueFindings(field: FieldDef, value: Primitive, name: string): Finding[] {
  const width = field.length;
  const tooLong: Finding = {
    ruleId: 'field.length',
    message: `${name} has more than ${width} digits.`,
    expected: `at most ${width} digits`,
  };
  const findings: Finding[] = [];
  if (typeof value === 'string' && DIGIT_STRING_KINDS.has(field.kind)) {
    if (!DIGITS.test(value)) {
      findings.push({
        ruleId: 'field.numeric',
        message: `${name} must contain digits only.`,
        expected: 'digits only',
      });
    }
    if (value.length > width) {
      findings.push(tooLong);
    }
  } else if (typeof value === 'string' && TEXT_KINDS.has(field.kind)) {
    const chars = [...value];
    if (chars.length > width) {
      findings.push({
        ruleId: 'field.length',
        message: `${name} is longer than ${width} characters.`,
        expected: `at most ${width} characters`,
      });
    }
    const invalid = chars.findIndex(char => !isAllowedTextChar(char));
    if (invalid !== -1) {
      findings.push({
        ruleId: 'field.charset',
        message: `${name} contains ${codePoint(chars[invalid] ?? '')} at character ${invalid + 1}, a control character or a character outside windows-1255.`,
        expected: 'windows-1255 characters without control characters',
      });
    }
  } else if (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    tooManyDigits(field.kind, value, width)
  ) {
    findings.push(tooLong);
  }
  return findings;
}

function checkField(record: NormalizedRecord, field: FieldDef): Issue[] {
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

  const findings = valueFindings(field, value, name);
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
  if (Number.isFinite(value) && tooManyDigits(def.kind, value, def.length)) {
    return [
      issue(
        'field.length',
        `${name} has more than ${def.length} digits.`,
        `at most ${def.length} digits`,
      ),
    ];
  }
  return [];
}

/** Issues of the generic field rules over every record of `report` (unsorted). */
export function fieldRules(report: NormalizedReport): Issue[] {
  return report.records.flatMap(record => {
    const def = report.layout.records[record.recordType];
    return [
      ...def.fields.filter(field => field.kind !== 'filler').flatMap(f => checkField(record, f)),
      ...def.codes.flatMap(code => checkCode(record, code)),
    ];
  });
}
