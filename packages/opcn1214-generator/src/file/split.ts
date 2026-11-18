/**
 * File content to lines (SPEC §8.2 step 1): bytes decoded per `options.encoding`, a UTF-8 BOM
 * stripped, CRLF or LF line endings, one trailing empty line ignored. Bytes that do not decode are
 * located per line (parse.encoding).
 */
import { decodeWindows1255 } from '../codec/windows1255.js';
import type { ParseOptions } from '../model/options.js';

/** One line of a file, without its line terminator. */
export interface FileLine {
  text: string;
  /**
   * 0-based offset in `text` of the first character whose bytes do not decode in the selected
   * encoding (they decode to U+FFFD); absent when the whole line decodes.
   */
  invalidAt?: number;
}

const UTF8_BOM_BYTES = [0xef, 0xbb, 0xbf] as const;
const BOM = String.fromCodePoint(0xfe_ff);
const LINE_BREAK = /\r?\n/;
const LF = 0x0a;
const CR = 0x0d;
const REPLACEMENT_CHARACTER = String.fromCodePoint(0xff_fd);

function startsWithUtf8Bom(bytes: Uint8Array): boolean {
  return UTF8_BOM_BYTES.every((byte, offset) => bytes[offset] === byte);
}

/** The byte lines of `bytes`: split at LF, a CR before the LF removed. */
function byteLines(bytes: Uint8Array): Uint8Array[] {
  const lines: Uint8Array[] = [];
  let start = 0;
  for (let end = bytes.indexOf(LF); end !== -1; end = bytes.indexOf(LF, start)) {
    lines.push(bytes.subarray(start, end > start && bytes[end - 1] === CR ? end - 1 : end));
    start = end + 1;
  }
  lines.push(bytes.subarray(start));
  return lines;
}

/**
 * Decodes one line. windows-1255 decodes its unassigned bytes to U+FFFD, which is not a character
 * of the code page; UTF-8 is decoded strictly, so a U+FFFD only marks a problem when the line is not
 * valid UTF-8.
 */
function decodeLine(bytes: Uint8Array, encoding: ParseOptions['encoding']): FileLine {
  if (encoding === 'utf-8') {
    try {
      return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
    } catch {
      const text = new TextDecoder('utf-8').decode(bytes);
      return { text, invalidAt: Math.max(0, text.indexOf(REPLACEMENT_CHARACTER)) };
    }
  }
  const text = decodeWindows1255(bytes);
  const invalidAt = text.indexOf(REPLACEMENT_CHARACTER);
  return invalidAt === -1 ? { text } : { text, invalidAt };
}

function withoutTrailingEmptyLine<T>(lines: T[], isEmpty: (line: T) => boolean): T[] {
  const last = lines.at(-1);
  if (last !== undefined && isEmpty(last)) {
    lines.pop();
  }
  return lines;
}

/**
 * The lines of a file, without line terminators. A Uint8Array is decoded with windows-1255, or
 * UTF-8 when `options.encoding` says so, line by line; a string is taken as already decoded. A
 * leading UTF-8 BOM is stripped. Lines end with CRLF or LF; the empty line after the final
 * terminator is not a line.
 */
export function splitFile(content: string | Uint8Array, options: ParseOptions = {}): FileLine[] {
  if (typeof content === 'string') {
    const text = content.startsWith(BOM) ? content.slice(BOM.length) : content;
    return withoutTrailingEmptyLine(text.split(LINE_BREAK), line => line === '').map(line => ({
      text: line,
    }));
  }
  const body = startsWithUtf8Bom(content) ? content.subarray(UTF8_BOM_BYTES.length) : content;
  return withoutTrailingEmptyLine(byteLines(body), line => line.length === 0).map(line =>
    decodeLine(line, options.encoding),
  );
}
