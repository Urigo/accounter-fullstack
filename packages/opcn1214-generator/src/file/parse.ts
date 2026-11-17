/**
 * Parser (SPEC §8.2 steps 2–7): the lines of a file to the internal NormalizedReport, with the same
 * record codec as generation. Structural problems (encoding, line shape, order, control record,
 * undecodable content) are collected for every line and thrown together as Opcn1214ParseError.
 */
import { decodeRecord } from '../codec/record.js';
import { COUNTRY_ENTRY_LENGTH } from '../codec/sections.js';
import { CodecDecodeError, type CodecDecodeReason } from '../codec/types.js';
import { Opcn1214InternalError, Opcn1214ParseError, unsupportedTaxYearIssue } from '../errors.js';
import { getLayout, supportedTaxYears } from '../layout/registry.js';
import type { FieldDef, RecordDef, RecordType, YearLayout } from '../layout/types.js';
import type { NormalizedRecord, NormalizedReport } from '../model/normalized.js';
import {
  BREAKDOWN_CODE_KEY,
  codeKey,
  countryEntryKey,
  incomeEntryKey,
  inputIndexOf,
  pathFor,
} from '../normalize/paths.js';
import { isRecordType, makeIssue, recordRank, type Issue } from '../validate/issue.js';
import type { RuleId } from '../validate/rules.js';
import { controlValues } from './control.js';
import type { FileLine } from './split.js';

/** 0-based [start, end) offsets of the line prefix (SPEC §3.2) and of the 1000 tax year. */
const FORM_TYPE = { start: 0, end: 4, value: '1214' } as const;
const RECORD_TYPE = { start: 4, end: 8 } as const;
const RESERVED = { start: 8, end: 136 } as const;
const TAX_YEAR = { start: 145, end: 149 } as const;
const YEAR = /^\d{4}$/;
const NOT_ZERO = /[^0]/;

/** Where an issue was found: 1-based line and column, plus the record when it is known. */
interface Location {
  line: number;
  column: number;
  recordType?: RecordType;
  recordIndex?: number;
}

function parseIssue(
  ruleId: RuleId,
  message: string,
  { line, column, ...record }: Location,
  details: Omit<Issue, 'ruleId' | 'severity' | 'message' | 'path' | 'line' | 'column'> & {
    path?: string;
  } = {},
): Issue {
  return makeIssue(ruleId, {
    message: `Line ${line}, column ${column}: ${message}`,
    path: '',
    ...record,
    ...details,
    line,
    column,
  });
}

/** 0-based offset of the first character of `text` (from `start`) that differs from `expected`. */
function firstDifference(text: string, start: number, expected: string): number {
  for (let offset = 0; offset < expected.length; offset++) {
    if (text[start + offset] !== expected[offset]) {
      return start + offset;
    }
  }
  return -1;
}

function recordTypeText(line: FileLine): string {
  return line.text.slice(RECORD_TYPE.start, RECORD_TYPE.end);
}

/**
 * The layout selected by the tax year of the first 1000 record (SPEC §8.2 step 2), or undefined
 * (with an issue) when there is no 1000 record or its tax year is not a supported year.
 */
function selectLayout(lines: readonly FileLine[], issues: Issue[]): YearLayout | undefined {
  const index = lines.findIndex(line => recordTypeText(line) === '1000');
  const main = lines[index];
  if (main === undefined || main.invalidAt !== undefined) {
    return undefined;
  }
  const at: Location = {
    line: index + 1,
    column: TAX_YEAR.start + 1,
    recordType: '1000',
    recordIndex: 0,
  };
  const year = main.text.slice(TAX_YEAR.start, TAX_YEAR.end);
  if (main.text.length < TAX_YEAR.end) {
    issues.push(
      parseIssue(
        'parse.lineLength',
        `Record 1000 is too short (${main.text.length} characters) to hold the tax year.`,
        { ...at, column: main.text.length + 1 },
      ),
    );
    return undefined;
  }
  if (!YEAR.test(year)) {
    issues.push(
      parseIssue('parse.numeric', `Tax year "${year}" is not a number.`, at, {
        path: 'taxYear',
        value: year,
      }),
    );
    return undefined;
  }
  const taxYear = Number(year);
  if (!supportedTaxYears().includes(taxYear)) {
    const issue = unsupportedTaxYearIssue(taxYear, supportedTaxYears());
    issues.push({ ...issue, recordType: '1000', recordIndex: 0, line: at.line, column: at.column });
    return undefined;
  }
  return getLayout(taxYear);
}

