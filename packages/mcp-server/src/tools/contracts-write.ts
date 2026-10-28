import { z } from 'zod';
import { ToolInputError } from '../errors/taxonomy.js';
import type { McpCreateContractMutation } from '../gql/index.js';
import { parseCalendarDate, TIMELESS_DATE } from './dates.js';
import { DOCUMENT_TYPES } from './document-details.js';
import { CURRENCIES } from './documents-edit-write.js';
import { normalizeAmount } from './entity-shapes.js';
import { shapeWriteResult, writeResultDescription } from './output.js';
import type {
  ToolDefinition,
  ToolExecutionContext,
  ToolObservation,
  ToolResult,
} from './registry.js';
import { WRITE_SCOPE_DESCRIPTION_SUFFIX, writeTargetBusinessIdInput } from './scope-input.js';

/**
 * Write tool: record a client billing contract.
 *
 * A contract is the billing agreement `accounter_get_contracts` lists: the
 * client it bills, the term, the amount per billing cycle and what document
 * gets issued. Recording one is the last step of onboarding a signed customer
 * (directory entry → client → contract) and the only one that did not have a
 * tool. The input mirrors upstream `CreateContractInput` field for field,
 * including `deactivateContracts` (renamed `deactivateContractIds`), which is
 * what the Accounter UI uses to retire the previous term when a renewal is
 * recorded.
 *
 * What upstream `createContract` does, in order (read off the resolver and
 * provider):
 * 1. when `deactivateContracts` is given, sets `is_active = false` on each of
 *    those contracts, one update per id, in parallel;
 * 2. inserts the new row, owned by the business the call is scoped to
 *    (`owner_id` comes from the auth context, not from the input).
 * The two are not one transaction: an insert that fails after step 1 leaves
 * the listed contracts deactivated, and the mutation reports only a generic
 * "Error creating contract". The description says so, and says to re-read
 * with `accounter_get_contracts` before retrying.
 *
 * `operationsLimit` is a `BigInt` upstream, stored in `operations_count` and
 * defaulting to 0 when omitted. It is the **full** number of operations the
 * plan includes per month — 30B a month is `30000000000`, 600M a month is
 * `600000000` — which is why it is a BigInt rather than an Int. The tool takes
 * it as a non-negative integer and sends it as a number (safe up to 2^53, far
 * above any plan). A value that looks like it was entered in millions is not
 * rejected: the server stores whatever it gets, and a small limit is a
 * legitimate (if unusual) contract.
 */

export const CREATE_CONTRACT_TOOL_NAME = 'accounter_create_contract';

/** Mirror the upstream `BillingCycle` enum (pinned by `schema-contract.test.ts`). */
export const BILLING_CYCLES = ['MONTHLY', 'ANNUAL'] as const;
/** Mirror the upstream `Product` enum (pinned by `schema-contract.test.ts`). */
export const PRODUCTS = ['HIVE', 'STELLATE'] as const;
/** Mirror the upstream `SubscriptionPlan` enum (pinned by `schema-contract.test.ts`). */
export const SUBSCRIPTION_PLANS = ['ENTERPRISE', 'PRO'] as const;

const MAX_PURCHASE_ORDERS = 20;
const MAX_DEACTIVATE = 20;

const calendarDate = TIMELESS_DATE.refine(value => parseCalendarDate(value) !== null, {
  message: 'Date must be a real calendar date',
});

