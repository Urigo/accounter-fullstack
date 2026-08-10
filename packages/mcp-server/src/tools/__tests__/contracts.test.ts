import { describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import { getContractsTool, MAX_CONTRACTS } from '../contracts.js';
import { executeRegisteredTool } from '../execute.js';

function authContext(memberBusinessIds: string[]): McpAuthContext {
  const principal: AuthPrincipal = {
    subject: 'user-1',
    issuer: 'https://tenant.auth0.com/',
    audience: 'aud',
    scopes: [],
    email: null,
    expiresAt: undefined,
    claims: { sub: 'user-1' },
  };
  return buildAuthContext(
    principal,
    memberBusinessIds.map(memberBusinessId => ({ memberBusinessId, roleId: 'accountant' })),
  );
}

function clientReturning(data: unknown, capture?: (body: unknown) => void) {
  const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
    capture?.(JSON.parse(init.body as string));
    return { ok: true, status: 200, json: async () => ({ data }) } as unknown as Response;
  });
  return new UpstreamGraphQLClient({
    endpoint: 'http://localhost:4000/graphql',
    timeoutMs: 1000,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
}

function run(client: UpstreamGraphQLClient, auth: McpAuthContext, rawArgs: unknown) {
  return executeRegisteredTool({
    tool: getContractsTool,
    rawArgs,
    auth,
    correlationId: 'corr-1',
    client,
    authorization: 'Bearer tok',
  });
}

const contract = {
  id: 'contract-1',
  adminId: 'b1',
  isActive: true,
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  billingCycle: 'MONTHLY',
  documentType: 'INVOICE',
  product: 'HIVE',
  plan: null,
  purchaseOrders: ['PO-1'],
  remarks: null,
  amount: { raw: 1000, formatted: '$1,000.00', currency: 'USD' },
  client: { id: 'client-1', originalBusiness: { id: 'biz-9', name: 'Acme' } },
};

describe('getContractsTool — successful read', () => {
  it('normalizes contracts and reports the owning admin business', async () => {
    const client = clientReturning({ contractsByFilters: [contract] });
    const result = await run(client, authContext(['b1']), {});

    expect(result.isError).toBeUndefined();
    const structured = result.structuredContent as {
      contracts: Array<Record<string, unknown>>;
      totalCount: number;
      scope: { memberBusinessIds: string[] };
    };
    expect(structured.contracts).toEqual([
      {
        id: 'contract-1',
        adminId: 'b1',
        client: { id: 'client-1', businessId: 'biz-9', name: 'Acme' },
        isActive: true,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        billingCycle: 'MONTHLY',
        documentType: 'INVOICE',
        product: 'HIVE',
        plan: null,
        purchaseOrders: ['PO-1'],
        remarks: null,
        amount: { value: 1000, formatted: '$1,000.00', currency: 'USD' },
      },
    ]);
    expect(structured.totalCount).toBe(1);
    expect(structured.scope).toEqual({ memberBusinessIds: ['b1'] });
  });

  it('sends the resolved read scope as adminIds', async () => {
    let body: unknown;
    const client = clientReturning({ contractsByFilters: [] }, captured => {
      body = captured;
    });
    await run(client, authContext(['b1', 'b2']), {});

    const filters = (body as { variables: { filters: Record<string, unknown> } }).variables.filters;
    expect(filters).toEqual({ adminIds: ['b1', 'b2'] });
  });

  it('forwards client, contract and active filters', async () => {
    let body: unknown;
    const client = clientReturning({ contractsByFilters: [] }, captured => {
      body = captured;
    });
    await run(client, authContext(['b1']), {
      clientIds: ['client-1'],
      contractIds: ['contract-1'],
      isActive: false,
    });

    const filters = (body as { variables: { filters: Record<string, unknown> } }).variables.filters;
    expect(filters).toEqual({
      adminIds: ['b1'],
      clientIds: ['client-1'],
      contractIds: ['contract-1'],
      isActive: false,
    });
  });

  // The admin axis is narrowed through the scope field, which the policy layer
  // validates against memberships — so a narrowed scope narrows `adminIds`, and
  // an out-of-scope id is rejected rather than intersected away (see below).
  it('narrows adminIds when memberBusinessIds narrows the scope', async () => {
    let body: unknown;
    const client = clientReturning({ contractsByFilters: [] }, captured => {
      body = captured;
    });
    await run(client, authContext(['b1', 'b2']), { memberBusinessIds: ['b2'] });

    const filters = (body as { variables: { filters: { adminIds: string[] } } }).variables.filters;
    expect(filters.adminIds).toEqual(['b2']);
  });
});

describe('getContractsTool — input validation', () => {
  it(`rejects a limit above ${MAX_CONTRACTS}`, async () => {
    const result = await run(clientReturning({}), authContext(['b1']), {
      limit: MAX_CONTRACTS + 1,
    });
    expect(result.isError).toBe(true);
  });

  it('rejects unknown fields', async () => {
    const result = await run(clientReturning({}), authContext(['b1']), { unknownField: true });
    expect(result.isError).toBe(true);
  });

  it('rejects an out-of-scope memberBusinessId', async () => {
    const result = await run(clientReturning({}), authContext(['b1']), {
      memberBusinessIds: ['not-mine'],
    });
    expect(result.isError).toBe(true);
  });
});
