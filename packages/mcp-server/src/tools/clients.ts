import { z } from 'zod';
import type { McpListClientsQuery } from '../gql/index.js';
import { resultEnvelopeDescription, shapeListResult } from './output.js';
import type { ToolDefinition, ToolExecutionContext, ToolResult } from './registry.js';
import { memberBusinessIdsInput, SCOPE_DESCRIPTION_SUFFIX } from './scope-input.js';

/**
 * Read-only client directory.
 *
 * A *client* is a business the caller sells to: one that carries a row in the
 * `clients` table, which adds emails, a default document type, and a map of
 * external-system ids. Membership of that table is the only thing that makes a
 * business a client — there is no separate entity and no "client" charge type.
 *
 * Why this is its own tool rather than more fields on `accounter_list_businesses`:
 * the directory is thousands of rows of which clients are a small slice, and it
 * is answered against a hard payload cap. Hanging emails and six integration ids
 * off every row would spend that budget on the majority of rows that have none.
 * So the directory carries the one-bit `isClient` flag and this tool owns the
 * detail — which is also where any future client data belongs.
 *
 * It closes a real gap besides: `accounter_get_contracts` filters by `clientIds`,
 * and before this tool nothing enumerated them. The ids are interchangeable —
 * a client's id *is* its business id.
 */

export const LIST_CLIENTS_TOOL_NAME = 'accounter_list_clients';

/** Hard caps keeping responses bounded (spec §9.1, §9.3). */
export const MAX_CLIENTS = 300;
export const DEFAULT_CLIENTS = 150;
export const MAX_CLIENT_FILTER_IDS = 50;

const listClientsInput = z.object({
  memberBusinessIds: memberBusinessIdsInput,
  nameContains: z
    .string()
    .min(1)
    .max(100)
    .optional()
    .describe("Case-insensitive substring to filter by the client business's name."),
  // Named for the axis it filters, not for what it holds: `scope-contract.test.ts`
  // rejects a top-level `businessIds`/`businessId` on any scoped tool, because
  // that name sits one letter from the *counterparty* filters on other tools and
  // has already caused one scoping bug. These are client ids that happen to also
  // be business ids.
  clientBusinessIds: z
    .array(z.string().min(1))
    .max(MAX_CLIENT_FILTER_IDS)
    .optional()
    .describe(
      'Only these clients, identified by business id — the `id` of an `isClient: true` row from ' +
        '`accounter_list_businesses`, or a `client.businessId` from `accounter_get_contracts`.',
    ),
  limit: z
    .number()
    .int()
    .positive()
    .max(MAX_CLIENTS)
    .optional()
    .default(DEFAULT_CLIENTS)
    .describe(`Maximum clients to return (capped at ${MAX_CLIENTS}).`),
});

type ListClientsInput = z.infer<typeof listClientsInput>;

// `originalBusiness` is typed `LtdFinancialEntity!` upstream, so it needs no
// inline fragment — unlike `accounter_list_businesses`, whose rows come back as
// the `Business` interface.
//
// `greenInvoiceInfo` is selected down to `greenInvoiceId` and nothing else, and
// that restraint is load-bearing rather than tidiness: that single field
// resolves as an identity function over a value already in hand, while every
// other field on `GreenInvoiceClient` (`name`, `emails`, `country`, `phone`,
// `taxId`, …) is fetched from the **external Green Invoice API**, and
// `businessId` costs a database round trip. Adding any one of them would turn a
// single list call into one third-party HTTP request per client.
const LIST_CLIENTS_QUERY = /* GraphQL */ `
  query McpListClients {
    allClients {
      id
      ownerId
      emails
      generatedDocumentType
      originalBusiness {
        id
        name
      }
      integrations {
        hiveId
        linearId
        slackChannelKey
        notionId
        workflowyUrl
        greenInvoiceInfo {
          greenInvoiceId
        }
      }
    }
  }
`;

type RawClient = McpListClientsQuery['allClients'][number];

/**
 * External-system ids configured for a client.
 *
 * Every key is optional and an unconfigured one is **omitted entirely** rather
 * than emitted as `null` — there is no null-vs-absent distinction to preserve
 * here (unlike the `@include`-gated fields on the charge tools), and a client
 * with a single Slack channel should cost one key rather than six. That matters
 * against the payload guard: a fully-configured row runs ~280 bytes.
 */
export interface NormalizedClientIntegrations {
  greenInvoiceId?: string;
  hiveId?: string;
  linearId?: string;
  slackChannelKey?: string;
  notionId?: string;
  workflowyUrl?: string;
}

export interface NormalizedClient {
  /**
   * The client's id, which *is* its business id — the same value as an
   * `accounter_list_businesses` row's `id` and an `accounter_get_contracts`
   * `clientIds` entry. Emitted once under this name rather than as both `id`
   * and `businessId`, so nothing suggests there are two identifiers to track.
   */
  businessId: string;
  name: string;
  /** Owning (admin) business, so results spanning owners can be grouped. */
  ownerId: string;
  emails: string[];
  generatedDocumentType: string;
  integrations: NormalizedClientIntegrations;
}

