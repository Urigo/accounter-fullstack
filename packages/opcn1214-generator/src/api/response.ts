/**
 * parseResponseFile (SPEC §6.1): SHAAM's response file shumot.shg (SPEC §3.9). p.61–62 give only the
 * three numeric fields and the code table; the encoding, the line separator and the place of the
 * 08/33 field detail are unverified defaults (SPEC §15 A-35).
 */
import { Opcn1214ParseError } from '../errors.js';
import { splitFile } from '../file/split.js';
import { responseMeaning } from '../response/codes.js';
import type { Issue } from '../validate/issue.js';
import { parseIssue } from '../validate/parse-rules.js';

/** One line of a response file (SPEC §6.2). */
export interface ResponseRecord {
  /** 9 digits, as written in the file. */
  fileNumber: string;
  taxYear: number;
  /** The 2-character response code: '00', '05', … */
  code: string;
  /** English text from SPEC §3.9; 'General error; notify SHAAM' for an unlisted code. */
  meaning: string;
  /** code === '00' */
  accepted: boolean;
  /**
   * The text after the code (columns 16 onward, for any code; p.62 names it for 08 / 33 only), trailing
   * spaces trimmed and leading spaces kept; absent when empty. Bytes that do not decode as
   * windows-1255 come back as U+FFFD (no issue is raised; SPEC §15 A-35).
   */
  detail?: string;
  /** 1-based line number in the file. */
  line: number;
}

/** Field positions of a response line (SPEC §3.9), as 0-based offsets. */
const FILE_NUMBER = { start: 0, end: 9 } as const;
const TAX_YEAR = { start: 9, end: 13 } as const;
const CODE = { start: 13, end: 15 } as const;
const NON_DIGIT = /\D/;
const BLANK = /^\s*$/;

/** The parse.numeric issue of a field of `text` holding a non-digit; undefined when it has none. */
function numericIssue(
  text: string,
  lineNumber: number,
  field: { start: number; end: number },
  name: string,
): Issue | undefined {
  const value = text.slice(field.start, field.end);
  const offset = value.search(NON_DIGIT);
  if (offset === -1) {
    return undefined;
  }
  return parseIssue(
    'parse.numeric',
    `${name} "${value}" is not a number.`,
    { line: lineNumber, column: field.start + offset + 1 },
    { value },
  );
}

/** The structural problems of a non-blank response line, by column. */
function lineIssues(text: string, lineNumber: number): Issue[] {
  const issues = [
    numericIssue(text, lineNumber, FILE_NUMBER, 'File number'),
    numericIssue(text, lineNumber, TAX_YEAR, 'Tax year'),
    numericIssue(text, lineNumber, CODE, 'Response code'),
  ].filter(issue => issue !== undefined);
  if (text.length < CODE.end) {
    issues.push(
      parseIssue(
        'parse.lineLength',
        `A response line must have at least ${CODE.end} characters, not ${text.length}.`,
        { line: lineNumber, column: text.length + 1 },
      ),
    );
  }
  return issues;
}

function responseRecord(text: string, line: number): ResponseRecord {
  const code = text.slice(CODE.start, CODE.end);
  const detail = text.slice(CODE.end).trimEnd();
  return {
    fileNumber: text.slice(FILE_NUMBER.start, FILE_NUMBER.end),
    taxYear: Number(text.slice(TAX_YEAR.start, TAX_YEAR.end)),
    code,
    meaning: responseMeaning(code),
    accepted: code === '00',
    ...(detail === '' ? {} : { detail }),
    line,
  };
}

/**
 * Parses SHAAM's response file shumot.shg (SPEC §3.9): one ResponseRecord per non-blank line, in
 * file order. Bytes are decoded as windows-1255; lines end with CRLF or LF; blank lines are
 * skipped (SPEC §15 A-35: unverified defaults). A line shorter than 15 characters
 * (parse.lineLength) or with a non-digit in its file number, tax year or response code
 * (parse.numeric; p.62 makes all three numeric) throws Opcn1214ParseError carrying the problems of
 * every such line, sorted by line and column. A file without any non-blank line throws parse.empty
 * (line 1, column 1), as parse1214 does: SHAAM answers every upload with at least one line. A
 * 2-digit code that p.62 does not list means 'General error; notify SHAAM'.
 *
 * A file in another encoding (UTF-8, CP862) is not detected: its Hebrew decodes as windows-1255 to
 * valid but wrong characters. Decode such a file yourself and pass the string. Bytes that do not
 * decode as windows-1255 come back as U+FFFD in `detail` (and fail parse.numeric in the numeric
 * fields); parse.encoding is not raised.
 */
export function parseResponseFile(content: string | Uint8Array): ResponseRecord[] {
  const records: ResponseRecord[] = [];
  const issues: Issue[] = [];
  for (const [index, { text }] of splitFile(content).entries()) {
    if (BLANK.test(text)) {
      continue;
    }
    const line = index + 1;
    const problems = lineIssues(text, line);
    if (problems.length > 0) {
      issues.push(...problems);
    } else {
      records.push(responseRecord(text, line));
    }
  }
  if (records.length === 0 && issues.length === 0) {
    issues.push(parseIssue('parse.empty', 'The file has no records.', { line: 1, column: 1 }));
  }
  if (issues.length > 0) {
    throw new Opcn1214ParseError(issues);
  }
  return records;
}
