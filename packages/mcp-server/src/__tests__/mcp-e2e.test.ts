import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { TokenVerificationError, type AuthPrincipal } from '../auth/token.js';

/**
 * End-to-end integration / security tests.
 *
 * These drive the real HTTP server in-process over a loopback socket and
 * exercise the full request pipeline — routing, OAuth discovery, the 401
 * challenge, bearer verification, upstream membership resolution, per-tool
 * authorization, and the error taxonomy. Only the two true external
 * dependencies are mocked so the suite stays deterministic and service-free:
 *
 * - `verifyAccessToken` (would otherwise fetch a remote JWKS), and
 * - the upstream GraphQL client (fixtures keyed by operation name).
 *
 * Everything between — the transport, auth context, policy, and tools — is the
 * real production code.
 */

// --- Mock the Auth0 verifier: map opaque test tokens to principals. ---------
vi.mock('../auth/verifier.js', () => ({
  verifyAccessToken: vi.fn(async (token: string): Promise<AuthPrincipal> => {
    const base = {
      issuer: 'https://tenant.auth0.com/',
      audience: 'mcp-api',
      expiresAt: undefined,
    };
    if (token === 'owner-token') {
      return {
        ...base,
        subject: 'user-owner',
        scopes: ['business_owner'],
        email: 'owner@example.com',
        claims: { sub: 'user-owner' },
      };
    }
    if (token === 'viewer-token') {
      // Authenticated, but holds no roles/scopes.
      return {
        ...base,
        subject: 'user-viewer',
        scopes: [],
        email: 'viewer@example.com',
        claims: { sub: 'user-viewer' },
      };
    }
    throw new TokenVerificationError('token is invalid');
  }),
}));

// --- Mock the upstream GraphQL client with fixtures by operation. -----------
const AUTHORIZED_BUSINESS = 'aa000000-0000-4000-8000-000000000001';

function upstreamData(query: string): unknown {
  if (query.includes('myMemberships')) {
    return { myMemberships: [{ businessId: AUTHORIZED_BUSINESS, roleId: 'business_owner' }] };
  }
  if (query.includes('allCharges')) {
    return {
      allCharges: {
        nodes: [
          {
            id: 'charge-1',
            userDescription: 'Coffee supplies',
            totalAmount: { raw: -12.5, formatted: '-12.50', currency: 'ILS' },
            minEventDate: '2026-01-05',
          },
        ],
        pageInfo: { totalPages: 1, totalRecords: 1, currentPage: null, pageSize: null },
      },
    };
  }
  if (query.includes('allTags')) {
    return { allTags: [{ id: 'tag-1', name: 'food', namePath: ['food'] }] };
  }
  if (query.includes('taxCategories')) {
    return { taxCategories: [{ id: 'tc-1', name: 'Income', irsCode: 100, isActive: true }] };
  }
  if (query.includes('transactionsForBalanceReport')) {
    return {
      transactionsForBalanceReport: [
        {
          id: 'row-1',
          chargeId: 'charge-1',
          date: '2026-01-05',
          isFee: false,
          description: 'Opening balance',
          amount: { raw: 100, formatted: '100.00', currency: 'ILS' },
        },
      ],
    };
  }
  throw new Error(`unexpected upstream query: ${query}`);
}

const fakeUpstreamClient = {
  query: vi.fn(async (request: { query: string }) => upstreamData(request.query)),
};

vi.mock('../upstream/default-client.js', () => ({
  getUpstreamClient: () => fakeUpstreamClient,
  resetUpstreamClient: () => {},
}));

// ---------------------------------------------------------------------------

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  vi.stubEnv('MCP_PUBLIC_BASE_URL', 'https://mcp.example.com');
  vi.stubEnv('AUTH0_ISSUER_URL', 'https://tenant.auth0.com/');
  vi.stubEnv('AUTH0_AUDIENCE', 'mcp-api');
  vi.stubEnv('GRAPHQL_UPSTREAM_URL', 'http://localhost:4000/graphql');
  vi.stubEnv('MCP_ENABLED', '1');
  const { resetEnvCache } = await import('../config/env.js');
  resetEnvCache();

  const { createHttpServer } = await import('../server.js');
  server = createHttpServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close(error => (error ? reject(error) : resolve())),
  );
  const { resetEnvCache } = await import('../config/env.js');
  vi.unstubAllEnvs();
  resetEnvCache();
});

type JsonRecord = Record<string, unknown>;

async function getPath(path: string, token?: string) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  return res;
}

async function rpc(
  method: string,
  { params, token, id = 1 }: { params?: unknown; token?: string; id?: number | string | null } = {},
) {
  const res = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, ...(params !== undefined && { params }) }),
  });
  return res;
}

