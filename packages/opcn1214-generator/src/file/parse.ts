/**
 * Parser (SPEC §8.2 steps 2, 4, 5, 7): the lines of a file to the internal NormalizedReport, with
 * the same record codec as generation. Structural checks (order, occurrences, control counts) and
 * their parse.* issues are not done here yet: undecodable content throws CodecDecodeError.
 */
import { decodeRecord } from '../codec/record.js';
import { CodecDecodeError } from '../codec/types.js';
import { getLayout } from '../layout/registry.js';
import type { RecordType, YearLayout } from '../layout/types.js';
import type { NormalizedRecord, NormalizedReport } from '../model/normalized.js';
import { codeKey, pathFor } from '../normalize/paths.js';

/** 0-based offsets of the record type (positions 5–8) and the 1000 tax year (1000@146). */
const RECORD_TYPE = { start: 4, end: 8 } as const;
const TAX_YEAR = { start: 145, end: 149 } as const;
const YEAR = /^\d{4}$/;

/** `error` with the 1-based line number in its message. */
function onLine(line: number, error: CodecDecodeError): CodecDecodeError {
  return new CodecDecodeError(error.reason, error.offset, `Line ${line}: ${error.message}`, {
    cause: error,
  });
}

/** The layout selected by the tax year of the first line, which must be a 1000 record. */
function layoutOf(lines: readonly string[]): YearLayout {
  const [first] = lines;
  if (first === undefined) {
    throw new CodecDecodeError('length', 0, 'The file is empty');
  }
  if (first.slice(RECORD_TYPE.start, RECORD_TYPE.end) !== '1000') {
    throw onLine(
      1,
      new CodecDecodeError(
        'format',
        RECORD_TYPE.start,
        'The file does not start with a 1000 record',
      ),
    );
  }
  const year = first.slice(TAX_YEAR.start, TAX_YEAR.end);
  if (!YEAR.test(year)) {
    throw onLine(
      1,
      new CodecDecodeError('numeric', TAX_YEAR.start, `Tax year "${year}" is not a number`),
    );
  }
  return getLayout(Number(year));
}

function recordTypeOf(layout: YearLayout, line: string): RecordType {
  const type = line.slice(RECORD_TYPE.start, RECORD_TYPE.end);
  if (!Object.hasOwn(layout.records, type)) {
    throw new CodecDecodeError('format', RECORD_TYPE.start, `Unknown record type "${type}"`);
  }
  return type as RecordType;
}

/** `record` with the input path of every value and code (emission index = input index). */
function withPaths(record: NormalizedRecord): NormalizedRecord {
  const keys = [...Object.keys(record.values), ...[...record.codes.keys()].map(codeKey)];
  const paths: Record<string, string> = {};
  for (const key of keys) {
    paths[key] = pathFor(record.recordType, record.index, key);
  }
  return { ...record, paths };
}

/**
 * The NormalizedReport of a single-report file given as its lines: the layout comes from the tax
 * year of the first (1000) record; each line is decoded with the layout of its record type and
 * indexed among the records of that type; 9999 is decoded but not kept. Throws CodecDecodeError
 * (message prefixed with the line number) for an empty file, a first line that is not a 1000
 * record, an unknown record type or undecodable content, and Opcn1214UnsupportedYearError for a
 * tax year without a layout.
 */
export function parseLines(lines: readonly string[]): NormalizedReport {
  const layout = layoutOf(lines);
  const counts = new Map<RecordType, number>();
  const records: NormalizedRecord[] = [];
  for (const [offset, line] of lines.entries()) {
    try {
      const type = recordTypeOf(layout, line);
      const index = counts.get(type) ?? 0;
      counts.set(type, index + 1);
      const record = decodeRecord(layout.records[type], line, index);
      if (type !== '9999') {
        records.push(withPaths(record));
      }
    } catch (error) {
      throw error instanceof CodecDecodeError ? onLine(offset + 1, error) : error;
    }
  }
  return { taxYear: layout.taxYear, layout, records, notices: [], omittedZeroCodes: [] };
}
