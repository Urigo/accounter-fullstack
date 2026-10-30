import { z } from 'zod';
import { ToolInputError } from '../errors/taxonomy.js';
import type {
  McpCreateClientMutation,
  McpFindBusinessForClientQuery,
  McpReadCreatedClientQuery,
} from '../gql/index.js';
import { UpstreamError } from '../upstream/graphql-client.js';
import { DOCUMENT_TYPES } from './document-details.js';
import { shapeWriteResult, writeResultDescription } from './output.js';
import type {
  ToolDefinition,
  ToolExecutionContext,
  ToolObservation,
  ToolResult,
} from './registry.js';
import { WRITE_SCOPE_DESCRIPTION_SUFFIX, writeTargetBusinessIdInput } from './scope-input.js';

/**
 * Write tool: make an existing business a client.
 *
 * A client is a business with a row in the `clients` table — that row is what
 * `accounter_list_clients` enumerates and what `accounter_get_contracts` /
 * `accounter_create_contract` key on. Signing a new customer therefore needs
 * three steps today: add the business (`accounter_create_business`), make it a
 * client (this tool), then record the billing contract. Without this tool the
 * middle step had to happen in the Accounter UI.
 *
 * The input mirrors upstream `ClientInsertInput` field for field, with one
 * deliberate omission inside `integrations`: `greenInvoiceId`. The resolver
 * creates a Green Invoice customer itself and then stores the id it got back
 * over whatever the caller passed, so accepting one would only ever promise a
 * value that is immediately replaced.
 *
 * What upstream `insertClient` does, in order (read off the resolver):
 * 1. de-duplicates `emails` case-insensitively and inserts the `clients` row,
 *    owned by the business the call is scoped to;
 * 2. creates a customer in **Green Invoice** from the business's directory
 *    record (name, phone, address, city, zip, country, active flag, tax id,
 *    sort code) plus the client's emails;
 * 3. writes the returned Green Invoice id into the client's `integrations`.
 * The three are not one transaction: when step 2 fails the mutation reports
 * `CommonError`, but the `clients` row from step 1 already exists. The
 * description therefore says to check `accounter_list_clients` after any
 * upstream error instead of calling again — the second call would hit the
 * primary key on `business_id` and fail too. The pre-read also recognises
 * that half-created state (a client row with no Green Invoice id) and names
 * it, rather than reporting "already a client" as if all were well.
 *
 * The mutation's return value is the row *as inserted in step 1*, so it never
 * carries the Green Invoice id from step 3. The tool therefore reads the client
 * back with `client(businessId:)` after a successful insert and reports from
 * that read; the mutation selects only the id.
 *
 * The same primary key is why the tool reads the business first and refuses
 * one that is already a client: upstream collapses every failure into the
 * same "Failed to create Client" message, which would leave the model unable
 * to tell "already a client" from "Green Invoice is down".
 */

export const CREATE_CLIENT_TOOL_NAME = 'accounter_create_client';

const MAX_EMAILS = 50;

const integrationsInput = z
  .object({
    hiveId: z.string().min(1).max(200).optional().describe('GraphQL Hive organization id.'),
    linearId: z.string().min(1).max(200).optional().describe('Linear customer / team id.'),
    slackChannelKey: z
      .string()
      .min(1)
      .max(200)
      .optional()
      .describe('Key of the shared Slack channel with this client.'),
    notionId: z.string().min(1).max(200).optional().describe('Notion page id for this client.'),
    workflowyUrl: z
      .string()
      .min(1)
      .max(500)
      .optional()
      .describe('Workflowy node URL for this client.'),
  })
  // Strict, so a `greenInvoiceId` is rejected loudly instead of being stripped
  // and silently ignored — the omission is the point (see the file comment).
  .strict()
  .optional()
  .describe(
    'External-system ids to store on the client. The Green Invoice id is not accepted: upstream ' +
      'creates the Green Invoice customer itself and stores the id it gets back.',
  );

const createClientInput = z.object({
  memberBusinessId: writeTargetBusinessIdInput,
  businessId: z
    .string()
    .min(1)
    .describe(
      'The existing business to make a client — the `id` of an `accounter_list_businesses` row ' +
        '(add it first with `accounter_create_business` if it is not in the directory yet). ' +
        'Refused when the business is already a client.',
    ),
  emails: z
    .array(z.email().max(200))
    .max(MAX_EMAILS)
    .optional()
    .describe(
      'Billing emails the client’s documents are sent to; each must be a well-formed address. ' +
        'Duplicates are dropped case-insensitively upstream. Omitting it stores an empty list.',
    ),
  generatedDocumentType: z
    .enum(DOCUMENT_TYPES)
    .describe(
      'The client-level default document type (PROFORMA, INVOICE, …). A default only: what a ' +
        'billing agreement actually issues is the contract’s own `documentType`.',
    ),
  integrations: integrationsInput,
});
type CreateClientInput = z.infer<typeof createClientInput>;

