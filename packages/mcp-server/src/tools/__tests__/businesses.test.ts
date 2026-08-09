import { describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type BusinessMembership, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import { listBusinessMembershipsTool } from '../businesses.js';
import { executeRegisteredTool } from '../execute.js';

const PRINCIPAL: AuthPrincipal = {
  subject: 'user-1',
  issuer: 'https://tenant.auth0.com/',
  audience: 'aud',
  scopes: [],
  email: null,
  expiresAt: undefined,
  claims: { sub: 'user-1' },
};

function authContext(memberships: BusinessMembership[]): McpAuthContext {
  return buildAuthContext(PRINCIPAL, memberships);
}

/** The handler is pure; this client exists only to prove it is never called. */
function neverCalledClient() {
  const fetchImpl = vi.fn(async () => {
    throw new Error('upstream must not be called by accounter_list_business_memberships');
  });
  const client = new UpstreamGraphQLClient({
    endpoint: 'http://localhost:4000/graphql',
    timeoutMs: 1000,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return { client, fetchImpl };
}

const run = (auth: McpAuthContext, client: UpstreamGraphQLClient) =>
  executeRegisteredTool({
    tool: listBusinessMembershipsTool,
    rawArgs: {},
    auth,
    correlationId: 'c',
    client,
    authorization: 'Bearer t',
  });

interface Structured {
  businesses: Array<{ memberBusinessId: string; name: string | null; role: string }>;
  returnedCount: number;
  totalCount: number;
}

describe('listBusinessMembershipsTool', () => {
  it('lists memberships as {memberBusinessId, name, role} without any upstream call', async () => {
    const { client, fetchImpl } = neverCalledClient();
    const result = await run(
      authContext([
        { memberBusinessId: 'b1', roleId: 'business_owner', businessName: 'Acme' },
        { memberBusinessId: 'b2', roleId: 'accountant', businessName: 'Beta' },
      ]),
      client,
    );

    expect(result.isError).toBeUndefined();
    const structured = result.structuredContent as Structured;
    expect(structured.businesses).toEqual([
      { memberBusinessId: 'b1', name: 'Acme', role: 'business_owner' },
      { memberBusinessId: 'b2', name: 'Beta', role: 'accountant' },
    ]);
    expect(structured.totalCount).toBe(2);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sorts by name case-insensitively, then by id', async () => {
    const { client } = neverCalledClient();
    const result = await run(
      authContext([
        { memberBusinessId: 'b3', roleId: 'accountant', businessName: 'zebra' },
        { memberBusinessId: 'b1', roleId: 'accountant', businessName: 'Apple' },
        { memberBusinessId: 'b2', roleId: 'accountant', businessName: 'apple' },
      ]),
      client,
    );

    const names = (result.structuredContent as Structured).businesses.map(b => [b.name, b.memberBusinessId]);
    expect(names).toEqual([
      ['Apple', 'b1'],
      ['apple', 'b2'],
      ['zebra', 'b3'],
    ]);
  });

  it('sorts unnamed businesses last but keeps them deterministic', async () => {
    const { client } = neverCalledClient();
    const result = await run(
      authContext([
        { memberBusinessId: 'b9', roleId: 'accountant' },
        { memberBusinessId: 'b1', roleId: 'accountant', businessName: 'Named' },
        { memberBusinessId: 'b4', roleId: 'accountant', businessName: null },
      ]),
      client,
    );

    expect((result.structuredContent as Structured).businesses).toEqual([
      { memberBusinessId: 'b1', name: 'Named', role: 'accountant' },
      { memberBusinessId: 'b4', name: null, role: 'accountant' },
      { memberBusinessId: 'b9', name: null, role: 'accountant' },
    ]);
  });

  // A blank name is normalized to null rather than being displayed as "", and
  // is grouped with the other unnamed entries. Mixing '' and null previously
  // made the comparator non-antisymmetric (it returned 1 in both directions),
  // so the ordering of unnamed entries was unstable rather than id-ordered.
  it('treats blank names as unnamed and orders them with the other unnamed by id', async () => {
    const { client } = neverCalledClient();
    const result = await run(
      authContext([
        { memberBusinessId: 'b5', roleId: 'accountant', businessName: '   ' },
        { memberBusinessId: 'b2', roleId: 'accountant', businessName: '' },
        { memberBusinessId: 'b3', roleId: 'accountant', businessName: null },
        { memberBusinessId: 'b1', roleId: 'accountant', businessName: 'Real' },
      ]),
      client,
    );

    expect((result.structuredContent as Structured).businesses).toEqual([
      { memberBusinessId: 'b1', name: 'Real', role: 'accountant' },
      { memberBusinessId: 'b2', name: null, role: 'accountant' },
      { memberBusinessId: 'b3', name: null, role: 'accountant' },
      { memberBusinessId: 'b5', name: null, role: 'accountant' },
    ]);
  });

  // The policy sets requiresBusinessScope: false on purpose — discovery must
  // tell a caller "you have no access" rather than failing with
  // AUTHORIZATION_ERROR, which would leave the model with no way to find out.
  it('returns an empty list (not an error) for a caller with no memberships', async () => {
    const { client } = neverCalledClient();
    const result = await run(authContext([]), client);

    expect(result.isError).toBeUndefined();
    const structured = result.structuredContent as Structured;
    expect(structured.businesses).toEqual([]);
    expect(structured.totalCount).toBe(0);
    expect(result.content[0]!.text).toContain('do not have access to any businesses');
  });
});
