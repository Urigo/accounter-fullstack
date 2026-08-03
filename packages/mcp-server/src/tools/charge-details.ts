import { z } from 'zod';
import type {
  McpGetChargesByFiltersQuery,
  McpGetChargesByFiltersQueryVariables,
  McpGetChargesQuery,
  McpGetChargesQueryVariables,
} from '../gql/index.js';
import { UpstreamError } from '../upstream/graphql-client.js';
import { TIMELESS_DATE } from './dates.js';
import {
  normalizeAmount,
  normalizeDocument,
  normalizeEntity,
  normalizeTransaction,
  type NormalizedDocument,
  type NormalizedTransaction,
  type RawDocument,
  type RawTransaction,
} from './entity-shapes.js';
import { shapeListResult } from './output.js';
import type { ToolDefinition, ToolExecutionContext, ToolResult } from './registry.js';
import { businessIdsInput, SCOPE_DESCRIPTION_SUFFIX } from './scope-input.js';

/**
 * Detail tool: fetch charges by id with their transactions and documents
 * (spec §8.2).
 *
 * Read-only. Results are narrowed to the caller's authorized businesses by
 * upstream RLS (the resolved read scope travels as `x-business-scope`); as
 * defense-in-depth — mirroring `charges.ts` — any charge whose `owner` falls
 * outside the resolved read scope is dropped before shaping.
 *
 * Charges nest transactions and documents, so a single charge can be large.
 * The id cap is deliberately lower than the other detail tools, and
 * `includeTransactions` / `includeDocuments` let a caller trade nesting for
 * more charges per call. `shapeListResult` still applies the byte budget,
 * dropping whole trailing charges if the payload is too big.
 */

export const GET_CHARGES_TOOL_NAME = 'accounter_get_charges';

/** Lower than the flat detail tools because each charge nests its children. */
export const MAX_CHARGE_IDS = 300;

const CHARGE_FILTER_IDS_CAP = 300;
const CHARGE_FILTER_TAGS_CAP = 50;
const CHARGE_FILTER_TEXT_MAX = 200;
const MAX_FILTERED_CHARGES = 300;

function optionalNonEmptyStringArray(max: number) {
  return z.preprocess(
    value => (Array.isArray(value) && value.length === 0 ? undefined : value),
    z.array(z.string().min(1)).min(1).max(max).optional(),
  );
}

const chargeSortByInput = z
  .object({
    field: z.enum(['DATE', 'AMOUNT', 'ABS_AMOUNT']),
    asc: z.boolean().optional(),
  })
  .strict();

const chargeFiltersInput = z
  .object({
    accountantStatus: z
      .preprocess(
        value => (Array.isArray(value) && value.length === 0 ? undefined : value),
        z
          .array(z.enum(['APPROVED', 'PENDING', 'UNAPPROVED']))
          .min(1)
          .max(3)
          .optional(),
      )
      .optional(),
    businessTrip: z.string().min(1).optional(),
    byBusinessTrips: optionalNonEmptyStringArray(CHARGE_FILTER_IDS_CAP).optional(),
    byBusinesses: optionalNonEmptyStringArray(CHARGE_FILTER_IDS_CAP).optional(),
    byChargeTypes: z
      .preprocess(
        value => (Array.isArray(value) && value.length === 0 ? undefined : value),
        z
          .array(
            z.enum([
              'COMMON',
              'CONVERSION',
              'PAYROLL',
              'INTERNAL',
              'DIVIDEND',
              'BUSINESS_TRIP',
              'VAT',
              'BANK_DEPOSIT',
              'FOREIGN_SECURITIES',
              'CREDITCARD_BANK',
              'FINANCIAL',
            ]),
          )
          .min(1)
          .max(11)
          .optional(),
      )
      .optional(),
    byFinancialAccounts: optionalNonEmptyStringArray(CHARGE_FILTER_IDS_CAP).optional(),
    byOwners: optionalNonEmptyStringArray(CHARGE_FILTER_IDS_CAP).optional(),
    byTags: optionalNonEmptyStringArray(CHARGE_FILTER_TAGS_CAP).optional(),
    chargesType: z.enum(['ALL', 'INCOME', 'EXPENSE']).optional(),
    freeText: z.string().min(1).max(CHARGE_FILTER_TEXT_MAX).optional(),
    fromAnyDate: TIMELESS_DATE.optional(),
    fromDate: TIMELESS_DATE.optional(),
    sortBy: chargeSortByInput.optional(),
    toAnyDate: TIMELESS_DATE.optional(),
    toDate: TIMELESS_DATE.optional(),
    unbalanced: z.boolean().optional(),
    withMissingCounterparty: z.boolean().optional(),
    withOpenDocuments: z.boolean().optional(),
    withoutDocuments: z.boolean().optional(),
    withoutInvoice: z.boolean().optional(),
    withoutLedger: z.boolean().optional(),
    withoutReceipt: z.boolean().optional(),
    withoutTransactions: z.boolean().optional(),
  })
  .strict();

