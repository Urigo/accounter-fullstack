/**
 * windows-1255 byte conversion (SPEC §15 A-6). These helpers check code-page membership only:
 * control characters (CR/LF of the line separators included) are valid bytes. The "no control
 * characters in text" check is `isAllowedTextChar` (src/normalize/text.ts, D-14).
 */
import iconv from 'iconv-lite';
import { Opcn1214InternalError } from '../errors.js';

const ENCODING = 'windows-1255';
/**
 * iconv-lite decodes the code page's unassigned bytes (0x81, 0xFF, …) to U+FFFD and therefore
 * encodes U+FFFD back to one of them; it is not a character of the code page.
 */
const REPLACEMENT_CHARACTER = '\uFFFD';

/**
 * True when every character of `text` has a byte in windows-1255. iconv-lite writes '?' for a
 * character outside the code page, so membership is checked by a lossless round trip.
 */
export function isWindows1255Representable(text: string): boolean {
  return (
    !text.includes(REPLACEMENT_CHARACTER) &&
    iconv.decode(iconv.encode(text, ENCODING), ENCODING) === text
  );
}

/** Encodes `text` as windows-1255 bytes; never substitutes '?' for a character. */
export function encodeWindows1255(text: string): Uint8Array {
  if (!isWindows1255Representable(text)) {
    throw new Opcn1214InternalError('Text contains characters outside the windows-1255 code page');
  }
  return iconv.encode(text, ENCODING);
}

/** Decodes windows-1255 bytes. */
export function decodeWindows1255(bytes: Uint8Array): string {
  return iconv.decode(bytes, ENCODING);
}