function normalizeIntegrations(
  integrations: RawClient['integrations'],
): NormalizedClientIntegrations {
  const normalized: NormalizedClientIntegrations = {};
  const greenInvoiceId = integrations.greenInvoiceInfo?.greenInvoiceId;
  if (greenInvoiceId) normalized.greenInvoiceId = greenInvoiceId;
  if (integrations.hiveId) normalized.hiveId = integrations.hiveId;
  if (integrations.linearId) normalized.linearId = integrations.linearId;
  if (integrations.slackChannelKey) normalized.slackChannelKey = integrations.slackChannelKey;
  if (integrations.notionId) normalized.notionId = integrations.notionId;
  if (integrations.workflowyUrl) normalized.workflowyUrl = integrations.workflowyUrl;
  return normalized;
}

function normalizeClient(client: RawClient): NormalizedClient {
  return {
    businessId: client.originalBusiness.id,
    name: client.originalBusiness.name,
    ownerId: client.ownerId,
    emails: [...client.emails],
    generatedDocumentType: client.generatedDocumentType,
    integrations: normalizeIntegrations(client.integrations),
  };
}

// Fixed-locale collator so ordering is deterministic across hosts/runtimes
// rather than depending on the ambient default locale (mirrors `lookups.ts`).
// Deliberately re-stated here instead of imported: the two tools sort different
// row shapes, and coupling them would make a change to either one's ordering an
// unannounced change to the other's.
const NAME_COLLATOR = new Intl.Collator('en', { sensitivity: 'base' });

/** Stable order: by name (case-insensitive, fixed-locale), tie-broken by id. */
function byNameThenBusinessId(a: NormalizedClient, b: NormalizedClient): number {
  return (
    NAME_COLLATOR.compare(a.name, b.name) ||
    (a.businessId < b.businessId ? -1 : a.businessId > b.businessId ? 1 : 0)
  );
}

async function handler(
  input: ListClientsInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const data = await context.client.query<McpListClientsQuery>(
    { query: LIST_CLIENTS_QUERY },
    context.upstream,
  );

  // Filtering happens here rather than upstream because `allClients` takes no
  // arguments, and giving it some would buy nothing: a client is a billing
  // relationship, so the whole set is tens to low hundreds of rows and arrives
  // in one memoized query. (Revisit past ~500 clients — at which point the
  // payload guard bites before the query does.)
  const requestedIds = input.clientBusinessIds?.length ? new Set(input.clientBusinessIds) : null;
  const needle = input.nameContains?.toLowerCase();
  // Defense-in-depth owner filter on top of RLS, matching `get_documents`. This
  // is a genuine second barrier rather than a restatement of the upstream one:
  // it would catch an upstream RLS regression, which an upstream filter argument
  // — running in the same server on the same connection — could not.
  const scopeIds = new Set(context.readScope.memberBusinessIds);

  const clients = (data.allClients ?? [])
    .map(normalizeClient)
    .filter(client => scopeIds.has(client.ownerId))
    .filter(client => requestedIds === null || requestedIds.has(client.businessId))
    .filter(client => needle === undefined || client.name.toLowerCase().includes(needle))
    .sort(byNameThenBusinessId);

  // `total` counts every match, so `truncated` and the continuation hint
  // describe the cap rather than the page.
  const total = clients.length;

  return shapeListResult({
    items: clients.slice(0, input.limit),
    itemsKey: 'clients',
    total,
    extra: { scope: { memberBusinessIds: context.readScope.memberBusinessIds } },
    summarize: (shown, count, truncated) =>
      count === 0
        ? 'No clients matched the given filters.'
        : `Found ${count} ${count === 1 ? 'client' : 'clients'}${
            truncated ? `; showing ${shown}` : ''
          }.`,
  });
}

export const listClientsTool: ToolDefinition<typeof listClientsInput> = {
  name: LIST_CLIENTS_TOOL_NAME,
  description:
    'List the businesses you bill as clients, with their contact emails and the external-system ids ' +
    'configured for each (Green Invoice, Hive, Linear, Slack, Notion, Workflowy). A client row is ' +
    "what makes a business a client; every row's `businessId` is the same id `accounter_list_businesses` " +
    'returns and the value `accounter_get_contracts` takes as `clientIds`, so this is the place to ' +
    'resolve a client by name before asking about its contracts. `generatedDocumentType` is the ' +
    "client-level default only — what actually gets issued is the contract's own `documentType`. " +
    'Read-only. ' +
    resultEnvelopeDescription('clients') +
    ' ' +
    SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: listClientsInput,
  policy: { requiresBusinessScope: true, dataClassification: 'business' },
  handler,
};
