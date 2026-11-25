import { Opcn1214InternalError } from '../errors.js';
import type { CodeKind, FieldKind } from '../layout/types.js';
import { NUMERIC_CODECS } from './numeric.js';
import type { Codec } from './types.js';

/** The codec of every field and code kind: the single entry point of the record codec. */
export const CODECS: Partial<Record<FieldKind | CodeKind, Codec>> = {
  ...NUMERIC_CODECS,
};

export function codecFor(kind: FieldKind | CodeKind): Codec {
  const codec = CODECS[kind];
  if (!codec) {
    throw new Opcn1214InternalError(`No codec for field kind "${kind}"`);
  }
  return codec;
}
