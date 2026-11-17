/**
 * File content to lines (SPEC §8.2 step 1): bytes decoded per `options.encoding`, a UTF-8 BOM
 * stripped, CRLF or LF line endings, one trailing empty line ignored.
 */
import { decodeWindows1255 } from '../codec/windows1255.js';
import type { ParseOptions } from '../model/options.js';

const UTF8_BOM_BYTES = [0xef, 0xbb, 0xbf] as const;
const BOM = String.fromCodePoint(0xfe_ff);
const LINE_BREAK = /\r?\n/;

function startsWithUtf8Bom(bytes: Uint8Array): boolean {
  return UTF8_BOM_BYTES.every((byte, offset) => bytes[offset] === byte);
}

function decode(content: string | Uint8Array, encoding: ParseOptions['encoding']): string {
  if (typeof content === 'string') {
    return content;
  }
  const body = startsWithUtf8Bom(content) ? content.subarray(UTF8_BOM_BYTES.length) : content;
  return encoding === 'utf-8' ? new TextDecoder('utf-8').decode(body) : decodeWindows1255(body);
}

/**
 * The lines of a file, without line terminators. A Uint8Array is decoded with windows-1255, or
 * UTF-8 when `options.encoding` says so; a string is taken as already decoded. A leading UTF-8
 * BOM is stripped. Lines end with CRLF or LF; the empty line after the final terminator is not a
 * line.
 */
export function splitFile(content: string | Uint8Array, options: ParseOptions = {}): string[] {
  const text = decode(content, options.encoding);
  const lines = (text.startsWith(BOM) ? text.slice(BOM.length) : text).split(LINE_BREAK);
  if (lines.at(-1) === '') {
    lines.pop();
  }
  return lines;
}
