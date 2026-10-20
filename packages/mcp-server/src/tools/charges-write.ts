import { z } from 'zod';
import { ToolInputError } from '../errors/taxonomy.js';
import type {
  McpChargeWriteEchoFragment,
  McpMergeChargesMutation,
  McpRereadChargeQuery,
  McpUpdateChargeMutation,
} from '../gql/index.js';
import { UpstreamError } from '../upstream/graphql-client.js';
import { CHARGE_TYPES } from './charge-filters.js';
import { parseCalendarDate, TIMELESS_DATE } from './dates.js';
import { chargeTypeFromTypename } from './entity-shapes.js';
import { shapeWriteResult, writeResultDescription } from './output.js';
import type {
  ToolDefinition,
  ToolExecutionContext,
  ToolObservation,
  ToolResult,
} from './registry.js';
import { WRITE_SCOPE_DESCRIPTION_SUFFIX, writeTargetBusinessIdInput } from './scope-input.js';

/**
 * Write tools on the charge itself: edit its own fields, or merge several
 * charges into one.
 *
 * These are the two operations a bookkeeping review needs once a charge has
 * been found and inspected: "this charge is a payroll run, not a common
 * expense" (`accounter_update_charge`) and "this emailed receipt and that card
 * row are the same purchase" (`accounter_merge_charges`). What they deliberately
 * do NOT cover: the charge's counterparty. Upstream derives it from the linked
 * transactions and documents, so it is set through
 * `accounter_update_transactions` (`counterpartyId`) and
 * `accounter_update_document` (`creditorId` / `debtorId`) — the field
 * `UpdateChargeInput.counterpartyId` exists in the schema but the resolver
 * ignores it, and exposing it here would promise an edit that never lands.
 */

export const UPDATE_CHARGE_TOOL_NAME = 'accounter_update_charge';
export const MERGE_CHARGES_TOOL_NAME = 'accounter_merge_charges';

/** Max charges folded into one base charge per call. */
export const MAX_CHARGES_TO_MERGE = 20;
/** Max `yearsOfRelevance` entries per call — a spread rarely covers more than a few years. */
export const MAX_YEARS_OF_RELEVANCE = 10;

// The type vocabulary is the one `byChargeTypes` already uses (charge-filters.ts),
// so a type upstream adds reaches the write tool the moment the filter learns it.
const chargeTypeInput = z
  .enum(CHARGE_TYPES)
  .optional()
  .describe(
    'Reclassify the charge. Same vocabulary as the `chargeType` field on a charge row — e.g. ' +
      'PAYROLL for a salary run, FINANCIAL for bank fees and interest, CREDITCARD_BANK for a card ' +
      'bill settlement, BUSINESS_TRIP for travel. Several types relax the document requirement; ' +
      '`accounter_explain_terminology` topic `charge` lists which.',
  );

const userDescriptionInput = z
  .string()
  .max(500)
  .optional()
  .describe('Replace the user-written description of the charge.');

const yearOfRelevanceInput = z.object({
  year: TIMELESS_DATE.refine(value => parseCalendarDate(value) !== null, {
    message: 'must be a real calendar date',
  }).describe('A date inside the year the charge (or this slice of it) belongs to, YYYY-MM-DD.'),
  amount: z
    .number()
    .optional()
    .describe('The part of the charge booked to that year; omit to spread evenly.'),
});

/** The charge fields shared by update and merge, as the tool exposes them. */
const chargeFieldsInput = {
  userDescription: userDescriptionInput,
  type: chargeTypeInput,
  optionalDocuments: z
    .boolean()
    .optional()
    .describe(
      'Mark the charge as not needing documents (true) or needing them (false). Use it for a ' +
        'charge that will never have an invoice — a rounding charge, a fee the bank does not ' +
        'document — so it stops showing up as missing information.',
    ),
  optionalVat: z
    .boolean()
    .optional()
    .describe('Mark the charge as exempt from the VAT check (true) or subject to it (false).'),
  isInvoicePaymentDifferentCurrency: z
    .boolean()
    .optional()
    .describe(
      'True when the invoice and its payment are legitimately in different currencies, so the ' +
        'currency mismatch is not flagged.',
    ),
  defaultTaxCategoryId: z
    .string()
    .min(1)
    .optional()
    .describe(
      'Override the tax category the charge is booked to (normally inherited from the ' +
        'counterparty). Resolve ids with accounter_list_tax_categories.',
    ),
  businessTripId: z
    .string()
    .min(1)
    .optional()
    .describe(
      'Attach the charge to a business trip. Pass the all-zero UUID ' +
        '(00000000-0000-0000-0000-000000000000) to detach it from its current trip.',
    ),
  yearsOfRelevance: z
    .array(yearOfRelevanceInput)
    .min(1)
    .max(MAX_YEARS_OF_RELEVANCE)
    .optional()
    .describe(
      'Spread the charge across accounting years (an annual licence paid in one go, say): one ' +
        'entry per year, each with a date in that year and optionally the amount booked to it. ' +
        'Replaces the existing spread.',
    ),
};

