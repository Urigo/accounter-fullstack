/** parse1214 and parse1214Batch (SPEC §6.1, §8.2): files back to the public input. */
import { parseBatchLines, parseLines } from '../file/parse.js';
import { splitFile } from '../file/split.js';
import type { IsoDate, Report1214Input } from '../model/input.js';
import type { NormalizedReport } from '../model/normalized.js';
import type { ParseOptions } from '../model/options.js';
import { denormalize } from '../normalize/denormalize.js';
import { runRules } from '../validate/engine.js';
import type { Issue } from '../validate/issue.js';

/** The outcome of parse1214 (SPEC §6.2). */
export interface ParseResult {
  /** Canonical form (SPEC §8.4). */
  report: Report1214Input;
  /** Validation of the parsed content (errors and warnings), sorted (SPEC §9.1). */
  issues: Issue[];
  /** From 1000@165; '' when the file has none (field.required is then in `issues`). */
  saveDate: IsoDate;
  /** From 1000@150; '' when the file has none (field.required is then in `issues`). */
  softwareName: string;
}

/** The ParseResult of a parsed report; its issues carry `reportIndex` when one is given. */
function parseResult(normalized: NormalizedReport, reportIndex?: number): ParseResult {
  const report = denormalize(normalized);
  const issues = runRules(normalized);
  return {
    report,
    issues: reportIndex === undefined ? issues : issues.map(issue => ({ ...issue, reportIndex })),
    saveDate: report.meta?.saveDate ?? '',
    softwareName: report.meta?.softwareName ?? '',
  };
}

/**
 * Parses a single-report file. Business-rule issues of the parsed content are returned as
 * `issues`, not thrown. Structural problems (SPEC §8.2 steps 1–6, an unsupported tax year
 * included) throw Opcn1214ParseError carrying every problem of the file; so does a file with more
 * than one report (parse.multipleReports).
 */
export function parse1214(content: string | Uint8Array, options?: ParseOptions): ParseResult {
  return parseResult(parseLines(splitFile(content, options)));
}

/**
 * Parses an OPCN batch file (1–50 reports, SPEC §3.1): one ParseResult per report, in file order,
 * each with the issues of its report carrying its `reportIndex`. Structural problems of any report
 * throw Opcn1214ParseError carrying every problem of the file, each with its file line and
 * `reportIndex`.
 */
export function parse1214Batch(
  content: string | Uint8Array,
  options?: ParseOptions,
): ParseResult[] {
  return parseBatchLines(splitFile(content, options)).map((report, reportIndex) =>
    parseResult(report, reportIndex),
  );
}
