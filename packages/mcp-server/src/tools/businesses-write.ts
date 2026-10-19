import { z } from 'zod';
import type { McpCreateBusinessMutation } from '../gql/index.js';
import { UpstreamError } from '../upstream/graphql-client.js';
import { shapeWriteResult, writeResultDescription } from './output.js';
import type {
  ToolDefinition,
  ToolExecutionContext,
  ToolObservation,
  ToolResult,
} from './registry.js';
import { WRITE_SCOPE_DESCRIPTION_SUFFIX, writeTargetBusinessIdInput } from './scope-input.js';

/**
 * Write tool: add a business to the directory so it can be used as a
 * counterparty.
 *
 * A review of unmatched bank and card rows runs into vendors the directory has
 * never seen (a hotel, a parking operator, a restaurant on a trip). Without this
 * tool the model can name the counterparty but not set it — the transaction edit
 * needs an id. The tool creates the minimum the upstream mutation requires
 * (`name` and an ISO 3166-1 alpha-3 `country`) plus the few optional fields a
 * model usually knows; everything bookkeeping-specific (sort code, tax category,
 * IRS code, PCN874 record type) is left for the Accounter UI, where the
 * accountant chooses them from lists.
 */

export const CREATE_BUSINESS_TOOL_NAME = 'accounter_create_business';

const COUNTRY_CODE_RE = /^[A-Za-z]{3}$/;

const createBusinessInput = z.object({
  memberBusinessId: writeTargetBusinessIdInput,
  name: z
    .string()
    .min(1)
    .max(200)
    .describe(
      'The business name as it should appear in the directory. Check accounter_list_businesses ' +
        '(`nameContains`) first so an existing entry is reused rather than duplicated.',
    ),
  country: z
    .string()
    .regex(COUNTRY_CODE_RE, 'ISO 3166-1 alpha-3 code, e.g. ISR, USA, DEU')
    .describe('Country of the business as an ISO 3166-1 alpha-3 code (ISR, USA, GBR, DEU, …).'),
  hebrewName: z.string().max(200).optional().describe('Hebrew name, for Israeli businesses.'),
  website: z.string().max(300).optional().describe('Website URL, when known.'),
  email: z.string().max(200).optional().describe('Contact or billing email, when known.'),
  isDocumentsOptional: z
    .boolean()
    .optional()
    .describe(
      'True when charges with this counterparty never come with an invoice (a toll operator, a ' +
        'bank fee), so they are not flagged as missing documents.',
    ),
});
type CreateBusinessInput = z.infer<typeof createBusinessInput>;

const CREATE_BUSINESS_MUTATION = /* GraphQL */ `
  mutation McpCreateBusiness($fields: InsertNewBusinessInput!) {
    insertNewBusiness(fields: $fields) {
      __typename
      ... on LtdFinancialEntity {
        id
        name
        hebrewName
        website
        country {
          code
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`;

async function createBusinessHandler(
  input: CreateBusinessInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const fields: Record<string, unknown> = {
    name: input.name,
    country: input.country.toUpperCase(),
  };
  if (input.hebrewName !== undefined) fields.hebrewName = input.hebrewName;
  if (input.website !== undefined) fields.website = input.website;
  if (input.email !== undefined) fields.email = input.email;
  if (input.isDocumentsOptional !== undefined) {
    fields.isDocumentsOptional = input.isDocumentsOptional;
  }

  const data = await context.client.mutate<McpCreateBusinessMutation>(
    { query: CREATE_BUSINESS_MUTATION, variables: { fields } },
    context.upstream,
  );

  const result = data.insertNewBusiness;
  if (result.__typename !== 'LtdFinancialEntity') {
    throw new UpstreamError(
      'UPSTREAM_ERROR',
      result.__typename === 'CommonError' ? result.message : 'Business creation failed',
      false,
    );
  }

  const business = {
    id: result.id,
    name: result.name,
    hebrewName: result.hebrewName ?? null,
    website: result.website ?? null,
    country: result.country?.code ?? null,
  };

  return shapeWriteResult({
    action: 'create_business',
    outcome: {
      businessId: business.id,
      scope: { memberBusinessIds: context.readScope.memberBusinessIds },
    },
    items: { key: 'businesses', values: [business] },
    summary: `Created business "${business.name}" (${business.id}).`,
  });
}

function observe(input: CreateBusinessInput): ToolObservation {
  return {
    fields: {
      hasHebrewName: input.hebrewName !== undefined,
      documentsOptional: input.isDocumentsOptional ?? false,
    },
  };
}

export const createBusinessTool: ToolDefinition<typeof createBusinessInput> = {
  name: CREATE_BUSINESS_TOOL_NAME,
  description:
    'Add a business to the directory so it can be set as a counterparty on transactions ' +
    '(`accounter_update_transactions`) and documents (`accounter_update_document`). Takes a ' +
    '`name` and an ISO 3166-1 alpha-3 `country` (ISR, USA, …), plus optional `hebrewName`, ' +
    '`website`, `email` and `isDocumentsOptional`. Look the name up with ' +
    '`accounter_list_businesses` first: this creates a new entry every time, and a duplicate ' +
    'cannot be merged from here. Sort code, tax category and the other bookkeeping attributes ' +
    'are set in the Accounter UI afterwards. The echo under `businesses` is the new entry with ' +
    'its `id`, also reported as `businessId`. ' +
    writeResultDescription('businesses') +
    ' ' +
    WRITE_SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: createBusinessInput,
  policy: {
    requiredRoles: ['business_owner', 'accountant'],
    requiresBusinessScope: true,
    dataClassification: 'business',
    mutating: true,
  },
  handler: createBusinessHandler,
  observe,
};