const updateChargeInput = z.object({
  memberBusinessId: writeTargetBusinessIdInput,
  chargeId: z
    .string()
    .min(1)
    .describe(
      'The charge to edit. Use accounter_search_charges / accounter_get_charges to find it.',
    ),
  ...chargeFieldsInput,
});
type UpdateChargeInput = z.infer<typeof updateChargeInput>;

const mergeChargesInput = z.object({
  memberBusinessId: writeTargetBusinessIdInput,
  baseChargeId: z
    .string()
    .min(1)
    .describe(
      'The charge that survives. Everything linked to the merged charges — transactions, ' +
        'documents, ledger records — moves onto it, and its own fields are kept.',
    ),
  chargeIdsToMerge: z
    .array(z.string().min(1))
    .min(1)
    .max(MAX_CHARGES_TO_MERGE)
    .describe(
      `The charges to fold into the base charge (1-${MAX_CHARGES_TO_MERGE}). They are deleted ` +
        'once their transactions and documents have moved.',
    ),
  ...chargeFieldsInput,
});
type MergeChargesInput = z.infer<typeof mergeChargesInput>;

/** The echo every charge write returns: enough to confirm the edit landed. */
const CHARGE_ECHO_FRAGMENT = /* GraphQL */ `
  fragment McpChargeWriteEcho on Charge {
    __typename
    id
    userDescription
    optionalDocuments
    optionalVAT
    isInvoicePaymentDifferentCurrency
    counterparty {
      id
      name
    }
    tags {
      id
      name
    }
    metadata {
      transactionsCount
      documentsCount
      invalidLedger
    }
  }
`;

// The fragment trails each operation: the write path checks that the document
// *starts* with `mutation`, so a leading fragment definition would be refused.
const UPDATE_CHARGE_MUTATION = /* GraphQL */ `
  mutation McpUpdateCharge($chargeId: UUID!, $fields: UpdateChargeInput!) {
    updateCharge(chargeId: $chargeId, fields: $fields) {
      __typename
      ... on UpdateChargeSuccessfulResult {
        charge {
          ...McpChargeWriteEcho
        }
      }
      ... on CommonError {
        message
      }
    }
  }
  ${CHARGE_ECHO_FRAGMENT}
`;

const MERGE_CHARGES_MUTATION = /* GraphQL */ `
  mutation McpMergeCharges(
    $baseChargeId: UUID!
    $chargeIdsToMerge: [UUID!]!
    $fields: UpdateChargeInput
  ) {
    mergeCharges(
      baseChargeID: $baseChargeId
      chargeIdsToMerge: $chargeIdsToMerge
      fields: $fields
    ) {
      __typename
      ... on MergeChargeSuccessfulResult {
        charge {
          id
        }
      }
      ... on CommonError {
        message
      }
    }
  }
`;

// Upstream `mergeCharges` returns the base charge as it was loaded *before*
// `fields` were applied, so its echo can show the old description or type and
// the model would read the edit as lost. The merged charge is re-read instead.
const REREAD_CHARGE_QUERY = /* GraphQL */ `
  query McpRereadCharge($chargeIDs: [UUID!]!) {
    chargesByIDs(chargeIDs: $chargeIDs) {
      ...McpChargeWriteEcho
    }
  }
  ${CHARGE_ECHO_FRAGMENT}
`;

