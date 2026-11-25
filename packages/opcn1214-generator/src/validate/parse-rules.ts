/**
 * Parse-only rules (SPEC §10.7) shared by the parser: the parse issue of a file location, and
 * parse.derivedMismatch, which derives every derived value (SPEC §7.4) again from its source in the
 * parsed file, with the normalizer itself, and compares it with the value the file holds.
 */
import type { Primitive } from '../codec/types.js';
import { Opcn1214InternalError } from '../errors.js';
import type { FieldDef, RecordDef, RecordType } from '../layout/types.js';
import type { NormalizedRecord, NormalizedReport } from '../model/normalized.js';
import { denormalize } from '../normalize/denormalize.js';
import { codeKey } from '../normalize/paths.js';
import { normalizeReport } from '../normalize/report.js';
import { makeIssue, type Issue } from './issue.js';
import type { RuleId } from './rules.js';

/** Where an issue was found: 1-based line and column, plus the record when it is known. */
export interface Location {
  line: number;
  column: number;
  recordType?: RecordType;
  recordIndex?: number;
}

/** A parse issue of `ruleId` at `location`; the message is prefixed with the line and column. */
export function parseIssue(
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

/** A decoded record of a file with its 1-based line number and its text. */
export interface LocatedRecord {
  record: NormalizedRecord;
  line: number;
  text: string;
}

/**
 * Header key of 1000@833: derived (SPEC §7.4), but also an input property, so the denormalizer
 * reads 833 = yes back as `hasCapitalGainsAppendix` when nothing else explains it. Only 833 = no
 * while capital-gains records or untransmitted appendices exist can disagree.
 */
const HAS_CAPITAL_GAINS_APPENDIX = 'declarations.hasCapitalGainsAppendix';

/** Length of the code of a code-amount entry. */
const CODE_LENGTH = 3;
const NOT_ZERO = /[^0]/;

/**
 * The 1-based column of the entry of `code` in the code-amount section of `text`, a line that
 * decoded as a record of `def`; the section start when the line has no entry for `code`.
 */
function codeColumn(def: RecordDef, text: string, code: string): number {
  const section = def.section;
  if (!section) {
    throw new Opcn1214InternalError(`Record ${def.type} has no section`);
  }
  const end = section.start - 1 + section.length;
  let offset = section.start - 1;
  while (offset + CODE_LENGTH <= end && NOT_ZERO.test(text.slice(offset, end))) {
    const entry = text.slice(offset, offset + CODE_LENGTH);
    if (entry === code) {
      return offset + 1;
    }
    const width = def.codes.find(candidate => candidate.code === entry)?.length;
    if (width === undefined) {
      break;
    }
    offset += CODE_LENGTH + width;
  }
  return section.start;
}

function show(value: Primitive): string {
  return value === undefined ? 'absent' : String(value);
}

/** The header fields of a record whose value is derived (SPEC §7.4), 9999 aside. */
function derivedFields(def: RecordDef): FieldDef[] {
  return def.fields.filter(field => field.derived || field.key === HAS_CAPITAL_GAINS_APPENDIX);
}

/**
 * The parse.derivedMismatch issues of `located` (the decoded records of one report, 9999 excluded,
 * in file order) for `report`, the report they make: the report is denormalized to its input and
 * normalized again, so every derived value is derived by the generator's own derivations from its
 * source in the file; each one that differs from the file is an issue at its field or code (path
 * per NormalizedRecord.paths, '' for derived values without an input path). A required header value
 * the file leaves empty is not compared (field.required reports it). Records of one type are
 * matched by their index among the records of that type.
 */
export function derivedMismatches(
  report: NormalizedReport,
  located: readonly LocatedRecord[],
): Issue[] {
  // No clock access: the save date is not derived, so any value does.
  const derived = normalizeReport(denormalize(report), report.layout, { today: () => '' });
  const issues: Issue[] = [];
  for (const { record, line, text } of located) {
    const def = report.layout.records[record.recordType];
    const fields = derivedFields(def);
    const codes = def.codes.filter(code => code.derived).map(code => code.code);
    if (fields.length === 0 && codes.length === 0) {
      continue;
    }
    const expected = derived.records.filter(
      candidate => candidate.recordType === record.recordType,
    )[record.index];
    if (!expected) {
      throw new Opcn1214InternalError(
        `No derived record ${record.recordType} #${record.index} for a parsed record`,
      );
    }
    const at = { line, recordType: record.recordType, recordIndex: record.index };
    for (const field of fields) {
      const actual = record.values[field.key];
      const wanted = expected.values[field.key];
      if (actual === wanted || (actual === undefined && field.required === 'yes')) {
        continue;
      }
      issues.push(
        parseIssue(
          'parse.derivedMismatch',
          `${field.key} (${def.type}@${field.position}) is ${show(actual)}; derived from the file it is ${show(wanted)}.`,
          { ...at, column: field.position },
          {
            path: record.paths[field.key] ?? '',
            field: { position: field.position, length: field.length, nameHe: field.nameHe },
            ...(actual === undefined ? {} : { value: actual }),
            expected: show(wanted),
          },
        ),
      );
    }
    for (const code of codes) {
      const actual = record.codes.get(code);
      const wanted = expected.codes.get(code);
      if (actual === wanted) {
        continue;
      }
      issues.push(
        parseIssue(
          'parse.derivedMismatch',
          `Code ${code} of record ${def.type} is ${show(actual)}; derived from the file it is ${show(wanted)}.`,
          { ...at, column: codeColumn(def, text, code) },
          {
            path: record.paths[codeKey(code)] ?? '',
            code,
            ...(actual === undefined ? {} : { value: actual }),
            expected: show(wanted),
          },
        ),
      );
    }
  }
  return issues;
}
