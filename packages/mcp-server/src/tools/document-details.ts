import { z } from 'zod';
import type { McpGetDocumentsQuery, McpGetDocumentsQueryVariables } from '../gql/index.js';
import { MAX_DETAIL_IDS, normalizeDocument, type RawDocument } from './entity-shapes.js';
import { shapeListResult } from './output.js';
import type { ToolDefinition, ToolExecutionContext, ToolResult } from './registry.js';
import { businessIdsInput, SCOPE_DESCRIPTION_SUFFIX } from './scope-input.js';

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

const getDocumentsInput = z.object({
  documentIds: z
    .array(z.string().min(1))
    .min(1)
    .max(MAX_DETAIL_IDS)
    .describe(
      `The document ids to fetch (1–${MAX_DETAIL_IDS}). Discover ids via accounter_get_charges ` +
        '(each charge lists its documents).',
    ),
  businessIds: businessIdsInput,
});

type GetDocumentsInput = z.infer<typeof getDocumentsInput>;

const GET_DOCUMENTS_QUERY = /* GraphQL */ `
  query McpGetDocuments($documentIds: [UUID!]!) {
    documentsByIds(documentIds: $documentIds) {
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
        owner {
          id
        }
      }
    }
  }
`;

async function handler(
  input: GetDocumentsInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const variables: McpGetDocumentsQueryVariables = { documentIds: input.documentIds };
  const data = await context.client.query<McpGetDocumentsQuery>(
    { query: GET_DOCUMENTS_QUERY, variables },
    context.upstream,
  );

  const scopeIds = new Set(context.readScope.businessIds);
  const raw = (data.documentsByIds ?? []) as RawDocument[];
  const documents = raw
    // Defense-in-depth owner filter: keep a document only when its owning
    // charge's owner is in scope. A document with no resolvable charge/owner is
    // kept — RLS already returned it, and there is no owner to reject it by.
    .filter(document => {
      const ownerId = document.charge?.owner?.id;
      return ownerId == null || scopeIds.has(ownerId);
    })
    .map(normalizeDocument);

  return shapeListResult({
    items: documents,
    itemsKey: 'documents',
    total: documents.length,
    extra: { scope: { businessIds: context.readScope.businessIds } },
    summarize: (shown, total) =>
      total === 0
        ? 'No documents were found for the given ids (they may be outside your authorized businesses).'
        : `Found ${total} document(s)${shown < total ? ` (showing ${shown})` : ''}.`,
  });
}

export const getDocumentsTool: ToolDefinition<typeof getDocumentsInput> = {
  name: GET_DOCUMENTS_TOOL_NAME,
  description:
    'Fetch documents (invoices, receipts, credit invoices, …) by id, with type, serial number, date, amount, VAT, creditor/debtor, and file/image links. Read-only. ' +
    SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: getDocumentsInput,
  policy: { requiresBusinessScope: true, dataClassification: 'business' },
  handler,
};
