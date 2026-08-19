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

function upstreamData(query: string, authorization?: string): unknown {
  if (query.includes('myMemberships')) {
    // Vary memberships by the forwarded caller so the fixture stays consistent
    // with each principal: the owner holds a business, the roleless viewer holds
    // none. (Keeps the suite honest if role gating ever moves from token scopes
    // to membership roles.)
    if (authorization === 'Bearer owner-token') {
      return {
        // Upstream payload keys, not the internal shape: `myMemberships` rows
        // arrive as `businessId` and `coerceMembership` maps them onto the
        // internal `memberBusinessId`.
        myMemberships: [
          { businessId: AUTHORIZED_BUSINESS, roleId: 'business_owner', businessName: 'Acme Ltd' },
        ],
      };
    }
    return { myMemberships: [] };
  }
  if (query.includes('allCharges')) {
    return {
      allCharges: {
        nodes: [
          {
            id: 'charge-1',
            ownerId: AUTHORIZED_BUSINESS,
            userDescription: 'Coffee supplies',
            owner: { id: AUTHORIZED_BUSINESS, name: 'Acme Ltd' },
            totalAmount: { raw: -12.5, formatted: '-12.50', currency: 'ILS' },
            minEventDate: '2026-01-05',
          },
        ],
        pageInfo: { totalPages: 1, totalRecords: 1, currentPage: null, pageSize: null },
      },
    };
  }
  if (query.includes('allTags')) {
    return {
      allTags: [{ id: 'tag-1', name: 'food', namePath: ['food'], ownerId: AUTHORIZED_BUSINESS }],
    };
  }
  if (query.includes('taxCategories')) {
    return {
      taxCategories: [
        {
          id: 'tc-1',
          name: 'Income',
          ownerId: AUTHORIZED_BUSINESS,
          irsCode: 100,
          isActive: true,
          sortCode: null,
        },
      ],
    };
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
  if (query.includes('batchUpdateChargesTags')) {
    return {
      batchUpdateChargesTags: {
        __typename: 'BatchUpdateChargesTagsSuccessfulResult',
        charges: [{ id: 'charge-1', tags: [{ id: 'tag-1', name: 'travel' }] }],
      },
    };
  }
  if (query.includes('batchUploadDocuments')) {
    return {
      batchUploadDocuments: [
        {
          __typename: 'UploadDocumentSuccessfulResult',
          document: { id: 'doc-1', documentType: 'INVOICE' },
        },
      ],
    };
  }
  throw new Error(`unexpected upstream query: ${query}`);
}

/**
 * Records the business scope forwarded on each upstream call, so the e2e can
 * assert that tool calls carry `x-business-scope` while the membership
 * bootstrap — the query that *discovers* the scope — carries none.
 */
const forwardedScopes: Array<{ query: string; businessScope?: readonly string[] }> = [];

type UpstreamCall = (
  request: { query: string },
  context: { authorization?: string; businessScope?: readonly string[] },
) => Promise<unknown>;

const record: UpstreamCall = async (request, context) => {
  forwardedScopes.push({ query: request.query, businessScope: context.businessScope });
  return upstreamData(request.query, context.authorization);
};

const fakeUpstreamClient = {
  query: vi.fn(record),
  mutate: vi.fn(record),
  // The real signature takes `(request, files, context)`; the files are asserted
  // in the unit suites, so here the third argument is what matters.
  mutateMultipart: vi.fn(
    async (
      request: { query: string },
      _files: unknown,
      context: { authorization?: string; businessScope?: readonly string[] },
    ) => record(request, context),
  ),
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
        'accounter_list_business_memberships',
        'accounter_list_businesses',
        'accounter_search_charges',
        'accounter_list_tags',
        'accounter_list_tax_categories',
        'accounter_balance_report',
      ]),
    );
    // Discovery leads the list, and the internal smoke tool is not advertised.
    expect(tools[0]).toBe('accounter_list_business_memberships');
    expect(tools).not.toContain('accounter_smoke_ping');
    // MCP_ENABLE_WRITE_TOOLS is unset here, which is the default a deployment
    // upgrades into: the write tools must not appear.
    expect(tools).not.toContain('accounter_update_charges_tags');
    expect(tools).not.toContain('accounter_upload_documents');
  });

  it('rejects a write tool as unknown while writes are disabled', async () => {
    const res = await rpc('tools/call', {
      params: {
        name: 'accounter_update_charges_tags',
        arguments: { chargeIds: ['charge-1'], addTagIds: ['tag-1'] },
      },
      token: 'owner-token',
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { error?: { message: string } };
    // Indistinguishable from a nonexistent tool — a disabled capability must not
    // announce itself as merely switched off.
    expect(body.error?.message).toMatch(/Unknown tool/);
  });

  it('runs a charges search scoped to the caller and returns structured results', async () => {
    const result = await callTool('accounter_search_charges', { fromDate: '2026-01-01' }, 'owner-token');
    expect(result.isError).toBeUndefined();
    const { charges, scope } = result.structuredContent as {
      charges: Array<{ id: string; ownerId: string | null; ownerName: string | null }>;
      scope: { memberBusinessIds: string[] };
    };
    expect(charges).toHaveLength(1);
    expect(charges[0].id).toBe('charge-1');
    // Rows are owner-tagged and the response echoes the effective scope.
    expect(charges[0].ownerId).toBe(AUTHORIZED_BUSINESS);
    expect(charges[0].ownerName).toBe('Acme Ltd');
    expect(scope).toEqual({ memberBusinessIds: [AUTHORIZED_BUSINESS] });
  });

  it('forwards x-business-scope on tool calls but never on the membership bootstrap', async () => {
    forwardedScopes.length = 0;
    await callTool('accounter_list_tags', {}, 'owner-token');

    const bootstrap = forwardedScopes.filter(c => c.query.includes('myMemberships'));
    const toolCalls = forwardedScopes.filter(c => !c.query.includes('myMemberships'));

    expect(bootstrap.length).toBeGreaterThan(0);
    // Scoping the scope-discovery query would be circular; it must stay unscoped.
    for (const call of bootstrap) {
      expect(call.businessScope).toBeUndefined();
    }
    expect(toolCalls.length).toBeGreaterThan(0);
    for (const call of toolCalls) {
      expect(call.businessScope).toEqual([AUTHORIZED_BUSINESS]);
    }
  });

  it('lists the caller businesses without any upstream call', async () => {
    forwardedScopes.length = 0;
    const result = await callTool('accounter_list_business_memberships', {}, 'owner-token');

    const { businesses } = result.structuredContent as {
      businesses: Array<{ memberBusinessId: string; name: string | null; role: string }>;
    };
    expect(businesses).toEqual([
      { memberBusinessId: AUTHORIZED_BUSINESS, name: 'Acme Ltd', role: 'business_owner' },
    ]);
    // Only the membership bootstrap talks upstream; the handler itself is pure.
    expect(forwardedScopes.every(c => c.query.includes('myMemberships'))).toBe(true);
  });

  it('runs a role-gated balance report for a caller who holds the role', async () => {
    const result = await callTool(
      'accounter_balance_report',
      { memberBusinessId: AUTHORIZED_BUSINESS, fromDate: '2026-01-01', toDate: '2026-01-31' },
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
      { memberBusinessIds: ['bb000000-0000-4000-8000-000000000999'] },
      'owner-token',
    );
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('AUTHORIZATION_ERROR');
  });

  it('denies a role-gated tool to an authenticated caller without the role', async () => {
    const result = await callTool(
      'accounter_balance_report',
      { memberBusinessId: AUTHORIZED_BUSINESS, fromDate: '2026-01-01', toDate: '2026-01-31' },
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

/**
 * The write tools, on a server started with `MCP_ENABLE_WRITE_TOOLS=1`.
 *
 * A second server is spun up rather than flipping the flag on the shared one:
 * the config is memoized per process, and the default-off case above is exactly
 * what the rest of this file must keep asserting.
 */
describe('write tools with MCP_ENABLE_WRITE_TOOLS=1', () => {
  let writeServer: Server;
  let writeBaseUrl: string;

  beforeAll(async () => {
    vi.stubEnv('MCP_ENABLE_WRITE_TOOLS', '1');
    const { resetEnvCache } = await import('../config/env.js');
    resetEnvCache();

    const { createHttpServer } = await import('../server.js');
    writeServer = createHttpServer();
    await new Promise<void>(resolve => writeServer.listen(0, '127.0.0.1', resolve));
    const { port } = writeServer.address() as AddressInfo;
    writeBaseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      writeServer.close(error => (error ? reject(error) : resolve())),
    );
    // Restore the default so nothing after this block inherits write access.
    vi.stubEnv('MCP_ENABLE_WRITE_TOOLS', '0');
    const { resetEnvCache } = await import('../config/env.js');
    resetEnvCache();
  });

  async function writeRpc(method: string, params: unknown, token = 'owner-token') {
    const res = await fetch(`${writeBaseUrl}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    expect(res.status).toBe(200);
    return (await res.json()) as {
      result?: { isError?: boolean; structuredContent?: JsonRecord };
      error?: { message: string };
    };
  }

  it('advertises both write tools, after the read tools', async () => {
    const res = await fetch(`${writeBaseUrl}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer owner-token' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    const tools = (
      (await res.json()) as { result: { tools: Array<{ name: string }> } }
    ).result.tools.map(t => t.name);

    expect(tools).toContain('accounter_update_charges_tags');
    expect(tools).toContain('accounter_upload_documents');
    // Reads still lead: a tool that changes data should not be the first thing
    // the model reaches for.
    expect(tools.indexOf('accounter_update_charges_tags')).toBeGreaterThan(
      tools.indexOf('accounter_search_charges'),
    );
  });

  it('updates charge tags end to end', async () => {
    const body = await writeRpc('tools/call', {
      name: 'accounter_update_charges_tags',
      arguments: { chargeIds: ['charge-1'], addTagIds: ['tag-1'] },
    });

    expect(body.result?.isError).toBeUndefined();
    const structured = body.result?.structuredContent as JsonRecord;
    expect(structured.ok).toBe(true);
    expect(structured.action).toBe('update_charges_tags');
    expect(structured.updatedCount).toBe(1);
    expect(fakeUpstreamClient.mutate).toHaveBeenCalled();
    // The write is scoped to the caller's single membership.
    expect(structured.scope).toEqual({ memberBusinessIds: [AUTHORIZED_BUSINESS] });
  });

  it('uploads a document to an existing charge', async () => {
    const body = await writeRpc('tools/call', {
      name: 'accounter_upload_documents',
      arguments: {
        chargeId: 'charge-1',
        documents: [
          { filename: 'invoice.pdf', mimeType: 'application/pdf', contentBase64: 'aGVsbG8=' },
        ],
      },
    });

    expect(body.result?.isError).toBeUndefined();
    const structured = body.result?.structuredContent as JsonRecord;
    expect(structured.ok).toBe(true);
    expect(structured.uploadedCount).toBe(1);
    expect(structured.failedCount).toBe(0);
    expect(structured.isSensitive).toBe(false);
    expect(fakeUpstreamClient.mutateMultipart).toHaveBeenCalled();
  });

  it('denies a write to a caller with no memberships', async () => {
    const body = await writeRpc(
      'tools/call',
      {
        name: 'accounter_update_charges_tags',
        arguments: { chargeIds: ['charge-1'], addTagIds: ['tag-1'] },
      },
      'viewer-token',
    );

    expect(body.result?.isError).toBe(true);
    expect((body.result?.structuredContent as JsonRecord).code).toBe('AUTHORIZATION_ERROR');
  });
});