// `isClient` and `clientInfo` hang off `LtdFinancialEntity`, not off the
// `Business` interface that `businesses(ids:)` is typed to — same inline
// fragment as the directory tool, and `Business.__resolveType` returns
// `LtdFinancialEntity` for every node, so the fragment matches. `clientInfo`
// is selected down to the Green Invoice id only: that field resolves from a
// value already loaded, while the rest of `GreenInvoiceClient` calls the
// external Green Invoice API.
//
// An unknown id does not come back as a missing row: the resolver loads every
// id and throws `Error fetching some of the businesses` when any is missing,
// which reaches this tool as an UpstreamError — mapped to a ToolInputError on
// `businessId` below, since it is the caller's input that is wrong.
const FIND_BUSINESS_QUERY = /* GraphQL */ `
  query McpFindBusinessForClient($ids: [UUID!]!) {
    businesses(ids: $ids) {
      id
      ... on LtdFinancialEntity {
        name
        isClient
        clientInfo {
          integrations {
            greenInvoiceInfo {
              greenInvoiceId
            }
          }
        }
      }
    }
  }
`;

/** The message upstream `businesses(ids:)` throws when any requested id does not exist. */
const UNKNOWN_BUSINESS_UPSTREAM_MESSAGE = 'Error fetching some of the businesses';

// Read back after the insert. Upstream `insertClient` returns the `clients` row
// as inserted — *before* `addGreenInvoiceClient` writes the Green Invoice id
// onto it — so the mutation's own return value never carries that id. This is
// the one query that returns the row as it stands now.
const READ_CREATED_CLIENT_QUERY = /* GraphQL */ `
  query McpReadCreatedClient($businessId: UUID!) {
    client(businessId: $businessId) {
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

// Only the id is selected: every other field is read back afterwards (see
// `READ_CREATED_CLIENT_QUERY`), because what this returns is the row before the
// Green Invoice step touched it.
const CREATE_CLIENT_MUTATION = /* GraphQL */ `
  mutation McpCreateClient($fields: ClientInsertInput!) {
    insertClient(fields: $fields) {
      __typename
      ... on Client {
        id
      }
      ... on CommonError {
        message
      }
    }
  }
