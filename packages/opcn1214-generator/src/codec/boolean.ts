/** Boolean codecs (SPEC §4.2 flag, yesNo; §15 A-20). */
import type { CodeKind, FieldKind } from '../layout/types.js';
import { invalid, pad, readDigits } from './numeric.js';
import { CodecDecodeError, type Codec, type FieldShape, type Primitive } from './types.js';

/** Digit written for each boolean state; `absent` is also the decode result for undefined. */
interface BooleanDigits {
  readonly true: string;
  readonly false: string;
  readonly absent: string;
}

/** The value a decoded digit string stands for, or `null` when it is not one of `digits`. */
function fromDigits(text: string, digits: BooleanDigits): Primitive | null {
  const value = Number(text);
  if (value === Number(digits.true)) {
    return true;
  }
  if (value === Number(digits.false)) {
    return digits.false === digits.absent ? undefined : false;
  }
  if (value === Number(digits.absent)) {
    return undefined;
  }
  return null;
}

function booleanCodec(digits: BooleanDigits): Codec {
  return {
    encode(value, shape) {
      if (value === undefined) {
        return pad(digits.absent, shape);
      }
      if (typeof value !== 'boolean') {
        throw invalid(value, shape, 'a boolean');
      }
      return pad(value ? digits.true : digits.false, shape);
    },
    decode(raw: string, shape: FieldShape) {
      const text = readDigits(raw, shape);
      if (text === undefined) {
        return undefined;
      }
      const value = fromDigits(text, digits);
      if (value === null) {
        throw new CodecDecodeError(
          'format',
          raw.indexOf(text),
          `Unexpected value "${raw}" for ${shape.kind}`,
        );
      }
      return value;
    },
  };
}

export const BOOLEAN_CODECS = {
  /** `true` → 1, `false`/absent → 0; 0 decodes to undefined (SPEC §8.4: false flags are lossy). */
  flag: booleanCodec({ true: '1', false: '0', absent: '0' }),
  /** `true` → 1, `false` → 2, absent → 0 (SPEC §15 A-20). */
  yesNo: booleanCodec({ true: '1', false: '2', absent: '0' }),
} as const satisfies Partial<Record<FieldKind | CodeKind, Codec>>;
