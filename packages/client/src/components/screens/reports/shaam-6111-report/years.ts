/** The first tax year Accounter keeps books for. */
const FIRST_REPORT_YEAR = 2020;

/**
 * Tax years the report can be generated for, latest first: every closed year (up to last year),
 * so a new year shows up as soon as it ends. A year selected through the URL stays listed.
 */
export function getShaam6111AvailableYears(
  currentYear = new Date().getFullYear(),
  selectedYear?: string,
): string[] {
  const years: string[] = [];
  for (let year = currentYear - 1; year >= FIRST_REPORT_YEAR; year--) {
    years.push(String(year));
  }
  if (selectedYear && !years.includes(selectedYear)) {
    years.push(selectedYear);
    years.sort((a, b) => Number(b) - Number(a));
  }
  return years;
}
