import { describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { BUSINESS_SCOPE_HEADER, UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import { searchChargesTool } from '../charges.js';
import { executeRegisteredTool } from '../execute.js';
import { listTagsTool, listTaxCategoriesTool } from '../lookups.js';

/**
 * End-to-end wiring check for Phase 2: the resolved read scope must reach the
 * upstream server as `x-business-scope` on every tool call.
 *
 * These assert on the actual outbound HTTP headers rather than on the context
 * object, so a handler that hand-builds `{ correlationId, authorization }` and
 * drops the scope fails here — which is the whole point of centralizing it.
 */

function authContext(businessIds: string[]): McpAuthContext {
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
    businessIds.map(businessId => ({ businessId, roleId: 'accountant' })),
  );
}

function spyClient(data: unknown) {
  const fetchImpl = vi.fn(
    async () => ({ ok: true, status: 200, json: async () => ({ data }) }) as unknown as Response,
  );
  const client = new UpstreamGraphQLClient({
    endpoint: 'http://localhost:4000/graphql',
    timeoutMs: 1000,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  const sentHeaders = () =>
    (fetchImpl.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
  return { client, sentHeaders };
}

const TAGS_DATA = { allTags: [{ id: '1', name: 'apple', namePath: ['apple'] }] };
const TAX_CATEGORIES_DATA = {
  taxCategories: [{ id: '1', name: 'Cat', irsCode: null, isActive: true, sortCode: null }],
};

describe('x-business-scope forwarding', () => {
  it('forwards the full default scope when the caller does not narrow', async () => {
    const { client, sentHeaders } = spyClient(TAGS_DATA);
    await executeRegisteredTool({
      tool: listTagsTool,
      rawArgs: {},
      auth: authContext(['b1', 'b2']),
      correlationId: 'c',
      client,
      authorization: 'Bearer t',
    });

    expect(sentHeaders()[BUSINESS_SCOPE_HEADER]).toBe('b1,b2');
  });

  it('forwards the narrowed scope when the caller requests a subset', async () => {
    const { client, sentHeaders } = spyClient({
      allCharges: { nodes: [], pageInfo: { totalPages: 1, currentPage: 1 } },
    });
    await executeRegisteredTool({
      tool: searchChargesTool,
      rawArgs: { businessIds: ['b2'] },
      auth: authContext(['b1', 'b2']),
      correlationId: 'c',
      client,
      authorization: 'Bearer t',
    });

    expect(sentHeaders()[BUSINESS_SCOPE_HEADER]).toBe('b2');
  });

  it('forwards the scope on lookups that take no business argument', async () => {
    const { client, sentHeaders } = spyClient(TAX_CATEGORIES_DATA);
    await executeRegisteredTool({
      tool: listTaxCategoriesTool,
      rawArgs: {},
      auth: authContext(['b1']),
      correlationId: 'c',
      client,
      authorization: 'Bearer t',
    });

    // The whole reason Phase 2 exists: `taxCategories` takes no arguments, so
    // the header is the only way to narrow it.
    expect(sentHeaders()[BUSINESS_SCOPE_HEADER]).toBe('b1');
  });
});
