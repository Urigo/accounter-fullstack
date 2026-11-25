/**
 * Shared parsing for the form 1214 editors. Inputs hold strings while editing; these turn them
 * into the values the profile mutation takes, with a message naming the field when one is invalid.
 */

/** The outcome of turning a draft into mutation input: the value, or why it cannot be saved. */
export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export const parsed = <T>(value: T): ParseResult<T> => ({ ok: true, value });
export const parseError = <T = never>(error: string): ParseResult<T> => ({ ok: false, error });

/** A blank-or-number text: `null` when blank, `undefined` when not a finite number. */
export function parseOptionalNumber(text: string): number | null | undefined {
  const trimmed = text.trim().replaceAll(',', '');
  if (trimmed === '') {
    return null;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}

/** A blank-or-non-negative-integer text: `null` when blank, `undefined` when invalid. */
export function parseOptionalCount(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === '') {
    return null;
  }
  return /^\d+$/.test(trimmed) ? Number(trimmed) : undefined;
}

/** A blank-or-digits text of `min`–`max` digits: `null` when blank, `undefined` when invalid. */
export function parseOptionalDigits(
  text: string,
  min: number,
  max: number,
): string | null | undefined {
  const trimmed = text.trim();
  if (trimmed === '') {
    return null;
  }
  return new RegExp(`^\\d{${min},${max}}$`).test(trimmed) ? trimmed : undefined;
}

/** How many digits a field takes, for messages ("2 digits", "1 to 9 digits"). */
export function digitsDescription(min: number, max: number): string {
  return min === max ? `${min} digits` : `${min} to ${max} digits`;
}

/** The text an input shows for a stored number (blank when unset). */
export function numberToText(value: number | null | undefined): string {
  return value == null ? '' : String(value);
}

/** Adds `errors` (by field) of the row at `index` of `listPath` to a zod refinement context. */
export function addRowIssues(
  ctx: { addIssue: (issue: { code: 'custom'; path: PropertyKey[]; message: string }) => void },
  listPath: string,
  index: number,
  errors: Partial<Record<string, string>>,
): void {
  for (const [field, message] of Object.entries(errors)) {
    if (message) {
      ctx.addIssue({ code: 'custom', path: [listPath, index, field], message });
    }
  }
}
