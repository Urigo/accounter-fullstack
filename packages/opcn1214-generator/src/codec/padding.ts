import { Opcn1214InternalError } from '../errors.js';

export type PadSide = 'left' | 'right';

/**
 * Side on which alphanumeric fields are padded with spaces. p.61 reads "pad spaces on the left"
 * (right-aligned text); to be verified on shopcn (SPEC §4.1, §15 A-1).
 */
export const ALPHANUMERIC_PAD_SIDE: PadSide = 'left';

function assertFits(value: string, width: number): void {
  if (value.length > width) {
    throw new Opcn1214InternalError(
      `Value "${value}" (${value.length} characters) does not fit a field of width ${width}`,
    );
  }
}

/** Right-aligns `value` in `width` characters, left-padded with `0` (SPEC §4.1). */
export function padNumeric(value: string, width: number): string {
  assertFits(value, width);
  return value.padStart(width, '0');
}

/** Pads `value` to `width` characters with spaces on `side` (SPEC §4.1). */
export function padAlphanumeric(
  value: string,
  width: number,
  side: PadSide = ALPHANUMERIC_PAD_SIDE,
): string {
  assertFits(value, width);
  return side === 'left' ? value.padStart(width, ' ') : value.padEnd(width, ' ');
}
