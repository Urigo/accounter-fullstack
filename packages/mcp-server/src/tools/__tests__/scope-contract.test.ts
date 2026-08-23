import { describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import { listBusinessMembershipsTool } from '../businesses.js';
import { getChargesTool } from '../charge-details.js';
import { searchChargesTool } from '../charges.js';
import { getContractsTool } from '../contracts.js';
import { getDocumentsTool } from '../document-details.js';
import { executeRegisteredTool } from '../execute.js';
import { getLedgerRecordsTool } from '../ledger.js';
import { listBusinessesTool, listTagsTool, listTaxCategoriesTool } from '../lookups.js';
import type { ToolExecutionContext, ToolResult } from '../registry.js';
import { balanceReportTool } from '../reports.js';
import { getSecurityExecutionsTool, listSecurityHoldingsTool } from '../securities.js';
import { getTransactionsTool } from '../transaction-details.js';
import {
  SCOPE_DESCRIPTION_SUFFIX,
  SINGLE_BUSINESS_SCOPE_DESCRIPTION_SUFFIX,
} from '../scope-input.js';

/**
 * Cross-tool contract for Phase 5: one uniform scoping input, owner-tagged rows,
 * and an echoed effective scope. Asserted across every tool at once, so a tool
 * added later cannot quietly opt out of the convention.
 */

const PRINCIPAL: AuthPrincipal = {
  subject: 'user-1',
  issuer: 'https://tenant.auth0.com/',
  audience: 'aud',
  scopes: [],
  email: null,
  expiresAt: undefined,
  claims: { sub: 'user-1' },
};

function authContext(memberBusinessIds: string[]): McpAuthContext {
  return buildAuthContext(
    PRINCIPAL,
    memberBusinessIds.map(memberBusinessId => ({ memberBusinessId, roleId: 'accountant' })),
  );
}

function clientReturning(data: unknown) {
  const fetchImpl = vi.fn(
    async () => ({ ok: true, status: 200, json: async () => ({ data }) }) as unknown as Response,
  );
  return new UpstreamGraphQLClient({
    endpoint: 'http://localhost:4000/graphql',
    timeoutMs: 1000,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
}

const BUSINESS_SCOPED_TOOLS = [
  searchChargesTool,
  getLedgerRecordsTool,
  getContractsTool,
  listSecurityHoldingsTool,
  getSecurityExecutionsTool,
  listTagsTool,
  listTaxCategoriesTool,
  listBusinessesTool,
  balanceReportTool,
];

// The full-directory tool uses its own accurate scope clause, not the shared
// suffix (see lookups.ts), so it is deliberately excluded from the shared-suffix
// assertion below — but still checked for the discovery pointer, the
// `memberBusinessIds` input, and the echoed scope like the other list tools.
const MULTI_BUSINESS_TOOLS = [
  searchChargesTool,
  getLedgerRecordsTool,
  getContractsTool,
  listSecurityHoldingsTool,
  getSecurityExecutionsTool,
  listTagsTool,
  listTaxCategoriesTool,
];

describe('uniform business-scope input', () => {
  it.each(MULTI_BUSINESS_TOOLS.map(tool => [tool.name, tool] as const))(
    '%s teaches the multi-business scoping workflow',
    (_name, tool) => {
      expect(tool.description).toContain(SCOPE_DESCRIPTION_SUFFIX);
    },
  );

  // The single-business report must NOT claim an optional `memberBusinessIds` or
  // per-row `ownerId` — it has neither. It still points at discovery.
  it('balance report uses the single-business clause, not the list-tool one', () => {
    expect(balanceReportTool.description).toContain(SINGLE_BUSINESS_SCOPE_DESCRIPTION_SUFFIX);
    expect(balanceReportTool.description).not.toContain(SCOPE_DESCRIPTION_SUFFIX);
  });

  it.each(BUSINESS_SCOPED_TOOLS.map(tool => [tool.name, tool] as const))(
    '%s points at the discovery tool',
    (_name, tool) => {
      expect(tool.description).toContain('accounter_list_business_memberships');
    },
  );

  // Guards the mismatch Copilot caught on #4094: a description may only promise
  // `memberBusinessIds` if the tool actually accepts that field.
  it.each(BUSINESS_SCOPED_TOOLS.map(tool => [tool.name, tool] as const))(
    '%s only advertises `memberBusinessIds` if it accepts it',
    (_name, tool) => {
      const acceptsBusinessIds = 'memberBusinessIds' in tool.inputSchema.shape;
      expect(tool.description.includes('`memberBusinessIds`')).toBe(acceptsBusinessIds);
    },
  );

  it('gives the three list tools an identical memberBusinessIds description', () => {
    const describeField = (tool: (typeof BUSINESS_SCOPED_TOOLS)[number]) =>
      (tool.inputSchema.shape as Record<string, { description?: string }>).memberBusinessIds?.description;

    const descriptions = [searchChargesTool, listTagsTool, listTaxCategoriesTool].map(describeField);

    expect(descriptions[0]).toBeDefined();
    expect(new Set(descriptions).size).toBe(1);
  });

  // The rename that made the scope field `memberBusinessIds` only pays off while
  // both ends of the chain agree: discovery emits the key the scoped tools take.
  // If either side drifts, the model reads a `memberBusinessId` off one tool and
  // has nowhere to put it — the exact confusion the old `businessIds` /
  // `byBusinesses` overlap caused.
  it('emits from discovery exactly the key the scoped tools accept', () => {
    const membershipRow = (
      listBusinessMembershipsTool.handler(
        {},
        {
          auth: authContext(['b1']),
          readScope: { memberBusinessIds: ['b1'] },
        } as unknown as ToolExecutionContext,
      ) as ToolResult
    ).structuredContent as { businesses: Array<Record<string, unknown>> };

    expect(Object.keys(membershipRow.businesses[0]!)).toContain('memberBusinessId');
    for (const tool of BUSINESS_SCOPED_TOOLS) {
      const shape = tool.inputSchema.shape;
      // Plural on the list tools, singular on the one-business report — both
      // spelled off the same `memberBusinessId` the row above carries.
      expect('memberBusinessIds' in shape || 'memberBusinessId' in shape).toBe(true);
    }
  });

  // No tool may take the pre-rename spelling, and no response may echo it. A
  // stale `businessIds` would sit one letter from the counterparty filters
  // (`byBusinesses`, and documents' own `filters.businessIds`) — which is what
  // the rename set out to remove.
  it('no scoped tool still accepts the pre-rename `businessIds` at the top level', () => {
    for (const tool of BUSINESS_SCOPED_TOOLS) {
      expect('businessIds' in tool.inputSchema.shape).toBe(false);
      expect('businessId' in tool.inputSchema.shape).toBe(false);
    }
  });

  it('accepts memberBusinessIds on every list tool and rejects out-of-scope ids uniformly', async () => {
    for (const tool of [searchChargesTool, listTagsTool, listTaxCategoriesTool]) {
      const result = await executeRegisteredTool({
        tool,
        rawArgs: { memberBusinessIds: ['not-mine'] },
        auth: authContext(['b1']),
        correlationId: 'c',
        client: clientReturning({}),
        authorization: 'Bearer t',
      });
      expect(result.isError, `${tool.name} should reject an out-of-scope id`).toBe(true);
    }
  });
});

describe('echoed effective scope', () => {
  const FIXTURES = [
    [listTagsTool, { allTags: [{ id: 't1', name: 'a', namePath: ['a'], ownerId: 'b1' }] }, 'tags'],
    [
      listTaxCategoriesTool,
      {
        taxCategories: [
          { id: 'tc1', name: 'c', ownerId: 'b1', irsCode: null, isActive: true, sortCode: null },
        ],
      },
      'taxCategories',
    ],
    [
      listBusinessesTool,
      { allBusinesses: { nodes: [{ id: 'b1', name: 'c', ownerId: 'b1', isActive: true }] } },
      'businesses',
    ],
  ] as const;

  it.each(FIXTURES.map(([tool, data, key]) => [tool.name, tool, data, key] as const))(
    '%s echoes scope.memberBusinessIds and tags rows with ownerId',
    async (_name, tool, data, itemsKey) => {
      const result = await executeRegisteredTool({
        tool,
        rawArgs: {},
        auth: authContext(['b1', 'b2']),
        correlationId: 'c',
        client: clientReturning(data),
        authorization: 'Bearer t',
      });

      const structured = result.structuredContent as Record<string, unknown> & {
        scope: { memberBusinessIds: string[] };
      };
      expect(structured.scope).toEqual({ memberBusinessIds: ['b1', 'b2'] });
      const rows = structured[itemsKey] as Array<{ ownerId?: string }>;
      expect(rows[0]?.ownerId).toBe('b1');
    },
  );

  it('balance report echoes the resolved scope alongside its memberBusinessId', async () => {
    const result = await executeRegisteredTool({
      tool: balanceReportTool,
      rawArgs: { memberBusinessId: 'b2', fromDate: '2026-01-01', toDate: '2026-03-01' },
      auth: authContext(['b1', 'b2']),
      correlationId: 'c',
      client: clientReturning({ transactionsForBalanceReport: [] }),
      authorization: 'Bearer t',
    });

    const structured = result.structuredContent as {
      memberBusinessId: string;
      scope: { memberBusinessIds: string[] };
    };
    expect(structured.memberBusinessId).toBe('b2');
    // The singular memberBusinessId narrows the scope, so the echo confirms it.
    expect(structured.scope).toEqual({ memberBusinessIds: ['b2'] });
  });

  /**
   * Owner tagging, across **every** row-producing tool.
   *
   * A caller with more than one membership gets a single merged list back, and
   * without a per-row owner there is no way to group, sort, or attribute it —
   * the ids on the rows are charge/transaction/document ids, not business ones.
   * The lookups and charges carried `ownerId` from the start; transactions,
   * documents and balance rows did not, which is what this locks in:
   *
   * - transactions: from the upstream `Transaction.ownerId` field, added for this
   * - documents: from the owner on the document's charge
   * - balance rows: the single business the report ran for
   *
   * Fixtures deliberately name a *different* owner per tool so a row echoing a
   * constant, or the scope leaking in as a default, still fails.
   */
  const OWNER_TAGGED = [
    [
      searchChargesTool,
      {},
      {
        allCharges: {
          nodes: [
            {
              id: 'c1',
              ownerId: 'b1',
              userDescription: 'x',
              owner: { id: 'b1', name: 'Acme' },
              totalAmount: null,
              minEventDate: '2026-01-05',
            },
          ],
          pageInfo: { totalPages: 1, totalRecords: 1, currentPage: 1, pageSize: 10 },
        },
      },
      'charges',
      'b1',
    ],
    [
      getChargesTool,
      { chargeIds: ['c1'] },
      { chargesByIDs: [{ id: 'c1', ownerId: 'b2', owner: { id: 'b2', name: 'Beta' }, tags: [] }] },
      'charges',
      'b2',
    ],
    [
      getTransactionsTool,
      { transactionIds: ['t1'] },
      {
        transactionsByIDs: [
          {
            id: 't1',
            chargeId: 'c1',
            ownerId: 'b1',
            eventDate: '2026-01-05',
            direction: 'DEBIT',
            sourceDescription: 'x',
          },
        ],
      },
      'transactions',
      'b1',
    ],
    [
      getDocumentsTool,
      { documentIds: ['d1'] },
      { documentsByIds: [{ id: 'd1', ownerId: 'b2', charge: { id: 'c1' } }] },
      'documents',
      'b2',
    ],
  ] as const;

  it.each(OWNER_TAGGED.map(([tool, args, data, key, owner]) => [tool.name, tool, args, data, key, owner] as const))(
    '%s tags every row with its ownerId',
    async (_name, tool, rawArgs, data, itemsKey, expectedOwner) => {
      const result = await executeRegisteredTool({
        tool,
        rawArgs,
        auth: authContext(['b1', 'b2']),
        correlationId: 'c',
        client: clientReturning(data),
        authorization: 'Bearer t',
      });

      expect(result.isError).toBeUndefined();
      const rows = (result.structuredContent as Record<string, unknown>)[itemsKey] as Array<{
        ownerId?: string | null;
      }>;
      expect(rows).toHaveLength(1);
      expect(rows[0]?.ownerId).toBe(expectedOwner);
    },
  );

  it('balance report rows carry the reported business as ownerId', async () => {
    const result = await executeRegisteredTool({
      tool: balanceReportTool,
      rawArgs: { memberBusinessId: 'b2', fromDate: '2026-01-01', toDate: '2026-03-01' },
      auth: authContext(['b1', 'b2']),
      correlationId: 'c',
      client: clientReturning({
        transactionsForBalanceReport: [
          {
            id: 't1',
            chargeId: 'c1',
            date: '2026-01-05',
            isFee: false,
            description: 'x',
            amount: { raw: 10, formatted: '10', currency: 'ILS' },
          },
        ],
      }),
      authorization: 'Bearer t',
    });

    const rows = (result.structuredContent as { rows: Array<{ ownerId?: string }> }).rows;
    expect(rows[0]?.ownerId).toBe('b2');
  });

  // The nested children of a charge are rows too: a model reading them out of a
  // multi-business charge list must be able to attribute them without walking
  // back up to the parent.
  it('charge-nested transactions and documents carry ownerId', async () => {
    const result = await executeRegisteredTool({
      tool: getChargesTool,
      rawArgs: { chargeIds: ['c1'], includeTransactions: true, includeDocuments: true },
      auth: authContext(['b1', 'b2']),
      correlationId: 'c',
      client: clientReturning({
        chargesByIDs: [
          {
            id: 'c1',
            ownerId: 'b2',
            owner: { id: 'b2', name: 'Beta' },
            tags: [],
            transactions: [
              {
                id: 't1',
                chargeId: 'c1',
                ownerId: 'b2',
                eventDate: '2026-01-05',
                direction: 'DEBIT',
                sourceDescription: 'x',
              },
            ],
            additionalDocuments: [{ id: 'd1', ownerId: 'b2', charge: { id: 'c1' } }],
          },
        ],
      }),
      authorization: 'Bearer t',
    });

    const charge = (
      result.structuredContent as {
        charges: Array<{
          transactions: Array<{ ownerId?: string | null }>;
          documents: Array<{ ownerId?: string | null }>;
        }>;
      }
    ).charges[0]!;
    expect(charge.transactions[0]?.ownerId).toBe('b2');
    expect(charge.documents[0]?.ownerId).toBe('b2');
  });

  // Discovery is the scope; echoing one would be circular.
  it('accounter_list_business_memberships does not echo a scope', async () => {
    const result = await executeRegisteredTool({
      tool: listBusinessMembershipsTool,
      rawArgs: {},
      auth: authContext(['b1']),
      correlationId: 'c',
      client: clientReturning({}),
      authorization: 'Bearer t',
    });

    expect(result.structuredContent as Record<string, unknown>).not.toHaveProperty('scope');
  });
});