function shapeChargeEcho(charge: McpChargeWriteEchoFragment) {
  return {
    id: charge.id,
    chargeType: chargeTypeFromTypename(charge.__typename),
    description: charge.userDescription ?? null,
    optionalDocuments: charge.optionalDocuments ?? null,
    optionalVat: charge.optionalVAT ?? null,
    isInvoicePaymentDifferentCurrency: charge.isInvoicePaymentDifferentCurrency ?? null,
    counterparty: charge.counterparty
      ? { id: charge.counterparty.id, name: charge.counterparty.name }
      : null,
    tags: charge.tags.map(tag => ({ id: tag.id, name: tag.name })),
    transactionsCount: charge.metadata?.transactionsCount ?? null,
    documentsCount: charge.metadata?.documentsCount ?? null,
    invalidLedger: charge.metadata?.invalidLedger ?? null,
  };
}

type ChargeFields = z.infer<z.ZodObject<typeof chargeFieldsInput>>;

/**
 * Build the upstream `UpdateChargeInput` from the tool's flat fields. Only the
 * fields the caller passed are sent: upstream treats an absent field as "leave
 * as is", and sending `null` for the rest would clear them.
 */
function chargeFieldsOf(input: ChargeFields): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (input.userDescription !== undefined) fields.userDescription = input.userDescription;
  if (input.type !== undefined) fields.type = input.type;
  if (input.optionalDocuments !== undefined) fields.optionalDocuments = input.optionalDocuments;
  if (input.optionalVat !== undefined) fields.optionalVAT = input.optionalVat;
  if (input.isInvoicePaymentDifferentCurrency !== undefined) {
    fields.isInvoicePaymentDifferentCurrency = input.isInvoicePaymentDifferentCurrency;
  }
  if (input.defaultTaxCategoryId !== undefined) {
    fields.defaultTaxCategoryID = input.defaultTaxCategoryId;
  }
  if (input.businessTripId !== undefined) fields.businessTripID = input.businessTripId;
  if (input.yearsOfRelevance !== undefined) {
    fields.yearsOfRelevance = input.yearsOfRelevance.map(entry => ({
      year: entry.year,
      amount: entry.amount ?? null,
    }));
  }
  return fields;
}

const SETTABLE_FIELDS = Object.keys(chargeFieldsInput).join(', ');

async function updateChargeHandler(
  input: UpdateChargeInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const fields = chargeFieldsOf(input);
  // Upstream would accept an empty `fields` and touch nothing; refusing it here
  // costs no round trip and tells the model which fields it can set.
  if (Object.keys(fields).length === 0) {
    throw new ToolInputError('No charge changes requested', [
      { path: 'chargeId', message: `provide at least one of ${SETTABLE_FIELDS}` },
    ]);
  }

  const data = await context.client.mutate<McpUpdateChargeMutation>(
    { query: UPDATE_CHARGE_MUTATION, variables: { chargeId: input.chargeId, fields } },
    context.upstream,
  );

  const result = data.updateCharge;
  if (result.__typename !== 'UpdateChargeSuccessfulResult') {
    throw new UpstreamError(
      'UPSTREAM_ERROR',
      result.__typename === 'CommonError' ? result.message : 'Charge update failed',
      false,
    );
  }

  const charge = shapeChargeEcho(result.charge);
  return shapeWriteResult({
    action: 'update_charge',
    outcome: {
      chargeId: input.chargeId,
      updatedFields: Object.keys(fields),
      scope: { memberBusinessIds: context.readScope.memberBusinessIds },
    },
    items: { key: 'charges', values: [charge] },
    summary: `Updated ${Object.keys(fields).join(', ')} on charge ${input.chargeId}.`,
  });
}

