import type { DepreciationReportFilter } from '../../../../gql/graphql.js';
import { isObjectEmpty } from '../../../../helpers/index.js';

export const DEPRECIATION_REPORT_FILTERS_QUERY_PARAM = 'depreciationReportFilters';

export function encodeDepreciationReportFilters(
  filter?: DepreciationReportFilter | null,
): string | null {
  return !filter || isObjectEmpty(filter) ? null : encodeURIComponent(JSON.stringify(filter));
}
