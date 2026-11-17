/** Phone-prefix codec (SPEC §4.2, §15 A-19). */
import type { CodeKind, FieldKind } from '../layout/types.js';
import { blank, invalid, pad, readDigits } from './numeric.js';
import { CodecDecodeError, type Codec, type FieldShape } from './types.js';

/**
 * The allowed prefixes of a field as strings. The layout stores them as numbers (`02` → 2,
 * `052` → 52); every allowed prefix is a single `0` followed by its significant digits (SPEC §4.2;
 * asserted over the layout in tests/codec/text.test.ts), so the leading zero is restored here.
 */
function allowedPrefixes(shape: FieldShape): string[] {
  return (shape.values ?? []).map(({ value }) => `0${value}`);
}

/**
 * phonePrefix: the prefix digits, padded per the field type (` 02` alphanumeric, `002` numeric).
 * Decoding strips padding and leading zeros, then picks the allowed prefix with the same
 * significant digits (`002` → `02`, ` 02` → `02`, `052` → `052`). An all-zero numeric field is
 * the absent value and decodes to undefined.
 */
const phonePrefixCodec: Codec = {
  encode(value, shape) {
    if (value === undefined) {
      return blank(shape);
    }
    if (typeof value !== 'string' || !allowedPrefixes(shape).includes(value)) {
      throw invalid(value, shape, 'an allowed phone prefix');
    }
    return pad(value, shape);
  },
  decode(raw, shape) {
    const digits = readDigits(raw, shape);
    if (digits === undefined) {
      return undefined;
    }
    const significant = digits.replace(/^0+/, '');
    if (significant === '') {
      return undefined;
    }
    const prefix = `0${significant}`;
    if (!allowedPrefixes(shape).includes(prefix)) {
      throw new CodecDecodeError(
        'format',
        raw.indexOf(digits),
        `Unknown phone prefix "${raw}" for ${shape.kind}`,
      );
    }
    return prefix;
  },
};

export const PHONE_CODECS = {
  phonePrefix: phonePrefixCodec,
} as const satisfies Partial<Record<FieldKind | CodeKind, Codec>>;