async function mergeChargesHandler(
  input: MergeChargesInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  if (input.chargeIdsToMerge.includes(input.baseChargeId)) {
    throw new ToolInputError('A charge cannot be merged into itself', [
      { path: 'chargeIdsToMerge', message: 'must not contain baseChargeId' },
    ]);
  }
  const duplicates = input.chargeIdsToMerge.filter(
    (id, index) => input.chargeIdsToMerge.indexOf(id) !== index,
  );
  if (duplicates.length > 0) {
    throw new ToolInputError('Duplicate charge ids', [
      { path: 'chargeIdsToMerge', message: `listed more than once: ${duplicates.join(', ')}` },
    ]);
  }

  const fields = chargeFieldsOf(input);
  const data = await context.client.mutate<McpMergeChargesMutation>(
    {
      query: MERGE_CHARGES_MUTATION,
      variables: {
        baseChargeId: input.baseChargeId,
        chargeIdsToMerge: input.chargeIdsToMerge,
        fields: Object.keys(fields).length > 0 ? fields : null,
      },
    },
    context.upstream,
  );

  const result = data.mergeCharges;
  if (result.__typename !== 'MergeChargeSuccessfulResult') {
    throw new UpstreamError(
      'UPSTREAM_ERROR',
      result.__typename === 'CommonError' ? result.message : 'Charge merge failed',
      false,
    );
  }

  const reread = await context.client.query<McpRereadChargeQuery>(
    { query: REREAD_CHARGE_QUERY, variables: { chargeIDs: [input.baseChargeId] } },
    context.upstream,
  );
  const fresh = reread.chargesByIDs[0];
  const charges = fresh ? [shapeChargeEcho(fresh)] : [];
  const counts = fresh
    ? `; it now has ${fresh.metadata?.transactionsCount ?? '?'} transaction(s) and ${fresh.metadata?.documentsCount ?? '?'} document(s)`
    : '';

  return shapeWriteResult({
    action: 'merge_charges',
    outcome: {
      baseChargeId: input.baseChargeId,
      mergedChargeIds: input.chargeIdsToMerge,
      mergedCount: input.chargeIdsToMerge.length,
      updatedFields: Object.keys(fields),
      scope: { memberBusinessIds: context.readScope.memberBusinessIds },
    },
    items: { key: 'charges', values: charges },
    summary: `Merged ${input.chargeIdsToMerge.length} charge(s) into ${input.baseChargeId}${counts}.`,
  });
}

function observeUpdate(input: UpdateChargeInput): ToolObservation {
  return { fields: { updatedFieldCount: Object.keys(chargeFieldsOf(input)).length } };
}

function observeMerge(input: MergeChargesInput): ToolObservation {
  return { fields: { mergedChargeCount: input.chargeIdsToMerge.length } };
}

export const updateChargeTool: ToolDefinition<typeof updateChargeInput> = {
  name: UPDATE_CHARGE_TOOL_NAME,
  description:
    'Edit a charge’s own fields: its description, its type (COMMON, PAYROLL, FINANCIAL, ' +
    'BUSINESS_TRIP, CREDITCARD_BANK, …), whether documents or VAT are optional for it, whether ' +
    'invoice and payment may differ in currency, its tax-category override, the business trip it ' +
    'belongs to, and its spread across accounting years. Only the fields you pass change. This ' +
    'does NOT set the counterparty — a charge takes its counterparty from its transactions and ' +
    'documents, so use `accounter_update_transactions` (counterpartyId) or ' +
    '`accounter_update_document` (creditorId / debtorId) for that, and ' +
    '`accounter_update_charges_tags` for tags. ' +
    'The echo under `charges` is the charge as it now stands (`chargeType`, `description`, ' +
    '`counterparty`, `tags`, counts), alongside `chargeId` and `updatedFields`. ' +
    writeResultDescription('charges') +
    ' ' +
    WRITE_SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: updateChargeInput,
  policy: {
    requiredRoles: ['business_owner', 'accountant'],
    requiresBusinessScope: true,
    dataClassification: 'business',
    mutating: true,
  },
  handler: updateChargeHandler,
  observe: observeUpdate,
};

export const mergeChargesTool: ToolDefinition<typeof mergeChargesInput> = {
  name: MERGE_CHARGES_TOOL_NAME,
  description:
    'Merge several charges into one: every transaction, document and ledger record of the ' +
    '`chargeIdsToMerge` moves onto `baseChargeId`, and the merged charges are then deleted. This ' +
    'is how an emailed receipt that landed in its own charge is joined to the bank or card row it ' +
    'pays for — make the charge that holds the transaction the base, so its dates and amounts ' +
    'survive. The merge is not reversible from here; confirm both sides with ' +
    '`accounter_get_charges` first. The same fields as `accounter_update_charge` ' +
    '(`userDescription`, `type`, …) can be set on the base charge in the same call. The echo ' +
    'under `charges` is the merged charge re-read after the merge, with its new transaction and ' +
    'document counts, alongside `baseChargeId`, `mergedChargeIds`, `mergedCount` and `updatedFields`. ' +
    writeResultDescription('charges') +
    ' ' +
    WRITE_SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: mergeChargesInput,
  policy: {
    requiredRoles: ['business_owner', 'accountant'],
    requiresBusinessScope: true,
    dataClassification: 'business',
    mutating: true,
  },
  handler: mergeChargesHandler,
  observe: observeMerge,
};
