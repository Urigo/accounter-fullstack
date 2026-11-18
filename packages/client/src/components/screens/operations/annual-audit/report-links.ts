import type { TimelessDateString } from '@/helpers/index.js';
import { ROUTES } from '@/router/routes.js';

/** Balance Sheet: cumulative from the beginning of time to the end of the audited year. */
export function balanceSheetHref(
  ownerId: string | undefined,
  year: number,
  templateName: string,
): string {
  return ROUTES.REPORTS.DYNAMIC_REPORT({
    ownerIds: ownerId ? [ownerId] : undefined,
    fromDate: '1900-01-01' as TimelessDateString,
    toDate: `${year}-12-31` as TimelessDateString,
    templateName,
  });
}

/** Profit and Loss: the audited year only. */
export function profitAndLossHref(
  ownerId: string | undefined,
  year: number,
  templateName: string,
): string {
  return ROUTES.REPORTS.DYNAMIC_REPORT({
    ownerIds: ownerId ? [ownerId] : undefined,
    fromDate: `${year}-01-01` as TimelessDateString,
    toDate: `${year}-12-31` as TimelessDateString,
    templateName,
  });
}
