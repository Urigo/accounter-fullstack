import { z } from 'zod';
import type { McpGetChargesQuery, McpGetChargesQueryVariables } from '../gql/index.js';
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
export const MAX_CHARGE_IDS = 25;

const getChargesInput = z.object({
  chargeIds: z
    .array(z.string().min(1))
    .min(1)
    .max(MAX_CHARGE_IDS)
    .describe(
      `The charge ids to fetch (1–${MAX_CHARGE_IDS}). Discover ids via accounter_search_charges.`,
    ),
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
});

type GetChargesInput = z.infer<typeof getChargesInput>;

const GET_CHARGES_QUERY = /* GraphQL */ `
  query McpGetCharges(
    $chargeIDs: [UUID!]!
    $includeTransactions: Boolean!
    $includeDocuments: Boolean!
  ) {
    chargesByIDs(chargeIDs: $chargeIDs) {
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
      additionalDocuments @include(if: $includeDocuments) {
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
    }
  }
`;

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
  const variables: McpGetChargesQueryVariables = {
    chargeIDs: input.chargeIds,
    includeTransactions: input.includeTransactions,
    includeDocuments: input.includeDocuments,
  };
  const data = await context.client.query<McpGetChargesQuery>(
    { query: GET_CHARGES_QUERY, variables },
    context.upstream,
  );

  const scopeIds = new Set(context.readScope.businessIds);
  const charges = (data.chargesByIDs ?? [])
    // Defense-in-depth owner filter (see `charges.ts`): keep a charge only when
    // its owner is in the resolved read scope. A charge with no resolvable owner
    // is kept — RLS already returned it and there is no owner to reject it by.
    .filter(charge => {
      const ownerId = charge.owner?.id;
      return ownerId == null || scopeIds.has(ownerId);
    })
    .map(normalizeCharge);

  return shapeListResult({
    items: charges,
    itemsKey: 'charges',
    total: charges.length,
    extra: { scope: { businessIds: context.readScope.businessIds } },
    summarize: (shown, total) =>
      total === 0
        ? 'No charges were found for the given ids (they may be outside your authorized businesses).'
        : `Found ${total} charge(s)${shown < total ? ` (showing ${shown})` : ''}.`,
  });
}

export const getChargesTool: ToolDefinition<typeof getChargesInput> = {
  name: GET_CHARGES_TOOL_NAME,
  description:
    'Fetch charges by id with their full detail: owner, counterparty, amounts (total, VAT, withholding), dates, tags, metadata counts, and — by default — their linked transactions and documents. Read-only. ' +
    SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: getChargesInput,
  policy: { requiresBusinessScope: true, dataClassification: 'business' },
  handler,
};