/**
 * The line checks that do not decode fields (SPEC §8.2 step 2): form type, record type, the
 * 128-zero prefix and, with a layout, the exact length. Returns the record type when it is known
 * and whether the line can be decoded.
 */
function checkLine(
  line: FileLine,
  lineNumber: number,
  layout: YearLayout | undefined,
  issues: Issue[],
): { type?: RecordType; decodable: boolean } {
  const typeText = recordTypeText(line);
  const type = isRecordType(typeText) ? typeText : undefined;
  if (line.invalidAt !== undefined) {
    issues.push(
      parseIssue(
        'parse.encoding',
        'Bytes that do not decode in the selected encoding.',
        { line: lineNumber, column: line.invalidAt + 1 },
        type ? { recordType: type } : {},
      ),
    );
    return { type, decodable: false };
  }
  const { text } = line;
  let decodable = layout !== undefined;
  const at = (column: number): Location => ({
    line: lineNumber,
    column,
    ...(type ? { recordType: type } : {}),
  });
  const formOffset = firstDifference(text, FORM_TYPE.start, FORM_TYPE.value);
  if (formOffset !== -1) {
    issues.push(
      parseIssue(
        'parse.formType',
        `Form type "${text.slice(FORM_TYPE.start, FORM_TYPE.end)}" is not ${FORM_TYPE.value}.`,
        at(formOffset + 1),
      ),
    );
    decodable = false;
  }
  if (!type) {
    issues.push(
      parseIssue(
        'parse.recordType',
        `Unknown record type "${typeText}".`,
        at(RECORD_TYPE.start + 1),
      ),
    );
    return { decodable: false };
  }
  const reservedOffset = text.slice(RESERVED.start, RESERVED.end).search(NOT_ZERO);
  if (reservedOffset !== -1) {
    issues.push(
      parseIssue(
        'parse.prefixFiller',
        'Positions 9–136 must all be 0.',
        at(RESERVED.start + reservedOffset + 1),
      ),
    );
    decodable = false;
  }
  const length = layout?.records[type].length;
  if (length !== undefined && text.length !== length) {
    issues.push(
      parseIssue(
        'parse.lineLength',
        `Record ${type} must have ${length} characters, not ${text.length}.`,
        at(Math.min(text.length, length) + 1),
      ),
    );
    decodable = false;
  }
  return { type, decodable };
}

/**
 * Rule of a CodecDecodeError: by reason (a 'section' error by the section kind of the record of
 * type `type`), and for 'format' by where in the line it was raised.
 */
function decodeRule(type: RecordType, reason: CodecDecodeReason, offset: number): RuleId {
  switch (reason) {
    case 'numeric':
      return 'parse.numeric';
    case 'date':
      return 'parse.date';
    case 'section':
      return type === '2200' ? 'parse.countrySection' : 'parse.codeSection';
    case 'length':
      return 'parse.lineLength';
    case 'format':
      if (offset < RECORD_TYPE.start) {
        return 'parse.formType';
      }
      if (offset < RECORD_TYPE.end) {
        return 'parse.recordType';
      }
      return offset < RESERVED.end ? 'parse.prefixFiller' : 'parse.fieldValue';
  }
}

function fieldAt(def: RecordDef, offset: number): FieldDef | undefined {
  return def.fields.find(
    field => offset >= field.position - 1 && offset < field.position - 1 + field.length,
  );
}

/** 0-based offsets of 2200@137, the 2000 code of a breakdown; its input key (SPEC §7.3). */
const BREAKDOWN_CODE = { start: 136, end: 139 } as const;
const CODE_DIGITS = /^\d{3}$/;

/**
 * The pathFor `inputIndex` of the record of type `def.type` on `line`, before it is decoded: its
 * index, or for a 2200 record the code at 2200@137 (undefined when that is not 3 digits).
 */
function lineInputIndex(def: RecordDef, line: string, recordIndex: number): number | undefined {
  if (def.type !== '2200') {
    return recordIndex;
  }
  const code = line.slice(BREAKDOWN_CODE.start, BREAKDOWN_CODE.end);
  return CODE_DIGITS.test(code) ? Number(code) : undefined;
}

