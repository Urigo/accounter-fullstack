import { toWindows1255 } from '../utils/encoding.js';

/** Every record ends with CR LF (X'0D0A') per the SHAAM 6111 file specification. */
export const RECORD_TERMINATOR = '\r\n';

/** The file ends with X'0D0A1A': the last record's CR LF followed by SUB (X'1A'). */
export const END_OF_FILE_MARKER = '\x1a';

/** The specification allows at most 10 reports (records) in a single file. */
export const MAX_REPORTS_PER_FILE = 10;

/**
 * Frames one or more generated report records into the content of a SHAAM 6111 file:
 * each record followed by CR LF, and the file closed by the EOF marker.
 * @param records Report strings, as returned by `generateReport`.
 * @returns The full file content as a string.
 */
export function frameReportFile(records: string | string[]): string {
  const recordList = Array.isArray(records) ? records : [records];
  if (recordList.length === 0) {
    throw new Error('A SHAAM 6111 file must contain at least one report');
  }
  if (recordList.length > MAX_REPORTS_PER_FILE) {
    throw new Error(
      `A SHAAM 6111 file can contain at most ${MAX_REPORTS_PER_FILE} reports (got ${recordList.length})`,
    );
  }
  return recordList.map(record => record + RECORD_TERMINATOR).join('') + END_OF_FILE_MARKER;
}

/**
 * Frames report records into a SHAAM 6111 file and encodes it as Windows-1255,
 * the encoding SHAAM expects for the Hebrew business description field.
 * @param records Report strings, as returned by `generateReport`.
 * @returns The encoded file bytes.
 */
export function encodeReportFile(records: string | string[]): Uint8Array<ArrayBuffer> {
  return new Uint8Array(toWindows1255(frameReportFile(records)));
}
