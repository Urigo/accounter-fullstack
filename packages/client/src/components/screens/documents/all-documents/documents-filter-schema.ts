import { z } from 'zod';
import { DocumentType, type DocumentsFilters } from '../../../../gql/graphql.js';
import type { TimelessDateString } from '../../../../helpers/dates.js';
import { TIMELESS_DATE_REGEX } from '../../../../helpers/index.js';

/** URL query parameter the applied filter is persisted under. */
export const DOCUMENTS_FILTER_PARAM = 'documentsFilters';

const timelessDateString = z.custom<TimelessDateString>(
  value => typeof value === 'string' && TIMELESS_DATE_REGEX.test(value),
);

/**
 * The applied filter as read back from the URL: every `DocumentsFilters` field, typed as the
 * server takes it (ids as UUIDs), so a stale or hand-edited link falls back to no filter instead
 * of failing the query.
 */
export const documentsFilterUrlSchema: z.ZodType<DocumentsFilters> = z.object({
  businessIDs: z.array(z.guid()).optional(),
  chargeIDs: z.array(z.guid()).optional(),
  freeText: z.string().optional(),
  fromDate: timelessDateString.optional(),
  missingCounterparty: z.boolean().optional(),
  missingInfo: z.boolean().optional(),
  ownerIDs: z.array(z.guid()).optional(),
  toDate: timelessDateString.optional(),
  type: z.array(z.enum(DocumentType)).optional(),
  unmatched: z.boolean().optional(),
});
