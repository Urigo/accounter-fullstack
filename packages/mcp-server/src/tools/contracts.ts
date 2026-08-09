import { z } from 'zod';
import type { McpGetContractsQuery, McpGetContractsQueryVariables } from '../gql/index.js';
import { normalizeAmount, type NormalizedAmount } from './entity-shapes.js';
import { shapeListResult } from './output.js';
import type { ToolDefinition, ToolExecutionContext, ToolResult } from './registry.js';
import { memberBusinessIdsInput, SCOPE_DESCRIPTION_SUFFIX } from './scope-input.js';

/**
 * Read-only client-contracts search.
 *
 * A contract is the billing agreement between an admin business (the owner —
 * one of *your* businesses) and a client. The two useful axes are therefore the
 * admin side and the client side, and the tool filters on either; `contractIds`
 * is there to re-fetch a specific contract a previous answer referenced. Every
 * row reports its `adminId` so a result spanning admin businesses can be
 * grouped without a second call.
 */

export const GET_CONTRACTS_TOOL_NAME = 'accounter_get_contracts';

/** Hard caps keeping responses bounded (spec §9.1, §9.3). */
export const MAX_CONTRACTS = 500;
export const MAX_CONTRACT_FILTER_IDS = 50;

const idList = (what: string) =>
  z
    .array(z.string().min(1))
    .max(MAX_CONTRACT_FILTER_IDS)
    .optional()
    .describe(`Only contracts ${what}.`);

const getContractsInput = z.object({
  memberBusinessIds: memberBusinessIdsInput,
  adminIds: idList(
    'owned by any of these admin (owner) businesses — must be a subset of the businesses you belong to',
  ),
  clientIds: idList('belonging to any of these clients'),
  contractIds: idList('with these ids'),
  isActive: z
    .boolean()
    .optional()
    .describe('Restrict to active (true) or inactive (false) contracts. Omit for both.'),
  limit: z
    .number()
    .int()
    .positive()
    .max(MAX_CONTRACTS)
    .optional()
    .default(MAX_CONTRACTS)
    .describe(`Maximum contracts to return (capped at ${MAX_CONTRACTS}).`),
});

type GetContractsInput = z.infer<typeof getContractsInput>;

const GET_CONTRACTS_QUERY = /* GraphQL */ `
  query McpGetContracts($filters: ContractsFilters) {
    contractsByFilters(filters: $filters) {
      id
      adminId
      isActive
      startDate
      endDate
      billingCycle
      documentType
      product
      plan
      purchaseOrders
      remarks
      amount {
        raw
        formatted
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

/** A single contract as returned by the generated `McpGetContracts` query. */
type RawContract = McpGetContractsQuery['contractsByFilters'][number];

/** Normalized contract shape returned to the caller. */
export interface NormalizedContract {
  id: string;
  /** Owning admin business, so multi-business results can be grouped. */
  adminId: string;
  client: { id: string; businessId: string; name: string };
  isActive: boolean;
  startDate: string;
  endDate: string;
  billingCycle: string;
  documentType: string;
  product: string | null;
  plan: string | null;
  purchaseOrders: string[];
  remarks: string | null;
  amount: NormalizedAmount | null;
}

function normalizeContract(contract: RawContract): NormalizedContract {
  return {
    id: contract.id,
    adminId: contract.adminId,
    client: {
      id: contract.client.id,
      businessId: contract.client.originalBusiness.id,
      name: contract.client.originalBusiness.name,
    },
    isActive: contract.isActive,
    startDate: contract.startDate,
    endDate: contract.endDate,
    billingCycle: contract.billingCycle,
    documentType: contract.documentType,
    product: contract.product ?? null,
    plan: contract.plan ?? null,
    purchaseOrders: [...contract.purchaseOrders],
    remarks: contract.remarks ?? null,
    amount: normalizeAmount(contract.amount),
  };
}

function buildFilters(
  input: GetContractsInput,
  memberBusinessIds: readonly string[],
): NonNullable<McpGetContractsQueryVariables['filters']> {
  const filters: NonNullable<McpGetContractsQueryVariables['filters']> = {};
  // Narrow to the admin businesses the caller asked for, intersected with the
  // resolved read scope. Without the intersection an explicit `adminIds` would
  // widen the request past the caller's own businesses; the scope is already
  // enforced upstream, but a business-scoped tool must not send an
  // unauthorized owner id in the first place.
  const requested = input.adminIds?.length ? input.adminIds : undefined;
  const admins = requested
    ? memberBusinessIds.length > 0
      ? requested.filter(id => memberBusinessIds.includes(id))
      : requested
    : memberBusinessIds;
  if (admins.length > 0) {
    filters.adminIds = [...admins];
  }
  if (input.clientIds?.length) filters.clientIds = [...input.clientIds];
  if (input.contractIds?.length) filters.contractIds = [...input.contractIds];
  if (input.isActive !== undefined) filters.isActive = input.isActive;
  return filters;
}

async function handler(
  input: GetContractsInput,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const variables: McpGetContractsQueryVariables = {
    filters: buildFilters(input, context.readScope.memberBusinessIds),
  };
  const data = await context.client.query<McpGetContractsQuery>(
    { query: GET_CONTRACTS_QUERY, variables },
    context.upstream,
  );

  const all = data.contractsByFilters ?? [];
  const contracts = all.slice(0, input.limit).map(normalizeContract);

  const scope = { memberBusinessIds: context.readScope.memberBusinessIds };
  const scopeNote =
    scope.memberBusinessIds.length > 1 ? ` across ${scope.memberBusinessIds.length} businesses` : '';

  return shapeListResult({
    items: contracts,
    itemsKey: 'contracts',
    total: all.length,
    extra: { scope, limit: input.limit },
    summarize: (shown, total, truncated) =>
      total === 0
        ? `No contracts matched the given filters${scopeNote}.`
        : `Found ${total} contract(s)${scopeNote}${truncated ? `; showing ${shown}` : ''}.`,
  });
}

export const getContractsTool: ToolDefinition<typeof getContractsInput> = {
  name: GET_CONTRACTS_TOOL_NAME,
  description:
    'List client billing contracts within your authorized businesses. Filter by admin (owner) business, by client, by contract id, and by active state. Each row reports its `adminId`. Read-only. ' +
    SCOPE_DESCRIPTION_SUFFIX,
  inputSchema: getContractsInput,
  policy: { requiresBusinessScope: true, dataClassification: 'business' },
  handler,
};
