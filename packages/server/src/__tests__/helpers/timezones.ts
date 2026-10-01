import { afterAll, beforeAll } from 'vitest';

/**
 * Timezones that date-only values must be stable under (#4560).
 *
 * - `UTC`: CI and most servers.
 * - `Asia/Jerusalem`: where the bookkeeping happens (UTC+2/+3).
 * - `America/New_York` / `Asia/Tokyo`: a zone on each side of UTC, as named in the issue.
 * - `Pacific/Kiritimati` / `Pacific/Pago_Pago`: the extremes (UTC+14 / UTC-11), where any
 *   midnight-based conversion lands on a different calendar day.
 */
export const TEST_TIMEZONES = [
  'UTC',
  'Asia/Jerusalem',
  'America/New_York',
  'Asia/Tokyo',
  'Pacific/Kiritimati',
  'Pacific/Pago_Pago',
] as const;

export type TestTimezone = (typeof TEST_TIMEZONES)[number];

/**
 * Runs `fn` with the process timezone set to `timeZone`, restoring the previous one afterwards.
 *
 * Node re-reads `process.env.TZ` whenever it is assigned, so every `Date` created inside `fn` (and
 * every local-time `date-fns` call) uses that zone.
 */
export async function withTimezone<T>(timeZone: string, fn: () => T | Promise<T>): Promise<T> {
  const previous = process.env['TZ'];
  process.env['TZ'] = timeZone;
  try {
    return await fn();
  } finally {
    restoreTimezone(previous);
  }
}

/**
 * Sets the process timezone for the enclosing `describe` block, restoring it after the block.
 */
export function useTimezone(timeZone: string): void {
  let previous: string | undefined;
  beforeAll(() => {
    previous = process.env['TZ'];
    process.env['TZ'] = timeZone;
  });
  afterAll(() => {
    restoreTimezone(previous);
  });
}

function restoreTimezone(previous: string | undefined) {
  if (previous === undefined) {
    delete process.env['TZ'];
  } else {
    process.env['TZ'] = previous;
  }
}
