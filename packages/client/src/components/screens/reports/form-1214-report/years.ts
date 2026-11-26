/** Supported tax years, latest first (the server lists them in no promised order). */
export function sortForm1214Years(supportedYears: readonly number[]): number[] {
  return [...new Set(supportedYears)].sort((a, b) => b - a);
}

/**
 * The tax year the page shows: the URL's `?year=` when form 1214 supports it, otherwise the latest
 * supported year. Undefined while the supported years are unknown (or none is supported).
 */
export function resolveForm1214Year(
  yearParam: string | null,
  supportedYears: readonly number[],
): number | undefined {
  if (supportedYears.length === 0) {
    return undefined;
  }
  if (yearParam && /^\d{4}$/.test(yearParam)) {
    const year = Number.parseInt(yearParam, 10);
    if (supportedYears.includes(year)) {
      return year;
    }
  }
  return Math.max(...supportedYears);
}
