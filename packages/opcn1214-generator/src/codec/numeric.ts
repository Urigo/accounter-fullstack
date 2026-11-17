/**
 * Codecs of the numeric family (SPEC §4.1, §4.2, §4.4): integers, digit strings, ×100-scaled
 * amounts and fillers.
 */
import { Opcn1214InternalError } from '../errors.js';
import type { CodeKind, FieldKind } from '../layout/types.js';
import { ALPHANUMERIC_PAD_SIDE, padAlphanumeric, padNumeric } from './padding.js';
import { CodecDecodeError, type Codec, type FieldShape, type Primitive } from './types.js';

const DIGITS = /^\d+$/;
/** Tolerance of the ×100 decimals check (SPEC §4.4). */
const SCALE_EPSILON = 1e-6;

function blank(shape: FieldShape): string {
  return shape.type === 'numeric' ? '0'.repeat(shape.length) : ' '.repeat(shape.length);
}

/** Pads a digit string per the field type. */
function pad(digits: string, shape: FieldShape): string {
  return shape.type === 'numeric'
    ? padNumeric(digits, shape.length)
    : padAlphanumeric(digits, shape.length);
}

function show(value: Primitive): string {
  return typeof value === 'string' ? `"${value}"` : String(value);
}

function invalid(value: Primitive, shape: FieldShape, expected: string): Opcn1214InternalError {
  return new Opcn1214InternalError(
    `Cannot encode ${show(value)} as ${shape.kind}: expected ${expected}`,
  );
}

function encodeInteger(value: number, shape: FieldShape): string {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw invalid(value, shape, 'a non-negative safe integer');
  }
  return pad(String(value), shape);
}

/**
 * Checks the raw text and returns its digits, or undefined for all-space text. Numeric fields
 * must be all digits; alphanumeric fields may carry padding spaces on ALPHANUMERIC_PAD_SIDE.
 */
function readDigits(raw: string, shape: FieldShape): string | undefined {
  if (raw.length !== shape.length) {
    throw new CodecDecodeError(
      'length',
      Math.min(raw.length, shape.length),
      `Expected ${shape.length} characters for ${shape.kind}, got ${raw.length}`,
    );
  }
  if (raw.trim() === '') {
    return undefined;
  }
  let start = 0;
  let end = raw.length;
  if (shape.type === 'alphanumeric') {
    if (ALPHANUMERIC_PAD_SIDE === 'left') {
      start = raw.length - raw.trimStart().length;
    } else {
      end = raw.trimEnd().length;
    }
  }
  for (let index = start; index < end; index++) {
    const char = raw[index];
    if (char === undefined || char < '0' || char > '9') {
      throw new CodecDecodeError(
        'numeric',
        index,
        `Non-digit character at offset ${index} of ${shape.kind} "${raw}"`,
      );
    }
  }
  return raw.slice(start, end);
}

/** num, year, count, serial, const, foreignCode, amount, amountX: non-negative integers. */
const integerCodec: Codec = {
  encode(value, shape) {
    if (value === undefined) {
      return blank(shape);
    }
    if (typeof value !== 'number') {
      throw invalid(value, shape, 'a number');
    }
    return encodeInteger(value, shape);
  },
  decode(raw, shape) {
    const digits = readDigits(raw, shape);
    return digits === undefined ? undefined : Number(digits);
  },
};

/** id9, shareholderId, digits: digit strings, decoded as the full-width string. */
const digitStringCodec: Codec = {
  encode(value, shape) {
    if (value === undefined) {
      return blank(shape);
    }
    if (typeof value !== 'string' || !DIGITS.test(value)) {
      throw invalid(value, shape, 'a string of digits');
    }
    return pad(value, shape);
  },
  decode(raw, shape) {
    return readDigits(raw, shape);
  },
};

/** amountX100, rateX100: natural units with at most 2 decimals, written as value × 100. */
const scaledCodec: Codec = {
  encode(value, shape) {
    if (value === undefined) {
      return blank(shape);
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw invalid(value, shape, 'a finite number');
    }
    const scaled = Math.round(value * 100);
    if (Math.abs(value * 100 - scaled) > SCALE_EPSILON) {
      throw invalid(value, shape, 'at most 2 decimals');
    }
    return encodeInteger(scaled, shape);
  },
  decode(raw, shape) {
    const digits = readDigits(raw, shape);
    return digits === undefined ? undefined : Number(digits) / 100;
  },
};

/** filler: always written as zeros or spaces; ignored on decode (D-4). */
const fillerCodec: Codec = {
  encode(value, shape) {
    if (value !== undefined) {
      throw invalid(value, shape, 'no value (filler)');
    }
    return blank(shape);
  },
  decode(raw, shape) {
    if (raw.length !== shape.length) {
      throw new CodecDecodeError(
        'length',
        Math.min(raw.length, shape.length),
        `Expected ${shape.length} characters for filler, got ${raw.length}`,
      );
    }
    return undefined;
  },
};

export const NUMERIC_CODECS = {
  num: integerCodec,
  year: integerCodec,
  count: integerCodec,
  serial: integerCodec,
  const: integerCodec,
  foreignCode: integerCodec,
  amount: integerCodec,
  amountX: integerCodec,
  id9: digitStringCodec,
  shareholderId: digitStringCodec,
  digits: digitStringCodec,
  amountX100: scaledCodec,
  rateX100: scaledCodec,
  filler: fillerCodec,
} as const satisfies Partial<Record<FieldKind | CodeKind, Codec>>;