`;

function clientFieldsOf(input: CreateClientInput): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    businessId: input.businessId,
    generatedDocumentType: input.generatedDocumentType,
  };
  if (input.emails !== undefined) fields.emails = input.emails;
  if (input.integrations) {
    const integrations: Record<string, unknown> = {};
    for (const key of [
      'hiveId',
      'linearId',
      'slackChannelKey',
      'notionId',
      'workflowyUrl',
    ] as const) {
      if (input.integrations[key] !== undefined) integrations[key] = input.integrations[key];
    }
    if (Object.keys(integrations).length > 0) fields.integrations = integrations;
  }
  return fields;
}

async function createClientHandler(
  input: CreateClientInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  let found: McpFindBusinessForClientQuery;
  try {
    found = await context.client.query<McpFindBusinessForClientQuery>(
      { query: FIND_BUSINESS_QUERY, variables: { ids: [input.businessId] } },
      context.upstream,
    );
  } catch (error) {
    if (
      error instanceof UpstreamError &&
      error.message.includes(UNKNOWN_BUSINESS_UPSTREAM_MESSAGE)
    ) {
      throw new ToolInputError(`No business with id ${input.businessId}`, [
        { path: 'businessId', message: 'look the business up with accounter_list_businesses' },
      ]);
    }
    throw error;
  }
  // The resolver has thrown for any missing id by now; an empty list here would
  // mean upstream changed its contract, so it is treated as the same input error.
  const business = (found.businesses ?? []).find(row => row.id === input.businessId);
  if (!business) {
    throw new ToolInputError(`No business with id ${input.businessId}`, [
      { path: 'businessId', message: 'look the business up with accounter_list_businesses' },
    ]);
  }
  const name = 'name' in business ? business.name : input.businessId;
  if ('isClient' in business && business.isClient) {
    const hasGreenInvoice =
      'clientInfo' in business &&
      !!business.clientInfo?.integrations.greenInvoiceInfo?.greenInvoiceId;
    // The row exists but the Green Invoice step never completed: a previous
    // insert failed half-way. Nothing this tool can send would finish it —
    // `insertClient` would hit the primary key — so it has to be repaired in the
    // Accounter UI, and the message must not read as plain "already done".
    if (!hasGreenInvoice) {
      throw new ToolInputError(
        `"${name}" is already a client but its Green Invoice customer is missing`,
        [
          {
            path: 'businessId',
            message:
              'the client row exists without a Green Invoice id — an earlier creation failed half-way; ' +
              'fix it in the Accounter UI (client → integrations) rather than calling this tool again',
          },
        ],
      );
    }
    throw new ToolInputError(`"${name}" is already a client`, [
      {
        path: 'businessId',
        message: `read it with accounter_list_clients (clientBusinessIds: ["${input.businessId}"]); there is nothing to create`,
      },
    ]);
  }

  const fields = clientFieldsOf(input);
  const data = await context.client.mutate<McpCreateClientMutation>(
    { query: CREATE_CLIENT_MUTATION, variables: { fields } },
    context.upstream,
  );

  const result = data.insertClient;
  if (result.__typename !== 'Client') {
    throw new UpstreamError(
      'UPSTREAM_ERROR',
      result.__typename === 'CommonError' ? result.message : 'Client creation failed',
      false,
    );
  }

  // Read the row back: the mutation returned it before the Green Invoice id was
  // written, so only a fresh read reports what the client actually holds now.
  const readBack = await context.client.query<McpReadCreatedClientQuery>(
    { query: READ_CREATED_CLIENT_QUERY, variables: { businessId: result.id } },
    context.upstream,
  );
  const row = readBack.client;

  const integrations: Record<string, string> = {};
  const greenInvoiceId = row.integrations.greenInvoiceInfo?.greenInvoiceId;
  if (greenInvoiceId) integrations.greenInvoiceId = greenInvoiceId;
  for (const key of [
    'hiveId',
    'linearId',
    'slackChannelKey',
    'notionId',
    'workflowyUrl',
  ] as const) {
    const value = row.integrations[key];
    if (value) integrations[key] = value;
  }
  const client = {
    businessId: row.id,
    name: row.originalBusiness.name,
    ownerId: row.ownerId,
    emails: [...row.emails],
    generatedDocumentType: row.generatedDocumentType,
    integrations,
  };

  return shapeWriteResult({
    action: 'create_client',
    outcome: {
      clientBusinessId: client.businessId,
      greenInvoiceId: integrations.greenInvoiceId ?? null,
      setFields: Object.keys(fields),
      scope: { memberBusinessIds: context.readScope.memberBusinessIds },
    },
    items: { key: 'clients', values: [client] },
    summary: `"${client.name}" (${client.businessId}) is now a client${
      integrations.greenInvoiceId
        ? `; Green Invoice customer ${integrations.greenInvoiceId} created`
        : ''
    }.`,
  });
}

function observe(input: CreateClientInput): ToolObservation {
  return {
    fields: {
      emailCount: input.emails?.length ?? 0,
      generatedDocumentType: input.generatedDocumentType,
      hasIntegrations: input.integrations !== undefined,
    },
  };
}

export const createClientTool: ToolDefinition<typeof createClientInput> = {
  name: CREATE_CLIENT_TOOL_NAME,
  description:
    'Make an existing business a client — the row that `accounter_list_clients` lists and that a ' +
    'contract (`accounter_create_contract`, `accounter_get_contracts`) is keyed on. Takes the ' +
    '`businessId` of a directory entry (`accounter_list_businesses`; create it first with ' +
    '`accounter_create_business` if needed), the billing `emails`, the client-level default ' +
    '`generatedDocumentType` (PROFORMA, INVOICE, …; the contract’s own `documentType` is what ' +
    'actually gets issued) and optional `integrations` ids (`hiveId`, `linearId`, ' +
    '`slackChannelKey`, `notionId`, `workflowyUrl`). Upstream also creates a customer in Green ' +
    'Invoice from the business’s directory details and stores its id on the client; the tool reads ' +
    'the client back after the insert and reports that id as `greenInvoiceId` (the insert’s own ' +
    'return value predates it). That step is not part of the same transaction, so after an upstream ' +
    'error check `accounter_list_clients` before calling again — the client row may already exist ' +
    'and a retry would fail on it. A business that is already a client is refused before any write, ' +
    'with a distinct message when its row exists but the Green Invoice customer is missing (a ' +
    'half-finished earlier creation, to be repaired in the Accounter UI). An unknown `businessId` is ' +
    'a validation error. ' +
    'The echo under `clients` is the new client with its `businessId` (a client’s id is its ' +
    'business id), also reported as `clientBusinessId`, alongside `setFields`. ' +
    writeResultDescription('clients') +
    ' ' +
    WRITE_SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: createClientInput,
  policy: {
    requiredRoles: ['business_owner', 'accountant'],
    requiresBusinessScope: true,
    dataClassification: 'business',
    mutating: true,
  },
  handler: createClientHandler,
  observe,
};
