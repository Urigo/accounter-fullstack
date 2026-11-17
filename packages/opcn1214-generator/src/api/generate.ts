/** generate1214 and generate1214Batch (SPEC §6.1, §8.1): validation, then the file. */
import { Opcn1214InternalError, Opcn1214ValidationError } from '../errors.js';
import { renderReport, type RenderedReport } from '../file/assemble.js';
import { REPORTS_PER_FILE } from '../layout/registry.js';
import type { RecordType } from '../layout/types.js';
import type { Report1214Input } from '../model/input.js';
import type { NormalizedReport } from '../model/normalized.js';
import type { GenerateOptions } from '../model/options.js';
import { runPipeline } from '../pipeline.js';
import { compareIssues, makeIssue, type Issue } from '../validate/issue.js';
import { splitIssues } from './validate.js';

/** The outcome of generate1214 (SPEC §6.2). */
export interface GenerateResult {
  /** The file as a JS string (CRLF line endings). */
  text: string;
  /** windows-1255: the artifact to upload. */
  bytes: Uint8Array;
  /**
   * Suggestion: `1214_<fileNumber>_<taxYear>.txt`, with the 9-digit file number as written; for a
   * batch, `1214_batch_<n>.txt`.
   */
  fileName: string;
  /** Warnings of the report (of every report of a batch, each with its `reportIndex`). */
  warnings: Issue[];
  summary: {
    reports: number;
    /** Records per type, 9999 included (summed over the reports of a batch). */
    records: Partial<Record<RecordType, number>>;
    /** Code-amount pairs written in record 1000 (of 61); for a batch, the most of any report. */
    mainCodePairs: number;
    /** Zero values left out of the file (SPEC §4.5); `reportIndex` in a batch only. */
    omittedZeroCodes: Array<{
      record: RecordType;
      recordIndex: number;
      code: string;
      reportIndex?: number;
    }>;
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

function countRecords(
  report: NormalizedReport,
  records: Partial<Record<RecordType, number>> = {},
): Partial<Record<RecordType, number>> {
  for (const recordType of [...report.records.map(record => record.recordType), '9999' as const]) {
    records[recordType] = (records[recordType] ?? 0) + 1;
  }
  return records;
}

/** A validated report and its file content. */
interface GeneratedReport {
  report: NormalizedReport;
  rendered: RenderedReport;
  /** Code-amount pairs of record 1000. */
  mainCodePairs: number;
}

/**
 * Renders a report that has no errors. Throws Opcn1214InternalError when it has no record 1000.
 */
function generateValid(report: NormalizedReport): GeneratedReport {
  const rendered = renderReport(report);
  const main = report.records.find(record => record.recordType === '1000');
  if (!main || rendered.lines[0] === undefined) {
    throw new Opcn1214InternalError('A valid report has no record 1000');
  }
  return { report, rendered, mainCodePairs: main.codes.size };
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
  const { rendered, mainCodePairs } = generateValid(report);
  return {
    text: rendered.text,
    bytes: rendered.bytes,
    fileName: `1214_${writtenFileNumber(report, rendered.lines[0] ?? '')}_${report.taxYear}.txt`,
    warnings,
    summary: {
      reports: 1,
      records: countRecords(report),
      mainCodePairs,
      omittedZeroCodes: report.omittedZeroCodes.map(entry => ({ ...entry })),
    },
  };
}

function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const bytes = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}

/**
 * OPCN batch (SPEC §3.1, §8.1): validates each report independently, then writes the reports in
 * input order, each with its own 9999 record. Issues carry the 0-based `reportIndex` of their
 * report. Throws Opcn1214ValidationError carrying struct.batch.size for 0 or more than 50 reports,
 * or every error and warning of every report (errors first) if any report has an error.
 */
export function generate1214Batch(
  inputs: readonly Report1214Input[],
  options?: GenerateOptions,
): GenerateResult {
  if (inputs.length === 0 || inputs.length > REPORTS_PER_FILE) {
    throw new Opcn1214ValidationError([
      makeIssue('struct.batch.size', {
        message: `A batch holds 1 to ${REPORTS_PER_FILE} reports, not ${inputs.length}.`,
        path: '',
        value: inputs.length,
        expected: `1 to ${REPORTS_PER_FILE}`,
        specRef: { page: 1 },
      }),
    ]);
  }
  const validated = inputs.map((input, reportIndex) => {
    const { report, issues } = runPipeline(input, options);
    return { report, issues: issues.map(issue => ({ ...issue, reportIndex })) };
  });
  const { errors, warnings } = splitIssues(
    validated.flatMap(({ issues }) => issues).sort(compareIssues),
  );
  const reports = validated.map(({ report }) => report);
  if (errors.length > 0 || !reports.every(report => report !== undefined)) {
    throw new Opcn1214ValidationError([...errors, ...warnings]);
  }
  const generated = reports.map(generateValid);
  const records: Partial<Record<RecordType, number>> = {};
  for (const { report } of generated) {
    countRecords(report, records);
  }
  return {
    text: generated.map(({ rendered }) => rendered.text).join(''),
    bytes: concatBytes(generated.map(({ rendered }) => rendered.bytes)),
    fileName: `1214_batch_${generated.length}.txt`,
    warnings,
    summary: {
      reports: generated.length,
      records,
      mainCodePairs: Math.max(...generated.map(({ mainCodePairs }) => mainCodePairs)),
      omittedZeroCodes: generated.flatMap(({ report }, reportIndex) =>
        report.omittedZeroCodes.map(entry => ({ ...entry, reportIndex })),
      ),
    },
  };
}