/** The parse issue of undecodable content of a record (offset within the line). */
function decodeIssue(
  def: RecordDef,
  line: string,
  error: CodecDecodeError,
  at: Location & { recordIndex: number },
): Issue {
  const field = fieldAt(def, error.offset);
  const location = { ...at, column: error.offset + 1 };
  const ruleId = decodeRule(def.type, error.reason, error.offset);
  const inputIndex = lineInputIndex(def, line, at.recordIndex);
  if (!field) {
    return parseIssue(ruleId, error.message, location);
  }
  const start = field.position - 1;
  return parseIssue(ruleId, error.message, location, {
    path: inputIndex === undefined ? '' : pathFor(def.type, inputIndex, field.key),
    field: { position: field.position, length: field.length, nameHe: field.nameHe },
    value: line.slice(start, start + field.length),
  });
}

/**
 * `record` with the input path of every value, code and country entry (emission index = input
 * index; a 2200 record is keyed by its code).
 */
function withPaths(record: NormalizedRecord): NormalizedRecord {
  const keys = [
    ...Object.keys(record.values),
    ...[...record.codes.keys()].map(codeKey),
    ...record.countries.flatMap((_, index) => [countryEntryKey(index), incomeEntryKey(index)]),
  ];
  const paths: Record<string, string> = {};
  for (const key of keys) {
    paths[key] = pathFor(record.recordType, inputIndexOf(record), key);
  }
  return { ...record, paths };
}

/**
 * The structural issues of a decoded 2200 `record` on line `lineNumber` (SPEC §3.6): more country
 * entries than one record holds (parse.countrySection, at the first extra entry), and a code
 * (2200@137) that is not a per-country code of record 2000, or that an earlier 2200 record of the
 * report already has (parse.fieldValue). `seenCodes` holds the codes of the earlier records; the
 * record's code is added to it.
 */
function breakdownIssues(
  layout: YearLayout,
  record: NormalizedRecord,
  lineNumber: number,
  seenCodes: Set<string>,
): Issue[] {
  const def = layout.records['2200'];
  const field = def.fields.find(candidate => candidate.key === BREAKDOWN_CODE_KEY);
  if (!field || !def.section) {
    throw new Opcn1214InternalError('Record 2200 has no code field or no section');
  }
  const at = { line: lineNumber, recordType: def.type, recordIndex: record.index };
  const issues: Issue[] = [];
  const max = layout.limits.countriesPerRecord;
  if (record.countries.length > max) {
    issues.push(
      parseIssue(
        'parse.countrySection',
        `Record 2200 has ${record.countries.length} country entries; at most ${max} are allowed.`,
        { ...at, column: def.section.start + max * COUNTRY_ENTRY_LENGTH },
        { value: record.countries.length },
      ),
    );
  }
  const code = String(inputIndexOf(record)).padStart(field.length, '0');
  const isPerCountry = layout.records['2000'].codes.some(
    def2000 => def2000.perCountryBreakdown && def2000.code === code,
  );
  let problem: string | undefined;
  if (!isPerCountry) {
    problem = `${code} is not a per-country breakdown code of record 2000.`;
  } else if (seenCodes.has(code)) {
    problem = `A second 2200 record for code ${code}.`;
  }
  seenCodes.add(code);
  if (problem) {
    issues.push(
      parseIssue(
        'parse.fieldValue',
        problem,
        { ...at, column: field.position },
        {
          field: { position: field.position, length: field.length, nameHe: field.nameHe },
          value: code,
        },
      ),
    );
  }
  return issues;
}

/**
 * The record-order issue of a record of `type` (SPEC §3.3), given the types of the records before
 * it. Records after a 9999 are out of order until batches are split there (H1).
 */
function orderProblem(type: RecordType, before: readonly RecordType[]): string | undefined {
  const previous = before.at(-1);
  if (previous === undefined) {
    return type === '1000' ? undefined : 'The file does not start with a 1000 record.';
  }
  if (type === '1000' && before.includes('1000')) {
    return 'A second 1000 record before a 9999 record.';
  }
  const latest = Math.max(...before.map(recordRank));
  if (recordRank(type) < latest) {
    return `Record ${type} comes after a record that must follow it (SPEC §3.3 order).`;
  }
  if (type === '2200' && !before.includes('2000')) {
    return 'A 2200 record without a 2000 record before it: a country breakdown belongs to the foreign appendix.';
  }
  return undefined;
}

