import type { CodeKind, FieldKind } from '../layout/types.js';
import { BOOLEAN_CODECS } from './boolean.js';
import { DATE_CODECS } from './date.js';
import { ENUM_CODECS } from './enum.js';
import { NUMERIC_CODECS } from './numeric.js';
import { PERCENT_CODECS } from './percent.js';
import { PHONE_CODECS } from './phone.js';
import { TEXT_CODECS } from './text.js';
import type { Codec } from './types.js';

/**
 * The codec of every field and code kind: the single entry point of the record codec. Total, so a
 * new kind without a codec is a compile error.
 */
export const CODECS: Readonly<Record<FieldKind | CodeKind, Codec>> = {
  ...NUMERIC_CODECS,
  ...TEXT_CODECS,
  ...DATE_CODECS,
  ...BOOLEAN_CODECS,
  ...ENUM_CODECS,
  ...PERCENT_CODECS,
  ...PHONE_CODECS,
};

export function codecFor(kind: FieldKind | CodeKind): Codec {
  return CODECS[kind];
}