const getChargesInput = z
  .object({
    chargeIds: optionalNonEmptyStringArray(MAX_CHARGE_IDS)
      .optional()
      .describe(
        `The charge ids to fetch (1–${MAX_CHARGE_IDS}). Discover ids via accounter_search_charges.`,
      ),
    filters: chargeFiltersInput
      .optional()
      .describe('Filter charges by any supported ChargeFilter predicate.'),
    businessIds: businessIdsInput,
    includeTransactions: z
      .boolean()
      .optional()
      .default(true)
      .describe('Include each charge’s linked transactions (default true).'),
    includeDocuments: z
      .boolean()
      .optional()
      .default(true)
      .describe('Include each charge’s linked documents (default true).'),
  })
  .superRefine((value, context) => {
    const hasIds = value.chargeIds !== undefined && value.chargeIds.length > 0;
    const hasFilters =
      value.filters !== undefined &&
      Object.values(value.filters).some(filterValue => filterValue !== undefined);
    if (!hasIds && !hasFilters) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['chargeIds'],
        message: 'Provide chargeIds, filters, or both.',
      });
    }
  });

type GetChargesInput = z.infer<typeof getChargesInput>;

const CHARGES_QUERY_DOCUMENT = /* GraphQL */ `
  fragment McpChargeDetailTransactionFields on Transaction {
    __typename
    id
    chargeId
    eventDate
    effectiveDate
    direction
    amount {
      raw
      formatted
      currency
    }
    sourceDescription
    isFee
    counterparty {
      id
      name
    }
    account {
      id
      name
    }
  }

  fragment McpChargeDetailDocumentFields on Document {
    __typename
    id
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

  fragment McpChargeDetailFields on Charge {
    id
    userDescription
    owner {
      id
      name
    }
    counterparty {
      id
      name
    }
    totalAmount {
      raw
      formatted
      currency
    }
    vat {
      raw
      formatted
      currency
    }
    withholdingTax {
      raw
      formatted
      currency
    }
    minEventDate
    maxEventDate
    minDebitDate
    maxDebitDate
    minDocumentsDate
    maxDocumentsDate
    tags {
      id
      name
    }
    metadata {
      createdAt
      updatedAt
      invoicesCount
      receiptsCount
      documentsCount
      transactionsCount
      ledgerCount
      miscExpensesCount
      openDocuments
      invalidLedger
    }
    transactions @include(if: $includeTransactions) {
      ...McpChargeDetailTransactionFields
    }
    additionalDocuments @include(if: $includeDocuments) {
      ...McpChargeDetailDocumentFields
    }
  }

  query McpGetCharges(
    $chargeIDs: [UUID!]!
    $includeTransactions: Boolean!
    $includeDocuments: Boolean!
  ) {
    chargesByIDs(chargeIDs: $chargeIDs) {
      ...McpChargeDetailFields
    }
  }

  query McpGetChargesByFilters(
    $filters: ChargeFilter
    $page: Int!
    $limit: Int!
    $includeTransactions: Boolean!
    $includeDocuments: Boolean!
  ) {
    allCharges(filters: $filters, page: $page, limit: $limit) {
      nodes {
        ...McpChargeDetailFields
      }
      pageInfo {
        totalPages
        totalRecords
        currentPage
        pageSize
      }
    }
  }
`;

type ChargeFiltersInput = z.infer<typeof chargeFiltersInput>;

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

