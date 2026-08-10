import { z } from 'zod';
import type {
  McpGetDocumentsQuery,
  McpGetDocumentsQueryVariables,
  McpSearchDocumentsByFiltersQuery,
  McpSearchDocumentsByFiltersQueryVariables,
} from '../gql/index.js';
import { TIMELESS_DATE } from './dates.js';
import { MAX_DETAIL_IDS, normalizeDocument, type RawDocument } from './entity-shapes.js';
import { shapeListResult } from './output.js';
import type { ToolDefinition, ToolExecutionContext, ToolResult } from './registry.js';
import { memberBusinessIdsInput, SCOPE_DESCRIPTION_SUFFIX } from './scope-input.js';

/**
 * Detail tool: fetch documents (invoices, receipts, …) by id (spec §8.2).
 *
 * Read-only. Upstream RLS narrows the fetch to the caller's authorized
 * businesses (scope forwarded as `x-business-scope` on `context.upstream`); as
 * defense-in-depth — mirroring `charges.ts` — any document whose owning charge
 * resolves to an owner outside the resolved read scope is dropped before the
 * result is shaped, so the tool stays correct even if upstream ever runs under
 * a scope-bypassing role.
 */

export const GET_DOCUMENTS_TOOL_NAME = 'accounter_get_documents';

const DOCUMENT_FILTER_IDS_CAP = 300;

export const DOCUMENT_TYPES = [
  'INVOICE',
  'RECEIPT',
  'INVOICE_RECEIPT',
  'CREDIT_INVOICE',
  'PROFORMA',
  'UNPROCESSED',
  'OTHER',
] as const;

function optionalNonEmptyStringArray(max: number) {
  return z.preprocess(
    value => (Array.isArray(value) && value.length === 0 ? undefined : value),
    z.array(z.string().min(1)).min(1).max(max).optional(),
  );
}

/**
 * Upstream `DocumentsFilters` fields exposed under a different name, mapped
 * `upstream field → tool input field`. The upstream `*IDs` spellings are
 * camel-cased here to match every other tool input; the schema-contract test
 * reads this map so a new upstream field cannot go unexposed.
 */
export const DOCUMENTS_FILTER_ALIASES = {
  businessIDs: 'businessIds',
  ownerIDs: 'ownerIds',
  chargeIDs: 'chargeIds',
} as const;

export const documentsFiltersInput = z
  .object({
    // NOT the scope field: this is the upstream `businessIDs` predicate, which
    // matches documents whose *counterparty* (creditor or debtor) is one of these
    // businesses. Scope narrowing is `memberBusinessIds`, below.
    businessIds: optionalNonEmptyStringArray(DOCUMENT_FILTER_IDS_CAP)
      .optional()
      .describe(
        'Include only documents whose creditor or debtor is one of these businesses. This is a ' +
          'counterparty filter — use `memberBusinessIds` to narrow which of your businesses to search.',
      ),
    ownerIds: optionalNonEmptyStringArray(DOCUMENT_FILTER_IDS_CAP)
      .optional()
      .describe('Include only documents owned by these business ids.'),
    chargeIds: optionalNonEmptyStringArray(DOCUMENT_FILTER_IDS_CAP)
      .optional()
      .describe('Include only documents linked to these charge ids.'),
    fromDate: TIMELESS_DATE.optional().describe('Only documents dated on/after this date.'),
    toDate: TIMELESS_DATE.optional().describe('Only documents dated on/before this date.'),
    unmatched: z
      .boolean()
      .optional()
      .describe('Include only documents without matching transactions.'),
    type: z
      .preprocess(
        value => (Array.isArray(value) && value.length === 0 ? undefined : value),
        z.array(z.enum(DOCUMENT_TYPES)).min(1).max(DOCUMENT_TYPES.length).optional(),
      )
      .optional()
      .describe('Include only these document types.'),
    missingCounterparty: z
      .boolean()
      .optional()
      .describe('Include only documents with missing creditor/debtor.'),
    missingInfo: z
      .boolean()
      .optional()
      .describe('Include only documents that fail validation checks.'),
    freeText: z
      .string()
      .min(1)
      .max(200)
      .optional()
      .describe(
        'Free text search across serial number, amount, description, remarks, and party names.',
      ),
  })
  .strict();

const getDocumentsInput = z
  .object({
    documentIds: optionalNonEmptyStringArray(MAX_DETAIL_IDS)
      .optional()
      .describe(
        `The document ids to fetch (1–${MAX_DETAIL_IDS}). Discover ids via accounter_get_charges ` +
          '(each charge lists its documents).',
      ),
    filters: documentsFiltersInput
      .optional()
      .describe('Filter documents by any supported documentsByFilters predicate.'),
    memberBusinessIds: memberBusinessIdsInput,
  })
  .superRefine((value, context) => {
    const hasIds = value.documentIds !== undefined && value.documentIds.length > 0;
    const hasFilters =
      value.filters !== undefined &&
      Object.values(value.filters).some(filterValue => filterValue !== undefined);
    if (!hasIds && !hasFilters) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['documentIds'],
        message: 'Provide documentIds, filters, or both.',
      });
    }
  });

type GetDocumentsInput = z.infer<typeof getDocumentsInput>;

type DocumentsFiltersInput = z.infer<typeof documentsFiltersInput>;

