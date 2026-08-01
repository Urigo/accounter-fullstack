import { describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import { listBusinessesTool } from '../businesses.js';
import { searchChargesTool } from '../charges.js';
import { executeRegisteredTool } from '../execute.js';
import { listTagsTool, listTaxCategoriesTool } from '../lookups.js';
import { balanceReportTool } from '../reports.js';
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

function authContext(businessIds: string[]): McpAuthContext {
  return buildAuthContext(
    PRINCIPAL,
    businessIds.map(businessId => ({ businessId, roleId: 'accountant' })),
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
  listTagsTool,
  listTaxCategoriesTool,
  balanceReportTool,
];

const MULTI_BUSINESS_TOOLS = [searchChargesTool, listTagsTool, listTaxCategoriesTool];

describe('uniform business-scope input', () => {
  it.each(MULTI_BUSINESS_TOOLS.map(tool => [tool.name, tool] as const))(
    '%s teaches the multi-business scoping workflow',
    (_name, tool) => {
      expect(tool.description).toContain(SCOPE_DESCRIPTION_SUFFIX);
    },
  );

  // The single-business report must NOT claim an optional `businessIds` or
  // per-row `ownerId` — it has neither. It still points at discovery.
  it('balance report uses the single-business clause, not the list-tool one', () => {
    expect(balanceReportTool.description).toContain(SINGLE_BUSINESS_SCOPE_DESCRIPTION_SUFFIX);
    expect(balanceReportTool.description).not.toContain(SCOPE_DESCRIPTION_SUFFIX);
  });

  it.each(BUSINESS_SCOPED_TOOLS.map(tool => [tool.name, tool] as const))(
    '%s points at the discovery tool',
    (_name, tool) => {
      expect(tool.description).toContain('accounter_list_businesses');
    },
  );

  // Guards the mismatch Copilot caught on #4094: a description may only promise
  // `businessIds` if the tool actually accepts that field.
  it.each(BUSINESS_SCOPED_TOOLS.map(tool => [tool.name, tool] as const))(
    '%s only advertises `businessIds` if it accepts it',
    (_name, tool) => {
      const acceptsBusinessIds = 'businessIds' in tool.inputSchema.shape;
      expect(tool.description.includes('`businessIds`')).toBe(acceptsBusinessIds);
    },
  );

  it('gives the three list tools an identical businessIds description', () => {
    const describeField = (tool: (typeof BUSINESS_SCOPED_TOOLS)[number]) =>
      (tool.inputSchema.shape as Record<string, { description?: string }>).businessIds?.description;

    const descriptions = [searchChargesTool, listTagsTool, listTaxCategoriesTool].map(describeField);

    expect(descriptions[0]).toBeDefined();
    expect(new Set(descriptions).size).toBe(1);
  });

  it('accepts businessIds on every list tool and rejects out-of-scope ids uniformly', async () => {
    for (const tool of [searchChargesTool, listTagsTool, listTaxCategoriesTool]) {
      const result = await executeRegisteredTool({
        tool,
        rawArgs: { businessIds: ['not-mine'] },
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
  ] as const;

  it.each(FIXTURES.map(([tool, data, key]) => [tool.name, tool, data, key] as const))(
    '%s echoes scope.businessIds and tags rows with ownerId',
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
        scope: { businessIds: string[] };
      };
      expect(structured.scope).toEqual({ businessIds: ['b1', 'b2'] });
      const rows = structured[itemsKey] as Array<{ ownerId?: string }>;
      expect(rows[0]?.ownerId).toBe('b1');
    },
  );

  it('balance report echoes the resolved scope alongside its businessId', async () => {
    const result = await executeRegisteredTool({
      tool: balanceReportTool,
      rawArgs: { businessId: 'b2', fromDate: '2026-01-01', toDate: '2026-03-01' },
      auth: authContext(['b1', 'b2']),
      correlationId: 'c',
      client: clientReturning({ transactionsForBalanceReport: [] }),
      authorization: 'Bearer t',
    });

    const structured = result.structuredContent as {
      businessId: string;
      scope: { businessIds: string[] };
    };
    expect(structured.businessId).toBe('b2');
    // The singular businessId narrows the scope, so the echo confirms it.
    expect(structured.scope).toEqual({ businessIds: ['b2'] });
  });

  // Discovery is the scope; echoing one would be circular.
  it('accounter_list_businesses does not echo a scope', async () => {
    const result = await executeRegisteredTool({
      tool: listBusinessesTool,
      rawArgs: {},
      auth: authContext(['b1']),
      correlationId: 'c',
      client: clientReturning({}),
      authorization: 'Bearer t',
    });

    expect(result.structuredContent as Record<string, unknown>).not.toHaveProperty('scope');
  });
});
