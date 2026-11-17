/** Percentage codecs (SPEC §4.2 percentX100, percentLiteral; §15 A-2, A-3). */
import type { CodeKind, FieldKind } from '../layout/types.js';
import { blank, invalid, pad, readDigits, scaleBy100, scaledCodec } from './numeric.js';
import type { Codec } from './types.js';

/**
 * percentLiteral: an integer is written zero-padded (`100` → `00100`); otherwise the value with
 * two decimals, zero-padded (`10.23` → `10.23`, `5.5` → `05.50`). The decimal point is allowed in
 * these fields only (SPEC §15 A-3).
 */
const percentLiteralCodec: Codec = {
  encode(value, shape) {
    if (value === undefined) {
      return blank(shape);
    }
    const scaled = scaleBy100(value, shape);
    if (!Number.isSafeInteger(scaled) || scaled < 0) {
      throw invalid(value, shape, 'a non-negative number');
    }
    const whole = Math.trunc(scaled / 100);
    const cents = scaled % 100;
    const text = cents === 0 ? String(whole) : `${whole}.${String(cents).padStart(2, '0')}`;
    return pad(text, shape);
  },
  decode(raw, shape) {
    const text = readDigits(raw, shape, { decimalPoint: true });
    return text === undefined ? undefined : Number(text);
  },
};

export const PERCENT_CODECS = {
  /** `round(value × 100)` with the field's padding (`10.23` → ` 1023`, SPEC §15 A-2). */
  percentX100: scaledCodec,
  percentLiteral: percentLiteralCodec,
} as const satisfies Partial<Record<FieldKind | CodeKind, Codec>>;