/** parse.control.counts issues of the 9999 record against the record types present. */
function controlIssues(
  layout: YearLayout,
  control: NormalizedRecord,
  lineNumber: number,
  present: readonly RecordType[],
): Issue[] {
  const expected = controlValues(layout, present);
  const issues: Issue[] = [];
  for (const field of layout.records['9999'].fields) {
    const actual = control.values[field.key] ?? 0;
    const wanted = expected[field.key] ?? 0;
    if (actual !== wanted) {
      issues.push(
        parseIssue(
          'parse.control.counts',
          `Control field ${field.key} is ${String(actual)}; the file has ${wanted}.`,
          { line: lineNumber, column: field.position, recordType: '9999', recordIndex: 0 },
          {
            field: { position: field.position, length: field.length, nameHe: field.nameHe },
            value: actual,
            expected: String(wanted),
          },
        ),
      );
    }
  }
  return issues;
}

function byLine(a: Issue, b: Issue): number {
  return (
    (a.line ?? 0) - (b.line ?? 0) ||
    (a.column ?? 0) - (b.column ?? 0) ||
    (a.ruleId < b.ruleId ? -1 : Number(a.ruleId > b.ruleId))
  );
}

/**
 * The NormalizedReport of a single-report file given as its lines: the layout comes from the tax
 * year of the first 1000 record; each line is checked (SPEC §8.2 steps 2–3), decoded with the
 * layout of its record type and indexed among the records of that type; 9999 is checked against
 * the records present (step 6) but not kept. Throws Opcn1214ParseError with every structural
 * problem of the file (an unsupported tax year included, as struct.taxYear.unsupported), sorted
 * by line and column.
 */
export function parseLines(lines: readonly FileLine[]): NormalizedReport {
  if (lines.length === 0) {
    throw new Opcn1214ParseError([
      parseIssue('parse.empty', 'The file has no records.', { line: 1, column: 1 }),
    ]);
  }
  const issues: Issue[] = [];
  const layout = selectLayout(lines, issues);
  const counts = new Map<RecordType, number>();
  const types: RecordType[] = [];
  const records: NormalizedRecord[] = [];
  let control: { record: NormalizedRecord; line: number } | undefined;
  const breakdownCodes = new Set<string>();
  for (const [offset, line] of lines.entries()) {
    const lineNumber = offset + 1;
    const { type, decodable } = checkLine(line, lineNumber, layout, issues);
    if (!type) {
      continue;
    }
    const recordIndex = counts.get(type) ?? 0;
    counts.set(type, recordIndex + 1);
    const at = { line: lineNumber, column: RECORD_TYPE.start + 1, recordType: type, recordIndex };
    const order = orderProblem(type, types);
    if (order) {
      issues.push(parseIssue('parse.order', order, at));
    }
    types.push(type);
    if (!layout || !decodable) {
      continue;
    }
    const def = layout.records[type];
    try {
      const record = decodeRecord(def, line.text, recordIndex);
      if (type === '9999') {
        control ||= { record, line: lineNumber };
      } else {
        if (type === '2200') {
          issues.push(...breakdownIssues(layout, record, lineNumber, breakdownCodes));
        }
        records.push(withPaths(record));
      }
    } catch (error) {
      if (!(error instanceof CodecDecodeError)) {
        throw error;
      }
      issues.push(decodeIssue(def, line.text, error, at));
    }
  }
  if (!types.includes('9999')) {
    issues.push(
      parseIssue('parse.control.missing', 'The report is not terminated by a 9999 record.', {
        line: lines.length + 1,
        column: 1,
      }),
    );
  }
  if (layout && control) {
    const present = types.filter(type => type !== '9999');
    issues.push(...controlIssues(layout, control.record, control.line, present));
  }
  if (issues.length > 0 || !layout) {
    throw new Opcn1214ParseError(issues.sort(byLine));
  }
  return { taxYear: layout.taxYear, layout, records, notices: [], omittedZeroCodes: [] };
}