const createContractInput = z.object({
  memberBusinessId: writeTargetBusinessIdInput,
  clientId: z
    .string()
    .min(1)
    .describe(
      'The client the contract bills — a `businessId` from `accounter_list_clients` (a client’s ' +
        'id is its business id). The business must already be a client (`accounter_create_client`).',
    ),
  startDate: calendarDate.describe('First day of the term (YYYY-MM-DD).'),
  endDate: calendarDate.describe('Last day of the term (YYYY-MM-DD); not before `startDate`.'),
  amount: z
    .object({
      value: z.number().describe('The fee per billing cycle (per month or per year).'),
      currency: z.enum(CURRENCIES),
    })
    .describe('The fee charged each billing cycle, with its currency.'),
  billingCycle: z.enum(BILLING_CYCLES).describe('How often `amount` is billed: MONTHLY or ANNUAL.'),
  documentType: z
    .enum(DOCUMENT_TYPES)
    .describe(
      'The document issued for each billing (PROFORMA, INVOICE, …). This is what actually gets ' +
        'issued; the client-level `generatedDocumentType` is only a default.',
    ),
  product: z.enum(PRODUCTS).optional().describe('The product billed: HIVE or STELLATE.'),
  plan: z.enum(SUBSCRIPTION_PLANS).optional().describe('The subscription plan: ENTERPRISE or PRO.'),
  purchaseOrders: z
    .array(z.string().min(1).max(100))
    .max(MAX_PURCHASE_ORDERS)
    .optional()
    .describe(
      'Customer purchase-order numbers to print on the documents. Omitting it stores none.',
    ),
  remarks: z
    .string()
    .max(2000)
    .optional()
    .describe(
      'Free-text default remark carried onto the documents (volumes, billing instructions).',
    ),
  msCloud: z
    .url()
    .max(1000)
    .optional()
    .describe('Link to the signed agreement (the SharePoint / OneDrive URL).'),
  operationsLimit: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe(
      'The FULL number of operations the plan includes per month — not millions: 30B operations ' +
        'a month is 30000000000, 600M a month is 600000000. Omitting it stores 0.',
    ),
  isActive: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether the contract is in force. Defaults to true.'),
  deactivateContractIds: z
    .array(z.string().min(1))
    .max(MAX_DEACTIVATE)
    .optional()
    .describe(
      'Contracts to mark inactive in the same call — the previous term when this one is a renewal ' +
        '(ids from `accounter_get_contracts`). They are deactivated BEFORE the new row is inserted ' +
        'and are not rolled back if the insert fails.',
    ),
});
type CreateContractInput = z.infer<typeof createContractInput>;

const CREATE_CONTRACT_MUTATION = /* GraphQL */ `
  mutation McpCreateContract($input: CreateContractInput!) {
    createContract(input: $input) {
      id
      ownerId
      isActive
      startDate
      endDate
      billingCycle
      documentType
      product
      plan
      purchaseOrders
      remarks
      msCloud
      operationsLimit
      amount {
        raw
        currency
      }
      client {
        id
        originalBusiness {
          id
          name
        }
      }
    }
  }
`;

function contractInputOf(input: CreateContractInput): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    clientId: input.clientId,
    startDate: input.startDate,
    endDate: input.endDate,
    amount: { raw: input.amount.value, currency: input.amount.currency },
    billingCycle: input.billingCycle,
    documentType: input.documentType,
    // Required (non-null) upstream, so the tool's default is always sent.
    isActive: input.isActive,
    // Required (non-null list) upstream; the tool treats "omitted" as "none".
    purchaseOrders: input.purchaseOrders ?? [],
  };
  if (input.product !== undefined) fields.product = input.product;
  if (input.plan !== undefined) fields.plan = input.plan;
  if (input.remarks !== undefined) fields.remarks = input.remarks;
  if (input.msCloud !== undefined) fields.msCloud = input.msCloud;
  if (input.operationsLimit !== undefined) fields.operationsLimit = input.operationsLimit;
  if (input.deactivateContractIds !== undefined) {
    fields.deactivateContracts = input.deactivateContractIds;
  }
  return fields;
}

