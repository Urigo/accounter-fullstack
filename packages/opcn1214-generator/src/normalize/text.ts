/** Text normalization of `text`/`hebrewText` values (SPEC §4.3). */
import { isWindows1255Representable } from '../codec/windows1255.js';

/** Bidi controls: U+200E, U+200F, U+202A–U+202E, U+2066–U+2069 (SPEC §4.3 step 2). */
const BIDI_CONTROLS = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
/** NBSP and TAB become spaces (SPEC §4.3 step 3). */
const SPACE_LIKE = /[\u00A0\t]/g;
const DOUBLE_QUOTES = /[\u201C\u201D\u201E]/g;
const SINGLE_QUOTES = /[\u2018\u2019]/g;
const DASHES = /[\u2013\u2014]/g;
const SPACE_RUNS = / {2,}/g;

/**
 * Normalizes a text value: NFC, bidi controls removed, NBSP/TAB → space, typographic quotes and
 * dashes replaced, trimmed, space runs collapsed. Hebrew stays in logical order; geresh, gershayim
 * and niqqud are kept. Control characters are kept: validation reports them (`field.charset`).
 */
export function normalizeText(value: string): string {
  return value
    .normalize('NFC')
    .replaceAll(BIDI_CONTROLS, '')
    .replaceAll(SPACE_LIKE, ' ')
    .replaceAll(DOUBLE_QUOTES, '"')
    .replaceAll(SINGLE_QUOTES, "'")
    .replaceAll(DASHES, '-')
    .trim()
    .replaceAll(SPACE_RUNS, ' ');
}

/**
 * False for a control character (U+0000–U+001F, U+007F) or a character outside windows-1255
 * (SPEC §4.3 step 5); `field.charset` reports such characters.
 */
export function isAllowedTextChar(ch: string): boolean {
  const code = ch.codePointAt(0);
  if (code === undefined || code <= 0x1f || code === 0x7f) {
    return false;
  }
  return isWindows1255Representable(ch);
}
