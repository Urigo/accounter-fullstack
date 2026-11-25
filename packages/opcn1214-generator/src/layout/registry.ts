import { LAYOUT_2024 } from './2024/layout.generated.js';
import type { YearLayout } from './types.js';

/** Returns the layout of a supported tax year (2024 only for now). */
export function getLayout(taxYear: number): YearLayout {
  if (taxYear === 2024) {
    return LAYOUT_2024;
  }
  throw new Error(`No 1214 layout for tax year ${taxYear}`);
}