const DOCUMENTS_QUERY_DOCUMENT = /* GraphQL */ `
  fragment McpDocumentDetailsFields on Document {
    __typename
    id
    ownerId
    documentType
    ... on FinancialDocument {
      serialNumber
      date
      amount {
        raw
        formatted
        currency
      }
      vat {
        raw
        formatted
        currency
      }
      creditor {
        id
        name
      }
      debtor {
        id
        name
      }
    }
    ... on Unprocessed {
      serialNumber
      date
      amount {
        raw
        formatted
        currency
      }
      vat {
        raw
        formatted
        currency
      }
      creditor {
        id
        name
      }
      debtor {
        id
        name
      }
    }
    ... on OtherDocument {
      serialNumber
      date
      amount {
        raw
        formatted
        currency
      }
      vat {
        raw
        formatted
        currency
      }
      creditor {
        id
        name
      }
      debtor {
        id
        name
      }
    }
    description
    file
    image
    charge {
      id
    }
  }

  query McpGetDocuments($documentIds: [UUID!]!) {
    documentsByIds(documentIds: $documentIds) {
      ...McpDocumentDetailsFields
    }
  }

  query McpSearchDocumentsByFilters($filters: DocumentsFilters!) {
    documentsByFilters(filters: $filters) {
      ...McpDocumentDetailsFields
    }
  }
`;

function intersectOwners(
  requested: readonly string[] | undefined,
  scopeBusinessIds: readonly string[],
): string[] {
  const scopeSet = new Set(scopeBusinessIds);
  if (!requested || requested.length === 0) {
    return [...scopeBusinessIds];
  }
  return requested.filter(id => scopeSet.has(id));
}

function buildDocumentsFilters(
  input: DocumentsFiltersInput,
  scopeBusinessIds: readonly string[],
): McpSearchDocumentsByFiltersQueryVariables['filters'] {
  const ownerIds = intersectOwners(input.ownerIds, scopeBusinessIds);
  const filters: McpSearchDocumentsByFiltersQueryVariables['filters'] = {
    ownerIDs: ownerIds,
  };
  if (input.businessIds) filters.businessIDs = [...input.businessIds];
  if (input.chargeIds) filters.chargeIDs = [...input.chargeIds];
  if (input.fromDate) filters.fromDate = input.fromDate;
  if (input.toDate) filters.toDate = input.toDate;
  if (input.unmatched !== undefined) filters.unmatched = input.unmatched;
  if (input.type) filters.type = [...input.type];
  if (input.missingCounterparty !== undefined) {
    filters.missingCounterparty = input.missingCounterparty;
  }
  if (input.missingInfo !== undefined) filters.missingInfo = input.missingInfo;
  if (input.freeText) filters.freeText = input.freeText;
  return filters;
}

async function handler(
  input: GetDocumentsInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const hasDocumentIds = input.documentIds !== undefined && input.documentIds.length > 0;
  const hasFilters =
    input.filters !== undefined &&
    Object.values(input.filters).some(filterValue => filterValue !== undefined);
  const usingIds = hasDocumentIds && !hasFilters;
  const data = usingIds
    ? await context.client.query<McpGetDocumentsQuery>(
        {
          query: DOCUMENTS_QUERY_DOCUMENT,
          operationName: 'McpGetDocuments',
          variables: { documentIds: input.documentIds! } satisfies McpGetDocumentsQueryVariables,
        },
        context.upstream,
      )
    : await context.client.query<McpSearchDocumentsByFiltersQuery>(
        {
          query: DOCUMENTS_QUERY_DOCUMENT,
          operationName: 'McpSearchDocumentsByFilters',
          variables: {
            filters: buildDocumentsFilters(
              input.filters ?? {},
              context.readScope.memberBusinessIds,
            ),
          } satisfies McpSearchDocumentsByFiltersQueryVariables,
        },
        context.upstream,
      );

  const scopeIds = new Set(context.readScope.memberBusinessIds);
  const raw = (
    usingIds
      ? (data as McpGetDocumentsQuery).documentsByIds
      : (data as McpSearchDocumentsByFiltersQuery).documentsByFilters
  ) as RawDocument[];
  const requestedDocumentIds = hasDocumentIds ? new Set(input.documentIds) : null;
  const documents = raw
    .filter(document => requestedDocumentIds === null || requestedDocumentIds.has(document.id))
    // Defense-in-depth owner filter on top of RLS: keep a document only when its
    // own `ownerId` is in the resolved scope. This reads the document's owner
    // directly rather than its charge's — a document carries `ownerId: UUID!`
    // upstream, so the charge join is neither needed nor always present.
    .filter(document => scopeIds.has(document.ownerId))
    .map(normalizeDocument);

  return shapeListResult({
    items: documents,
    itemsKey: 'documents',
    total: documents.length,
    extra: { scope: { memberBusinessIds: context.readScope.memberBusinessIds } },
    summarize: (shown, total) =>
      total === 0
        ? usingIds
          ? 'No documents were found for the given ids (they may be outside your authorized businesses).'
          : 'No documents matched the given filters.'
        : `Found ${total} document(s)${shown < total ? ` (showing ${shown})` : ''}.`,
  });
}

export const getDocumentsTool: ToolDefinition<typeof getDocumentsInput> = {
  name: GET_DOCUMENTS_TOOL_NAME,
  description:
    'Fetch documents (invoices, receipts, credit invoices, …) either by id or by filters (owners, charge ids, date range, type, unmatched/missing-info flags, and free-text), with type, serial number, date, amount, VAT, creditor/debtor, file/image links, and the owning business (`ownerId`). Read-only. ' +
    SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: getDocumentsInput,
  policy: { requiresBusinessScope: true, dataClassification: 'business' },
  handler,
};
