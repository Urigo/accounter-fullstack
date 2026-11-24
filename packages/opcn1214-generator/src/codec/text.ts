/** Codecs of normalized text (SPEC §4.2 text, hebrewText). */
import type { CodeKind, FieldKind } from '../layout/types.js';
import { blank, checkLength, invalid } from './numeric.js';
import { padAlphanumeric } from './padding.js';
import type { Codec } from './types.js';

const EDGE_SPACES = /^ +| +$/g;

/**
 * text, hebrewText: the value is already normalized (SPEC §4.3) and validated (first Hebrew letter,
 * charset); the codec only pads it. Decoding trims the padding spaces (spaces only; SPEC §8.2 step 4).
 */
const textCodec: Codec = {
  encode(value, shape) {
    if (value === undefined) {
      return blank(shape);
    }
    if (typeof value !== 'string') {
      throw invalid(value, shape, 'a string');
    }
    return padAlphanumeric(value, shape.length);
  },
  decode(raw, shape) {
    checkLength(raw, shape);
    // Padding is the space character only; trim() would also drop control characters and other
    // whitespace that validation must see.
    const text = raw.replaceAll(EDGE_SPACES, '');
    return text === '' ? undefined : text;
  },
};

export const TEXT_CODECS = {
  text: textCodec,
  hebrewText: textCodec,
} as const satisfies Partial<Record<FieldKind | CodeKind, Codec>>;
