/** The first tax year Accounter keeps books for. */
const FIRST_REPORT_YEAR = 2020;

/**
 * Tax years the report can be generated for, latest first: every closed year (up to last year),
 * so a new year shows up as soon as it ends. Years already in use (the report year and the
 * comparison year, e.g. from the URL) stay listed even outside that range, so their selects never
 * render blank.
 */
export function getShaam6111AvailableYears(
  currentYear = new Date().getFullYear(),
  ...keepYears: Array<string | undefined>
): string[] {
  const years: string[] = [];
  for (let year = currentYear - 1; year >= FIRST_REPORT_YEAR; year--) {
    years.push(String(year));
  }
  for (const year of keepYears) {
    if (year && !years.includes(year)) {
      years.push(year);
    }
  }
  return years.sort((a, b) => Number(b) - Number(a));
}
