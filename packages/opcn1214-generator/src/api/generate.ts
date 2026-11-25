/** generate1214 (SPEC §6.1, §8.1): validation, then the file. */
import { Opcn1214InternalError, Opcn1214ValidationError } from '../errors.js';
import { renderReport } from '../file/assemble.js';
import type { RecordType } from '../layout/types.js';
import type { Report1214Input } from '../model/input.js';
import type { NormalizedReport } from '../model/normalized.js';
import type { GenerateOptions } from '../model/options.js';
import { runPipeline } from '../pipeline.js';
import type { Issue } from '../validate/issue.js';
import { splitIssues } from './validate.js';

/** The outcome of generate1214 (SPEC §6.2). */
export interface GenerateResult {
  /** The file as a JS string (CRLF line endings). */
  text: string;
  /** windows-1255: the artifact to upload. */
  bytes: Uint8Array;
  /** Suggestion: `1214_<fileNumber>_<taxYear>.txt`, with the 9-digit file number as written. */
  fileName: string;
  warnings: Issue[];
  summary: {
    reports: number;
    /** Records per type, 9999 included. */
    records: Partial<Record<RecordType, number>>;
    /** Code-amount pairs written in record 1000 (of 61). */
    mainCodePairs: number;
    /** Zero values left out of the file (SPEC §4.5). */
    omittedZeroCodes: Array<{ record: RecordType; recordIndex: number; code: string }>;
  };
}

const FILE_NUMBER_KEY = 'company.fileNumber';

/** The file number exactly as `mainLine` (the encoded 1000 record) holds it. */
function writtenFileNumber(report: NormalizedReport, mainLine: string): string {
  const field = report.layout.records['1000'].fields.find(def => def.key === FILE_NUMBER_KEY);
  if (!field) {
    throw new Opcn1214InternalError(`Record 1000 has no ${FILE_NUMBER_KEY} field`);
  }
  return mainLine.slice(field.position - 1, field.position - 1 + field.length);
}

function countRecords(report: NormalizedReport): Partial<Record<RecordType, number>> {
  const records: Partial<Record<RecordType, number>> = {};
  for (const { recordType } of report.records) {
    records[recordType] = (records[recordType] ?? 0) + 1;
  }
  records['9999'] = 1;
  return records;
}

/**
 * Validates, then generates. Throws Opcn1214ValidationError carrying every error and warning
 * (errors first) if any error-severity issue exists.
 */
export function generate1214(input: Report1214Input, options?: GenerateOptions): GenerateResult {
  const { report, issues } = runPipeline(input, options);
  const { errors, warnings } = splitIssues(issues);
  if (errors.length > 0 || !report) {
    throw new Opcn1214ValidationError([...errors, ...warnings]);
  }
  const { lines, text, bytes } = renderReport(report);
  const main = report.records.find(record => record.recordType === '1000');
  if (!main || lines[0] === undefined) {
    throw new Opcn1214InternalError('A valid report has no record 1000');
  }
  return {
    text,
    bytes,
    fileName: `1214_${writtenFileNumber(report, lines[0])}_${report.taxYear}.txt`,
    warnings,
    summary: {
      reports: 1,
      records: countRecords(report),
      mainCodePairs: main.codes.size,
      omittedZeroCodes: report.omittedZeroCodes.map(entry => ({ ...entry })),
    },
  };
}
