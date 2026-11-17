import { LAYOUT_2024 } from '../2024/layout.generated.js';
import { deepFreeze } from '../freeze.js';
import type { YearLayout } from '../types.js';

/**
 * Tax year 2025 reuses the 2024 layout until SHAAM's 2025 specification is added (SPEC §14):
 * same records, codes, countries and limits; only `taxYear` differs.
 */
export const LAYOUT_2025: YearLayout = deepFreeze({ ...LAYOUT_2024, taxYear: 2025 });