function buildChargeFilters(
  input: ChargeFiltersInput,
  scopeBusinessIds: readonly string[],
): NonNullable<McpGetChargesByFiltersQueryVariables['filters']> {
  const filters: NonNullable<McpGetChargesByFiltersQueryVariables['filters']> = {
    byOwners: intersectOwners(input.byOwners, scopeBusinessIds),
  };
  if (input.accountantStatus) filters.accountantStatus = [...input.accountantStatus];
  if (input.businessTrip) filters.businessTrip = input.businessTrip;
  if (input.byBusinessTrips) filters.byBusinessTrips = [...input.byBusinessTrips];
  if (input.byBusinesses) filters.byBusinesses = [...input.byBusinesses];
  if (input.byChargeTypes) filters.byChargeTypes = [...input.byChargeTypes];
  if (input.byFinancialAccounts) filters.byFinancialAccounts = [...input.byFinancialAccounts];
  if (input.byTags) filters.byTags = [...input.byTags];
  if (input.chargesType) filters.chargesType = input.chargesType;
  if (input.freeText) filters.freeText = input.freeText;
  if (input.fromAnyDate) filters.fromAnyDate = input.fromAnyDate;
  if (input.fromDate) filters.fromDate = input.fromDate;
  if (input.sortBy) filters.sortBy = { ...input.sortBy };
  if (input.toAnyDate) filters.toAnyDate = input.toAnyDate;
  if (input.toDate) filters.toDate = input.toDate;
  if (input.unbalanced !== undefined) filters.unbalanced = input.unbalanced;
  if (input.withMissingCounterparty !== undefined) {
    filters.withMissingCounterparty = input.withMissingCounterparty;
  }
  if (input.withOpenDocuments !== undefined) filters.withOpenDocuments = input.withOpenDocuments;
  if (input.withoutDocuments !== undefined) filters.withoutDocuments = input.withoutDocuments;
  if (input.withoutInvoice !== undefined) filters.withoutInvoice = input.withoutInvoice;
  if (input.withoutLedger !== undefined) filters.withoutLedger = input.withoutLedger;
  if (input.withoutReceipt !== undefined) filters.withoutReceipt = input.withoutReceipt;
  if (input.withoutTransactions !== undefined) {
    filters.withoutTransactions = input.withoutTransactions;
  }
  return filters;
}

function isNotFoundByIdUpstreamError(error: unknown): boolean {
  if (!(error instanceof UpstreamError) || error.code !== 'UPSTREAM_ERROR') {
    return false;
  }
  return (
    /^Charge ID=".+" not found$/i.test(error.message) ||
    /^Couldn't find any charges$/i.test(error.message)
  );
}

type RawCharge = McpGetChargesQuery['chargesByIDs'][number];

interface NormalizedCharge {
  id: string;
  description: string | null;
  ownerId: string | null;
  ownerName: string | null;
  counterparty: { id: string; name: string | null } | null;
  totalAmount: ReturnType<typeof normalizeAmount>;
  vat: ReturnType<typeof normalizeAmount>;
  withholdingTax: ReturnType<typeof normalizeAmount>;
  dates: {
    minEventDate: string | null;
    maxEventDate: string | null;
    minDebitDate: string | null;
    maxDebitDate: string | null;
    minDocumentsDate: string | null;
    maxDocumentsDate: string | null;
  };
  tags: Array<{ id: string; name: string }>;
  metadata: Record<string, unknown> | null;
  transactions: NormalizedTransaction[];
  documents: NormalizedDocument[];
}

function normalizeCharge(charge: RawCharge): NormalizedCharge {
  const owner = normalizeEntity(charge.owner);
  return {
    id: charge.id,
    description: charge.userDescription ?? null,
    ownerId: owner?.id ?? null,
    ownerName: owner?.name ?? null,
    counterparty: normalizeEntity(charge.counterparty),
    totalAmount: normalizeAmount(charge.totalAmount),
    vat: normalizeAmount(charge.vat),
    withholdingTax: normalizeAmount(charge.withholdingTax),
    dates: {
      minEventDate: charge.minEventDate ?? null,
      maxEventDate: charge.maxEventDate ?? null,
      minDebitDate: charge.minDebitDate ?? null,
      maxDebitDate: charge.maxDebitDate ?? null,
      minDocumentsDate: charge.minDocumentsDate ?? null,
      maxDocumentsDate: charge.maxDocumentsDate ?? null,
    },
    tags: (charge.tags ?? []).map(tag => ({ id: tag.id, name: tag.name })),
    metadata: charge.metadata ? { ...charge.metadata } : null,
    transactions: (charge.transactions ?? []).map(raw =>
      normalizeTransaction(raw as RawTransaction),
    ),
    documents: (charge.additionalDocuments ?? []).map(raw => normalizeDocument(raw as RawDocument)),
  };
}