/** Call a registered tool and return its parsed structuredContent + isError. */
async function callTool(name: string, args: JsonRecord, token: string) {
  const res = await rpc('tools/call', { params: { name, arguments: args }, token });
  expect(res.status).toBe(200);
  const body = (await res.json()) as { result: { isError?: boolean; structuredContent?: JsonRecord } };
  return body.result;
}

describe('discovery and the 401 challenge', () => {
  it('serves health without auth', async () => {
    const res = await getPath('/health');
    expect(res.status).toBe(200);
    expect(((await res.json()) as JsonRecord).status).toBe('ok');
  });

  it('serves OAuth protected-resource metadata', async () => {
    const res = await getPath('/.well-known/oauth-protected-resource');
    expect(res.status).toBe(200);
    const body = (await res.json()) as JsonRecord;
    expect(body.resource).toBe('https://mcp.example.com');
    expect(body.authorization_servers).toEqual(['https://tenant.auth0.com/']);
  });

  it('challenges an unauthenticated POST /mcp with 401 + resource_metadata pointer', async () => {
    const res = await rpc('tools/list');
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toContain(
      'resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource"',
    );
  });

  it('rejects an invalid token with 401 + error="invalid_token"', async () => {
    const res = await rpc('tools/list', { token: 'garbage' });
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toContain('error="invalid_token"');
  });
});

describe('authenticated tool invocation', () => {
  it('initializes and lists the curated tools', async () => {
    const initRes = await rpc('initialize', { token: 'owner-token' });
    expect(initRes.status).toBe(200);
    expect(((await initRes.json()) as { result: JsonRecord }).result.protocolVersion).toBeTruthy();

    const listRes = await rpc('tools/list', { token: 'owner-token' });
    const tools = (
      (await listRes.json()) as { result: { tools: Array<{ name: string }> } }
    ).result.tools.map(t => t.name);
    expect(tools).toEqual(
      expect.arrayContaining([
        'accounter_search_charges',
        'accounter_list_tags',
        'accounter_list_tax_categories',
        'accounter_balance_report',
      ]),
    );
  });

  it('runs a charges search scoped to the caller and returns structured results', async () => {
    const result = await callTool('accounter_search_charges', { fromDate: '2026-01-01' }, 'owner-token');
    expect(result.isError).toBeUndefined();
    const { charges } = result.structuredContent as { charges: Array<{ id: string }> };
    expect(charges).toHaveLength(1);
    expect(charges[0].id).toBe('charge-1');
  });

  it('runs a role-gated balance report for a caller who holds the role', async () => {
    const result = await callTool(
      'accounter_balance_report',
      { businessId: AUTHORIZED_BUSINESS, fromDate: '2026-01-01', toDate: '2026-01-31' },
      'owner-token',
    );
    expect(result.isError).toBeUndefined();
    const { rows } = result.structuredContent as { rows: unknown[] };
    expect(rows).toHaveLength(1);
  });
});

describe('tenant isolation and authorization', () => {
  it('denies a charges search narrowed to a business outside the memberships', async () => {
    const result = await callTool(
      'accounter_search_charges',
      { businessIds: ['bb000000-0000-4000-8000-000000000999'] },
      'owner-token',
    );
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('AUTHORIZATION_ERROR');
  });

  it('denies a role-gated tool to an authenticated caller without the role', async () => {
    const result = await callTool(
      'accounter_balance_report',
      { businessId: AUTHORIZED_BUSINESS, fromDate: '2026-01-01', toDate: '2026-01-31' },
      'viewer-token',
    );
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('AUTHORIZATION_ERROR');
  });
});

describe('malformed input and error taxonomy', () => {
  it('maps an unknown tool-input field to a VALIDATION_ERROR with issues', async () => {
    const result = await callTool('accounter_search_charges', { bogusField: true }, 'owner-token');
    expect(result.isError).toBe(true);
    const structured = result.structuredContent as { code: string; issues?: unknown[] };
    expect(structured.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(structured.issues)).toBe(true);
  });

  it('maps an impossible calendar date to a VALIDATION_ERROR', async () => {
    const result = await callTool('accounter_search_charges', { toDate: '2026-02-31' }, 'owner-token');
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
  });

  it('maps a non-existent tool name to a JSON-RPC InvalidParams error', async () => {
    const res = await rpc('tools/call', {
      params: { name: 'accounter_not_a_tool', arguments: {} },
      token: 'owner-token',
    });
    const body = (await res.json()) as { error?: { code: number; message: string } };
    expect(body.error?.code).toBe(-32602);
    expect(body.error?.message).toContain('Unknown tool');
  });

  it('maps invalid JSON to a JSON-RPC ParseError', async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer owner-token' },
      body: '{ not json',
    });
    const body = (await res.json()) as { error?: { code: number } };
    expect(body.error?.code).toBe(-32700);
  });
});
