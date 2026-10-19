import { z } from 'zod';
import { ToolInputError } from '../errors/taxonomy.js';
import type { McpCreateBusinessMutation, McpFindBusinessByNameQuery } from '../gql/index.js';
import { UpstreamError } from '../upstream/graphql-client.js';
import { countryCodeInput } from './country-codes.js';
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
 * needs an id. The input mirrors upstream `InsertNewBusinessInput` field for
 * field (only the email-listener sub-config is left out), so the bookkeeping
 * attributes — sort code, tax category, government id, IRS code, PCN874 record
 * type — can be set in the same call rather than in the UI afterwards.
 *
 * Upstream `insertNewBusiness` is not transactional: it inserts the financial
 * entity, then the business row, and a failure on the second insert leaves the
 * first behind. A model's natural reaction to an error is to fix its input and
 * call again, which would then create a second entity with the same name — so
 * the tool looks the name up first and refuses an exact match (`existingId` in
 * the error names it), unless `allowDuplicateName` says the duplicate is wanted.
 */

export const CREATE_BUSINESS_TOOL_NAME = 'accounter_create_business';

/** Mirrors the upstream `Pcn874RecordType` enum. */
export const PCN874_RECORD_TYPES = [
  'C',
  'H',
  'I',
  'K',
  'L1',
  'L2',
  'M',
  'P',
  'R',
  'S1',
  'S2',
  'T',
  'Y',
] as const;

const MAX_SUGGESTION_ENTRIES = 50;

const suggestionsInput = z
  .object({
    phrases: z
      .array(z.string().min(1).max(200))
      .max(MAX_SUGGESTION_ENTRIES)
      .optional()
      .describe(
        'Transaction/document text fragments that identify this business, used to auto-suggest ' +
          'it as a counterparty (e.g. the merchant string as it appears on card rows).',
      ),
    emails: z
      .array(z.string().min(1).max(200))
      .max(MAX_SUGGESTION_ENTRIES)
      .optional()
      .describe('Sender emails whose documents belong to this business.'),
    tagIds: z
      .array(z.string().min(1))
      .max(MAX_SUGGESTION_ENTRIES)
      .optional()
      .describe('Tags to suggest on its charges (ids from accounter_list_tags).'),
    description: z.string().max(500).optional().describe('Default charge description to suggest.'),
    priority: z.number().int().optional().describe('Suggestion priority when several match.'),
  })
  .optional()
  .describe('Auto-matching hints Accounter applies to future transactions and documents.');

const createBusinessInput = z.object({
  memberBusinessId: writeTargetBusinessIdInput,
  name: z
    .string()
    .min(1)
    .max(200)
    .describe(
      'The business name as it should appear in the directory. The tool refuses a name that ' +
        'already exists exactly (case-insensitive) and returns the existing id instead.',
    ),
  country: countryCodeInput.describe(
    'Country of the business as an ISO 3166-1 alpha-3 code (ISR, USA, GBR, DEU, …); any case.',
  ),
  hebrewName: z.string().max(200).optional().describe('Hebrew name, for Israeli businesses.'),
  governmentId: z
    .string()
    .max(50)
    .optional()
    .describe('Registration / tax id (ח.פ. or ע.מ. for Israeli businesses).'),
  sortCode: z
    .number()
    .int()
    .optional()
    .describe(
      'Sort-code key the business is grouped under (resolve with accounter_list_sort_codes). ' +
        'When given without irsCode, upstream fills the IRS code from the sort code’s default.',
    ),
  taxCategoryId: z
    .string()
    .min(1)
    .optional()
    .describe(
      'Tax category its charges are booked to (resolve with accounter_list_tax_categories).',
    ),
  irsCode: z.number().int().optional().describe('IRS code override (Israeli tax authority).'),
  pcn874RecordType: z
    .enum(PCN874_RECORD_TYPES)
    .optional()
    .describe('PCN874 (VAT report) record-type override for this business’s documents.'),
  address: z.string().max(300).optional(),
  city: z.string().max(100).optional(),
  zipCode: z.string().max(20).optional(),
  email: z.string().max(200).optional().describe('Contact or billing email, when known.'),
  phoneNumber: z.string().max(50).optional(),
  website: z.string().max(300).optional().describe('Website URL, when known.'),
  exemptDealer: z
    .boolean()
    .optional()
    .describe('True for an Israeli exempt dealer (עוסק פטור), whose invoices carry no VAT.'),
  optionalVat: z
    .boolean()
    .optional()
    .describe('True when charges with this counterparty need no VAT check.'),
  isReceiptEnough: z
    .boolean()
    .optional()
    .describe('True when a receipt (no invoice) is enough documentation for this counterparty.'),
  isDocumentsOptional: z
    .boolean()
    .optional()
    .describe(
      'True when charges with this counterparty never come with an invoice (a toll operator, a ' +
        'bank fee), so they are not flagged as missing documents.',
    ),
  isActive: z.boolean().optional().describe('Defaults to true.'),
  suggestions: suggestionsInput,
  allowDuplicateName: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'Create the business even if one with exactly this name already exists (default false: ' +
        'the call is refused and the existing id returned in the error).',
    ),
});
type CreateBusinessInput = z.infer<typeof createBusinessInput>;

