/** Enum codec (SPEC §4.2): the model holds the mapped numeric value. */
import type { CodeKind, FieldKind } from '../layout/types.js';
import { blank, encodeInteger, invalid, readDigits } from './numeric.js';
import type { Codec } from './types.js';

/**
 * enum: the value must be one of `shape.values` when encoding. Decoding returns any number, so
 * values outside the list reach `field.enum` instead of failing the parse.
 */
const enumCodec: Codec = {
  encode(value, shape) {
    if (value === undefined) {
      return blank(shape);
    }
    if (typeof value !== 'number' || !shape.values?.some(allowed => allowed.value === value)) {
      throw invalid(value, shape, 'one of the allowed values');
    }
    return encodeInteger(value, shape);
  },
  decode(raw, shape) {
    const digits = readDigits(raw, shape);
    return digits === undefined ? undefined : Number(digits);
  },
};

export const ENUM_CODECS = {
  enum: enumCodec,
} as const satisfies Partial<Record<FieldKind | CodeKind, Codec>>;
