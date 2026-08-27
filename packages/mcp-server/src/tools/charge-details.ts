import { z } from 'zod';
import type {
  McpGetChargesByFiltersQuery,
  McpGetChargesByFiltersQueryVariables,
  McpGetChargesQuery,
  McpGetChargesQueryVariables,
} from '../gql/index.js';
import { UpstreamError } from '../upstream/graphql-client.js';
import {
  buildChargeFilters,
  chargeFiltersInput,
  hasAnyChargeFilter,
  optionalNonEmptyStringArray,
} from './charge-filters.js';
import {
  chargeTypeFromTypename,
  normalizeAmount,
  normalizeDocument,
  normalizeEntity,
  normalizeTransaction,
  type NormalizedDocument,
  type NormalizedTransaction,
  type RawDocument,
  type RawTransaction,
} from './entity-shapes.js';
import { resultEnvelopeDescription, shapeListResult } from './output.js';
import type { ToolDefinition, ToolExecutionContext, ToolResult } from './registry.js';
import { memberBusinessIdsInput, SCOPE_DESCRIPTION_SUFFIX } from './scope-input.js';

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

/** Cap on charges returned per page of a filtered (non-id) request. */
export const MAX_FILTERED_CHARGES = 300;

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
    memberBusinessIds: memberBusinessIdsInput,
    // `allCharges` is paginated upstream, and the previous version pinned it to
    // the first page: a filter matching more than `MAX_FILTERED_CHARGES` charges
    // had no way to reach the rest, and nothing said so. Exposed here as the
    // same 1-based `page`/`pageSize` pair `accounter_search_charges` uses, and
    // the response echoes `pagination` so the model can walk the pages.
    page: z
      .number()
      .int()
      .positive()
      .optional()
      .default(1)
      .describe('1-based page of filtered results. Ignored when fetching by `chargeIds`.'),
    pageSize: z
      .number()
      .int()
      .positive()
      .max(MAX_FILTERED_CHARGES)
      .optional()
      .default(MAX_FILTERED_CHARGES)
      .describe(
        `Charges per page (1–${MAX_FILTERED_CHARGES}). Ignored when fetching by \`chargeIds\`. ` +
          'Lower it when including transactions/documents, since nesting them can trip the payload guard.',
      ),
    includeTransactions: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        'Include each charge’s linked transactions (default false — opt in only when you need the ' +
          'individual bank/card rows, since nesting them is what forces results to be truncated).',
      ),
    includeDocuments: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        'Include each charge’s linked documents (default false — opt in only when you need the ' +
          'individual invoices/receipts).',
      ),
    includeSecurities: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        'For foreign-securities charges, include the security traded and the portfolio executions ' +
          'behind the cash movement (default false). Only such charges carry it; every other type is ' +
          'unaffected. Each security also reports its `securityBusinessId`, which is what ' +
          'accounter_list_security_holdings and accounter_get_security_executions are addressed by. ' +
          'Nesting executions multiplies the payload, so pair it with explicit `chargeIds` or a small ' +
          '`pageSize`.',
      ),
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
    ownerId
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

  fragment McpChargeDetailFields on Charge {
    __typename
    id
    ownerId
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
    ... on ForeignSecuritiesCharge {
      securities @include(if: $includeSecurities) {
        securityKey
        securityBusiness {
          id
          ownerId
          isin
          symbol
          engName
        }
        details {
          key
          engName
          symbol
          itemType
          exchange
          currencyCode
          asOfDate
        }
        executions {
          id
          tradeDate
          valueDate
          tradeType
          transactionType
          paymentType
          quantity
          tradePrice
          netValue {
            raw
            formatted
            currency
          }
          tradeCommission {
            raw
            formatted
            currency
          }
          israelTaxValue {
            raw
            formatted
            currency
          }
        }
      }
    }
  }

  query McpGetCharges(
    $chargeIDs: [UUID!]!
    $includeTransactions: Boolean!
    $includeDocuments: Boolean!
    $includeSecurities: Boolean!
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
    $includeSecurities: Boolean!
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
/**
 * The securities block hangs off the `ForeignSecuritiesCharge` member of the union
 * only — unlike `transactions` and `additionalDocuments`, which the `Charge`
 * interface declares for every member — so it has to be narrowed rather than read.
 */
type RawSecuritiesCharge = Extract<RawCharge, { __typename: 'ForeignSecuritiesCharge' }>;
type RawChargeSecurity = NonNullable<RawSecuritiesCharge['securities']>[number];

/**
 * Undefined for any charge that is not a securities one, and for a securities
 * charge fetched without `includeSecurities` — `@include(if:)` omits the field
 * entirely, so both read as "not asked for", which is what the payload says.
 */
function rawChargeSecurities(charge: RawCharge): readonly RawChargeSecurity[] | undefined {
  return 'securities' in charge ? charge.securities : undefined;
}

interface NormalizedCharge {
  id: string;
  description: string | null;
  /** Same vocabulary as `filters.byChargeTypes`, so it can be fed back as a filter. */
  chargeType: string | null;
  ownerId: string;
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
  /** Present only for a securities charge fetched with `includeSecurities`. */
  securities?: Array<ReturnType<typeof normalizeChargeSecurity>>;
}

/**
 * One security a charge's transaction descriptions referenced, plus the trades
 * behind the cash movement.
 *
 * `details` is the ingested reference row and is legitimately null: the feed can
 * be out of date, and saying so is more useful than dropping the key. Descriptors
 * come from the security *business* where both have them — its `currencyCode` is
 * the resolved `Currency` enum, while the reference feed's is a raw source string
 * that can still be a Hebrew label.
 */
function normalizeChargeSecurity(security: RawChargeSecurity) {
  return {
    securityKey: security.securityKey,
    securityBusinessId: security.securityBusiness?.id ?? null,
    isin: security.securityBusiness?.isin ?? null,
    symbol: security.securityBusiness?.symbol ?? security.details?.symbol ?? null,
    name: security.securityBusiness?.engName ?? security.details?.engName ?? null,
    exchange: security.details?.exchange ?? null,
    itemType: security.details?.itemType ?? null,
    referenceAsOf: security.details?.asOfDate ?? null,
    referenceFound: security.details != null,
    executions: security.executions.map(execution => ({
      executionId: execution.id,
      tradeDate: execution.tradeDate,
      valueDate: execution.valueDate,
      tradeType: execution.tradeType,
      transactionType: execution.transactionType,
      paymentType: execution.paymentType,
      quantity: execution.quantity,
      tradePrice: execution.tradePrice,
      netValue: normalizeAmount(execution.netValue),
      tradeCommission: normalizeAmount(execution.tradeCommission),
      israelTaxValue: normalizeAmount(execution.israelTaxValue),
    })),
  };
}

function normalizeCharge(charge: RawCharge): NormalizedCharge {
  const owner = normalizeEntity(charge.owner);
  const securities = rawChargeSecurities(charge);
  return {
    id: charge.id,
    description: charge.userDescription ?? null,
    chargeType: chargeTypeFromTypename(charge.__typename),
    ownerId: charge.ownerId,
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
    // Absent unless asked for and unless this charge is a securities one, so
    // "not a securities charge" stays distinguishable from "an empty list of
    // securities" — which is itself a real state, meaning the descriptions
    // carried no key the ingested feed knows.
    ...(securities === undefined ? {} : { securities: securities.map(normalizeChargeSecurity) }),
  };
}

async function handler(input: GetChargesInput, context: ToolExecutionContext): Promise<ToolResult> {
  const hasChargeIds = input.chargeIds !== undefined && input.chargeIds.length > 0;
  const hasFilters = hasAnyChargeFilter(input.filters);
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
              includeSecurities: input.includeSecurities,
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
            filters: buildChargeFilters(input.filters ?? {}, context.readScope.memberBusinessIds),
            // Upstream `allCharges` is 0-based (it slices `[page * limit, …]`),
            // so translate the 1-based input page here.
            page: input.page - 1,
            limit: input.pageSize,
            includeTransactions: input.includeTransactions,
            includeDocuments: input.includeDocuments,
            includeSecurities: input.includeSecurities,
          } satisfies McpGetChargesByFiltersQueryVariables,
        },
        context.upstream,
      );

  const rawCharges = usingIds
    ? (byIdsData?.chargesByIDs ?? [])
    : (filteredData?.allCharges.nodes ?? []);
  const requestedChargeIds = hasChargeIds ? new Set(input.chargeIds) : null;

  const scopeIds = new Set(context.readScope.memberBusinessIds);
  const charges = rawCharges
    .filter(charge => requestedChargeIds === null || requestedChargeIds.has(charge.id))
    // Defense-in-depth owner filter (see `charges.ts`): keep a charge only when
    // its owner is in the resolved read scope. A charge with no resolvable owner
    // is kept — RLS already returned it and there is no owner to reject it by.
    .filter(charge => {
      const ownerId = charge.ownerId;
      return scopeIds.has(ownerId);
    })
    .map(normalizeCharge);

  const total =
    charges.length === 0
      ? 0
      : !usingIds && !hasChargeIds
        ? (filteredData?.allCharges.pageInfo.totalRecords ?? charges.length)
        : charges.length;

  // Only a filtered request is paginated; a by-id request returns exactly the
  // ids asked for, so reporting a page over it would be meaningless.
  const pageInfo = usingIds ? null : filteredData?.allCharges.pageInfo;
  const pagination = pageInfo
    ? {
        // Reported from the request, not the response: upstream `allCharges`
        // returns only `totalPages`/`totalRecords`, and its `currentPage` — when
        // some other field resolver does populate it — is the 0-based index it
        // was given, which would read as an off-by-one page number here.
        page: input.page,
        pageSize: input.pageSize,
        totalPages: pageInfo.totalPages,
        hasNextPage: input.page < pageInfo.totalPages,
      }
    : null;

  return shapeListResult({
    items: charges,
    itemsKey: 'charges',
    total,
    extra: {
      scope: { memberBusinessIds: context.readScope.memberBusinessIds },
      ...(pagination ? { pagination } : {}),
    },
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
    'Fetch charges by id and/or by filters (all ChargeFilter fields), with full detail: owner, counterparty, amounts (`totalAmount`, `vat`, `withholdingTax`), a nested `dates` object, `tags`, `metadata` counts and `chargeType`. Linked transactions and documents are opt-in via `includeTransactions` / `includeDocuments`, and for a foreign-securities charge the security traded and the portfolio executions behind it are opt-in via `includeSecurities` (each reporting a `securityBusinessId` that accounter_list_security_holdings and accounter_get_security_executions accept). Read-only. ' +
    resultEnvelopeDescription('charges') +
    ' ' +
    SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: getChargesInput,
  policy: { requiresBusinessScope: true, dataClassification: 'business' },
  handler,
};