async function handler(input: GetChargesInput, context: ToolExecutionContext): Promise<ToolResult> {
  const hasChargeIds = input.chargeIds !== undefined && input.chargeIds.length > 0;
  const hasFilters =
    input.filters !== undefined &&
    Object.values(input.filters).some(filterValue => filterValue !== undefined);
  const usingIds = hasChargeIds && !hasFilters;

  const byIdsData = usingIds
    ? await context.client
        .query<McpGetChargesQuery>(
          {
            query: CHARGES_QUERY_DOCUMENT,
            operationName: 'McpGetCharges',
            variables: {
              chargeIDs: input.chargeIds!,
              includeTransactions: input.includeTransactions,
              includeDocuments: input.includeDocuments,
            } satisfies McpGetChargesQueryVariables,
          },
          context.upstream,
        )
        .catch(error => {
          // Upstream `chargesByIDs` throws for any missing id. Normalize this
          // specific not-found condition to an empty success result so callers
          // get consistent read semantics for out-of-scope/unknown ids.
          if (isNotFoundByIdUpstreamError(error)) {
            return { chargesByIDs: [] } satisfies McpGetChargesQuery;
          }
          throw error;
        })
    : null;

  const filteredData = usingIds
    ? null
    : await context.client.query<McpGetChargesByFiltersQuery>(
        {
          query: CHARGES_QUERY_DOCUMENT,
          operationName: 'McpGetChargesByFilters',
          variables: {
            filters: buildChargeFilters(input.filters ?? {}, context.readScope.businessIds),
            page: 0,
            limit: MAX_FILTERED_CHARGES,
            includeTransactions: input.includeTransactions,
            includeDocuments: input.includeDocuments,
          } satisfies McpGetChargesByFiltersQueryVariables,
        },
        context.upstream,
      );

  const rawCharges = usingIds
    ? (byIdsData?.chargesByIDs ?? [])
    : (filteredData?.allCharges.nodes ?? []);
  const requestedChargeIds = hasChargeIds ? new Set(input.chargeIds) : null;

  const scopeIds = new Set(context.readScope.businessIds);
  const charges = rawCharges
    .filter(charge => requestedChargeIds === null || requestedChargeIds.has(charge.id))
    // Defense-in-depth owner filter (see `charges.ts`): keep a charge only when
    // its owner is in the resolved read scope. A charge with no resolvable owner
    // is kept — RLS already returned it and there is no owner to reject it by.
    .filter(charge => {
      const ownerId = charge.owner?.id;
      return ownerId == null || scopeIds.has(ownerId);
    })
    .map(normalizeCharge);

  const total =
    charges.length === 0
      ? 0
      : !usingIds && !hasChargeIds
        ? (filteredData?.allCharges.pageInfo.totalRecords ?? charges.length)
        : charges.length;

  return shapeListResult({
    items: charges,
    itemsKey: 'charges',
    total,
    extra: { scope: { businessIds: context.readScope.businessIds } },
    summarize: (shown, total) =>
      total === 0
        ? usingIds
          ? 'No charges were found for the given ids (they may be outside your authorized businesses).'
          : 'No charges matched the given filters.'
        : `Found ${total} charge(s)${shown < total ? ` (showing ${shown})` : ''}.`,
  });
}

export const getChargesTool: ToolDefinition<typeof getChargesInput> = {
  name: GET_CHARGES_TOOL_NAME,
  description:
    'Fetch charges by id and/or by filters (all ChargeFilter fields), with full detail: owner, counterparty, amounts (total, VAT, withholding), dates, tags, metadata counts, and — by default — linked transactions and documents. Read-only. ' +
    SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: getChargesInput,
  policy: { requiresBusinessScope: true, dataClassification: 'business' },
  handler,
};