const FIND_BUSINESS_BY_NAME_QUERY = /* GraphQL */ `
  query McpFindBusinessByName($filters: BusinessFilter) {
    allBusinesses(page: 0, limit: 50, filters: $filters) {
      nodes {
        id
        name
      }
    }
  }
`;

const CREATE_BUSINESS_MUTATION = /* GraphQL */ `
  mutation McpCreateBusiness($fields: InsertNewBusinessInput!) {
    insertNewBusiness(fields: $fields) {
      __typename
      ... on LtdFinancialEntity {
        id
        name
        hebrewName
        governmentId
        website
        country {
          code
        }
        taxCategory {
          id
          name
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`;

function businessFieldsOf(input: CreateBusinessInput): Record<string, unknown> {
  const fields: Record<string, unknown> = { name: input.name, country: input.country };
  const copy = <K extends keyof CreateBusinessInput>(key: K, upstreamKey: string = key) => {
    if (input[key] !== undefined) fields[upstreamKey] = input[key];
  };
  copy('hebrewName');
  copy('governmentId');
  copy('sortCode');
  copy('taxCategoryId', 'taxCategory');
  copy('irsCode');
  copy('pcn874RecordType');
  copy('address');
  copy('city');
  copy('zipCode');
  copy('email');
  copy('phoneNumber');
  copy('website');
  copy('exemptDealer');
  copy('optionalVat', 'optionalVAT');
  copy('isReceiptEnough');
  copy('isDocumentsOptional');
  copy('isActive');
  if (input.suggestions) {
    const s = input.suggestions;
    const suggestions: Record<string, unknown> = {};
    if (s.phrases !== undefined) suggestions.phrases = s.phrases;
    if (s.emails !== undefined) suggestions.emails = s.emails;
    if (s.tagIds !== undefined) suggestions.tags = s.tagIds.map(id => ({ id }));
    if (s.description !== undefined) suggestions.description = s.description;
    if (s.priority !== undefined) suggestions.priority = s.priority;
    if (Object.keys(suggestions).length > 0) fields.suggestions = suggestions;
  }
  return fields;
}

async function createBusinessHandler(
  input: CreateBusinessInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  if (!input.allowDuplicateName) {
    const found = await context.client.query<McpFindBusinessByNameQuery>(
      { query: FIND_BUSINESS_BY_NAME_QUERY, variables: { filters: { name: input.name } } },
      context.upstream,
    );
    const wanted = input.name.trim().toLowerCase();
    const existing = (found.allBusinesses?.nodes ?? []).find(
      business => business.name.trim().toLowerCase() === wanted,
    );
    if (existing) {
      throw new ToolInputError(`A business named "${existing.name}" already exists`, [
        {
          path: 'name',
          message: `use the existing business ${existing.id}, or pass allowDuplicateName: true to create another`,
        },
      ]);
    }
  }

  const fields = businessFieldsOf(input);
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
    governmentId: result.governmentId ?? null,
    website: result.website ?? null,
    country: result.country?.code ?? null,
    taxCategory: result.taxCategory
      ? { id: result.taxCategory.id, name: result.taxCategory.name }
      : null,
  };

  return shapeWriteResult({
    action: 'create_business',
    outcome: {
      businessId: business.id,
      setFields: Object.keys(fields),
      scope: { memberBusinessIds: context.readScope.memberBusinessIds },
    },
    items: { key: 'businesses', values: [business] },
    summary: `Created business "${business.name}" (${business.id}).`,
  });
}

function observe(input: CreateBusinessInput): ToolObservation {
  return {
    fields: {
      setFieldCount: Object.keys(businessFieldsOf(input)).length,
      hasSuggestions: input.suggestions !== undefined,
      documentsOptional: input.isDocumentsOptional ?? false,
    },
  };
}

export const createBusinessTool: ToolDefinition<typeof createBusinessInput> = {
  name: CREATE_BUSINESS_TOOL_NAME,
  description:
    'Add a business to the directory so it can be set as a counterparty on transactions ' +
    '(`accounter_update_transactions`) and documents (`accounter_update_document`). Takes a ' +
    '`name` and an ISO 3166-1 alpha-3 `country` (ISR, USA, …), plus the same optional fields ' +
    'the Accounter UI offers: `hebrewName`, `governmentId`, `sortCode`, `taxCategoryId`, ' +
    '`irsCode`, `pcn874RecordType`, address fields, `email`, `phoneNumber`, `website`, ' +
    '`exemptDealer`, `optionalVat`, `isReceiptEnough`, `isDocumentsOptional`, `isActive` and ' +
    '`suggestions` (phrases / emails / tags used to auto-match future rows). A name that already ' +
    'exists is refused with the existing id, so a retry after an error cannot create a ' +
    'duplicate; pass `allowDuplicateName: true` only when two distinct businesses really share ' +
    'a name. If upstream reports an error, look the name up with `accounter_list_businesses` ' +
    'before calling again: the upstream insert is not atomic and a partial record may exist. ' +
    'The echo under `businesses` is the new entry with its `id`, also reported as `businessId`, ' +
    'alongside `setFields`. ' +
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
