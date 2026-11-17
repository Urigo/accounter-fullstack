/**
 * File assembly (SPEC §8.1 steps 6–7): one line per record, 9999 appended, CRLF after every line
 * including the last (SPEC §15 A-5), windows-1255 bytes (SPEC §15 A-6).
 */
import { encodeRecord } from '../codec/record.js';
import { encodeWindows1255 } from '../codec/windows1255.js';
import { Opcn1214InternalError } from '../errors.js';
import type { NormalizedReport } from '../model/normalized.js';
import { buildControlRecord } from './control.js';

const LINE_SEPARATOR = '\r\n';

/** A report rendered as file content. */
export interface RenderedReport {
  /** One line per record, without line separators; 9999 last. */
  lines: string[];
  /** The lines, each followed by CRLF. */
  text: string;
  /** `text` in windows-1255. */
  bytes: Uint8Array;
}

/**
 * Renders `report` as file content: its records in `report.records` order (the normalizer orders
 * them; assembly does not reorder), then the derived 9999 record. encodeRecord asserts each line's
 * length. Throws Opcn1214InternalError for a record that cannot be encoded or for text that does
 * not encode to one byte per character.
 */
export function renderReport(report: NormalizedReport): RenderedReport {
  const records = [...report.records, buildControlRecord(report)];
  const lines = records.map(record =>
    encodeRecord(report.layout.records[record.recordType], record),
  );
  const text = lines.map(line => line + LINE_SEPARATOR).join('');
  const bytes = encodeWindows1255(text);
  if (bytes.length !== text.length) {
    throw new Opcn1214InternalError(
      `File encoded to ${bytes.length} bytes for ${text.length} characters`,
    );
  }
  return { lines, text, bytes };
}
