import { Opcn1214UnsupportedYearError } from '../errors.js';
import { LAYOUT_2024 } from './2024/layout.generated.js';
import { LAYOUT_2025 } from './2025/index.js';
import { deepFreeze } from './freeze.js';
import type { YearLayout } from './types.js';

/** Tax year → layout (SPEC §14), deep-frozen at module load. */
const LAYOUTS: ReadonlyMap<number, YearLayout> = new Map<number, YearLayout>([
  [2024, deepFreeze<YearLayout>(LAYOUT_2024)],
  [2025, LAYOUT_2025],
]);

const SUPPORTED_TAX_YEARS: readonly number[] = Object.freeze([...LAYOUTS.keys()]);

/** The tax years with a layout, ascending. */
export function supportedTaxYears(): readonly number[] {
  return SUPPORTED_TAX_YEARS;
}

/** Returns the layout of a supported tax year; throws Opcn1214UnsupportedYearError otherwise. */
export function getLayout(taxYear: number): YearLayout {
  const layout = LAYOUTS.get(taxYear);
  if (!layout) {
    throw new Opcn1214UnsupportedYearError(taxYear, SUPPORTED_TAX_YEARS);
  }
  return layout;
}

/**
 * Reports per OPCN file (SPEC §3.1, p.1), the same for every year (YearLayout.limits): a batch
 * holds 1 to this many reports, whatever their tax years.
 */
export const REPORTS_PER_FILE: YearLayout['limits']['reportsPerFile'] = 50;
