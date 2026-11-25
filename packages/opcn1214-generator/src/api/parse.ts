/** parse1214 (SPEC §6.1, §8.2): a single-report file back to the public input. */
import { parseLines } from '../file/parse.js';
import { splitFile } from '../file/split.js';
import type { IsoDate, Report1214Input } from '../model/input.js';
import type { ParseOptions } from '../model/options.js';
import { denormalize } from '../normalize/denormalize.js';
import { provisionalLayoutIssues } from '../pipeline.js';
import { runRules } from '../validate/engine.js';
import { compareIssues, type Issue } from '../validate/issue.js';

/** The outcome of parse1214 (SPEC §6.2). */
export interface ParseResult {
  /**
   * The input reconstructed from the file. For a file written by generate1214 this is the
   * canonical form (SPEC §8.4); for any other well-formed file the values come back as read (e.g. a
   * zero amount of a non-zeroAllowed code, or text with double spaces), so canonicalize(report)
   * may differ from it.
   */
  report: Report1214Input;
  /**
   * Validation of the parsed content (errors and warnings), sorted (SPEC §9.1), including
   * struct.taxYear.provisionalLayout for a file of a provisional tax year.
   */
  issues: Issue[];
  /** From 1000@165; '' when the file has none (field.required is then in `issues`). */
  saveDate: IsoDate;
  /** From 1000@150; '' when the file has none (field.required is then in `issues`). */
  softwareName: string;
}

/**
 * Parses a single-report file. Business-rule issues of the parsed content are returned as
 * `issues`, not thrown. Structural problems (SPEC §8.2 steps 1–6, an unsupported tax year
 * included) throw Opcn1214ParseError carrying every problem of the file.
 */
export function parse1214(content: string | Uint8Array, options?: ParseOptions): ParseResult {
  const normalized = parseLines(splitFile(content, options));
  const report = denormalize(normalized);
  return {
    report,
    issues: [...provisionalLayoutIssues(report.taxYear), ...runRules(normalized)].sort(
      compareIssues,
    ),
    saveDate: report.meta?.saveDate ?? '',
    softwareName: report.meta?.softwareName ?? '',
  };
}