async function createContractHandler(
  input: CreateContractInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const start = parseCalendarDate(input.startDate);
  const end = parseCalendarDate(input.endDate);
  if (start !== null && end !== null && end < start) {
    throw new ToolInputError('endDate is before startDate', [
      { path: 'endDate', message: `must be on or after startDate (${input.startDate})` },
    ]);
  }

  const fields = contractInputOf(input);
  const data = await context.client.mutate<McpCreateContractMutation>(
    { query: CREATE_CONTRACT_MUTATION, variables: { input: fields } },
    context.upstream,
  );

  const result = data.createContract;
  const contract = {
    id: result.id,
    ownerId: result.ownerId,
    client: {
      id: result.client.id,
      businessId: result.client.originalBusiness.id,
      name: result.client.originalBusiness.name,
    },
    isActive: result.isActive,
    startDate: result.startDate,
    endDate: result.endDate,
    billingCycle: result.billingCycle,
    documentType: result.documentType,
    product: result.product ?? null,
    plan: result.plan ?? null,
    purchaseOrders: [...result.purchaseOrders],
    remarks: result.remarks ?? null,
    msCloud: result.msCloud == null ? null : String(result.msCloud),
    operationsLimit: Number(result.operationsLimit),
    amount: normalizeAmount(result.amount),
  };

  const deactivated = input.deactivateContractIds ?? [];
  return shapeWriteResult({
    action: 'create_contract',
    outcome: {
      contractId: contract.id,
      clientBusinessId: contract.client.businessId,
      deactivatedContractIds: deactivated,
      setFields: Object.keys(fields),
      scope: { memberBusinessIds: context.readScope.memberBusinessIds },
    },
    items: { key: 'contracts', values: [contract] },
    summary:
      `Created contract ${contract.id} for "${contract.client.name}": ` +
      `${contract.amount?.value ?? input.amount.value} ${contract.amount?.currency ?? input.amount.currency} ` +
      `${contract.billingCycle}, ${contract.startDate} → ${contract.endDate}` +
      (deactivated.length > 0
        ? `; deactivated ${deactivated.length} previous contract${deactivated.length === 1 ? '' : 's'}`
        : '') +
      '.',
  });
}

function observe(input: CreateContractInput): ToolObservation {
  return {
    fields: {
      billingCycle: input.billingCycle,
      documentType: input.documentType,
      product: input.product ?? null,
      plan: input.plan ?? null,
      currency: input.amount.currency,
      purchaseOrderCount: input.purchaseOrders?.length ?? 0,
      deactivateCount: input.deactivateContractIds?.length ?? 0,
    },
  };
}

export const createContractTool: ToolDefinition<typeof createContractInput> = {
  name: CREATE_CONTRACT_TOOL_NAME,
  description:
    'Record a client billing contract — the agreement `accounter_get_contracts` lists — for a ' +
    'client from `accounter_list_clients` (`clientId` is its business id). Takes the term ' +
    '(`startDate`, `endDate`, real calendar dates, end not before start), the fee per cycle as ' +
    '`amount` `{ value, currency }` with its `billingCycle` (MONTHLY or ANNUAL), the `documentType` ' +
    'issued per billing (PROFORMA, INVOICE, …), and optionally `product` (HIVE / STELLATE), `plan` ' +
    '(ENTERPRISE / PRO), `purchaseOrders`, `remarks`, `msCloud` (link to the signed agreement), ' +
    '`operationsLimit` (the FULL monthly operations count, e.g. 30000000000 for 30B a month; 0 when ' +
    'omitted) ' +
    'and `isActive` (default true). For a renewal, `deactivateContractIds` retires the previous ' +
    'term in the same call; upstream deactivates those BEFORE inserting the new row and does not ' +
    'roll that back if the insert fails, so after an upstream error re-read with ' +
    '`accounter_get_contracts` before retrying. One row is created per call — a multi-year ' +
    'agreement billed annually is one contract spanning the whole term with the yearly fee as ' +
    '`amount`. The echo under `contracts` is the new contract in the `accounter_get_contracts` row ' +
    'shape, its id also reported as `contractId`, alongside `clientBusinessId`, ' +
    '`deactivatedContractIds` and `setFields`. ' +
    writeResultDescription('contracts') +
    ' ' +
    WRITE_SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: createContractInput,
  policy: {
    requiredRoles: ['business_owner', 'accountant'],
    requiresBusinessScope: true,
    dataClassification: 'business',
    mutating: true,
  },
  handler: createContractHandler,
  observe,
};
