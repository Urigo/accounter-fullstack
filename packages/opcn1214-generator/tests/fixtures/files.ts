/**
 * File helpers for parser tests: the text of a golden file and line-level edits of a file text
 * (CRLF line endings, as generate1214 writes them). Golden files are only read, never written.
 */
import { readFileSync } from 'node:fs';
import { decodeWindows1255 } from '../../src/codec/windows1255.js';

const CRLF = '\r\n';
const GOLDEN_DIR = new URL('golden/', import.meta.url);

/** The bytes of tests/fixtures/golden/<name>.opcn. */
export function goldenBytes(name: string): Uint8Array {
  return new Uint8Array(readFileSync(new URL(`${name}.opcn`, GOLDEN_DIR)));
}

/** The text of tests/fixtures/golden/<name>.opcn (windows-1255 decoded, CRLF kept). */
export function goldenText(name: string): string {
  return decodeWindows1255(goldenBytes(name));
}

function linesOf(text: string): string[] {
  return text.split(CRLF);
}

function lineAt(lines: readonly string[], line: number): string {
  const target = lines[line - 1];
  if (target === undefined || line < 1) {
    throw new Error(`The text has no line ${line}`);
  }
  return target;
}

export interface Tamper {
  /** 1-based line. */
  line: number;
  /** 1-based column where `value` starts. */
  position: number;
  /** Text written at `position`. */
  value: string;
  /** Characters of the line replaced by `value` (default `value.length`). */
  length?: number;
}

/** `text` with `length` characters of `line` from `position` replaced by `value`. */
export function tamper(
  text: string,
  { line, position, value, length = value.length }: Tamper,
): string {
  const lines = linesOf(text);
  const target = lineAt(lines, line);
  lines[line - 1] = target.slice(0, position - 1) + value + target.slice(position - 1 + length);
  return lines.join(CRLF);
}

/** `text` without its `line`-th (1-based) line. */
export function dropLine(text: string, line: number): string {
  const lines = linesOf(text);
  lineAt(lines, line);
  lines.splice(line - 1, 1);
  return lines.join(CRLF);
}

/** `text` with lines `a` and `b` (1-based) exchanged. */
export function swapLines(text: string, a: number, b: number): string {
  const lines = linesOf(text);
  const first = lineAt(lines, a);
  lines[a - 1] = lineAt(lines, b);
  lines[b - 1] = first;
  return lines.join(CRLF);
}
