import { describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { dispatchMcpBodyDualEra, MCP_PROTOCOL_VERSION } from '../handler.js';
import { McpErrorCode } from '../jsonrpc.js';
import {
  MODERN_PROTOCOL_VERSION,
  MODERN_SUPPORTED_VERSIONS,
  SERVER_DISCOVER_METHOD,
} from '../modern.js';

vi.mock('../../auth/verifier.js', () => ({ verifyAccessToken: vi.fn() }));
vi.mock('../../upstream/memberships.js', () => ({
  createUpstreamMembershipSource: () => () => Promise.resolve([]),
}));
vi.mock('../../upstream/default-client.js', () => ({ getUpstreamClient: () => ({}) }));

/**
 * The dual-era contract.
 *
 * The load-bearing half of this file is the *legacy* half. A dual-era client
 * decides which era a server speaks from the shape of its replies, and this
 * connector works today only because clients see legacy answers and fall back.
 * So the modern path may add whatever it likes, as long as a legacy request is
 * answered exactly as it was before any of this existed.
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

function auth(): McpAuthContext {
  return buildAuthContext(PRINCIPAL, [{ memberBusinessId: 'b1', roleId: 'accountant' }]);
}

function context(headers: Record<string, string | undefined> = {}) {
  return {
    auth: auth(),
    correlationId: 'corr-1',
    allowlist: [] as string[],
    writeToolsEnabled: false,
    headers,
  };
}

/** A well-formed modern request: `_meta` in the body, mirrored into headers. */
function modern(method: string, params: Record<string, unknown> = {}) {
  const body = {
    jsonrpc: '2.0',
    id: 1,
    method,
    params: {
      ...params,
      _meta: {
        'io.modelcontextprotocol/protocolVersion': MODERN_PROTOCOL_VERSION,
        'io.modelcontextprotocol/clientInfo': { name: 'claude-code', version: '2.1.263' },
        'io.modelcontextprotocol/clientCapabilities': { elicitation: {}, roots: {} },
      },
    },
  };
  const headers: Record<string, string | undefined> = {
    'mcp-protocol-version': MODERN_PROTOCOL_VERSION,
    'mcp-method': method,
  };
  if (typeof params.name === 'string') {
    headers['mcp-name'] = params.name;
  }
  return { raw: JSON.stringify(body), headers };
}

describe('era selection', () => {
  it('serves an `initialize` handshake as legacy, at 200', async () => {
    const { response, status } = await dispatchMcpBodyDualEra(
      JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
      context(),
    );

    expect(status).toBe(200);
    const result = (response as { result: Record<string, unknown> }).result;
    expect(result.protocolVersion).toBe(MCP_PROTOCOL_VERSION);
    // The legacy envelope has no modern fields bolted on.
    expect(result.resultType).toBeUndefined();
    expect(result._meta).toBeUndefined();
  });

  /**
   * The regression that would matter most: a legacy `tools/list` must be
   * answered exactly as before. If this drifts, dual-era clients stop falling
   * back and every current client breaks.
   */
  it('answers a legacy tools/list with no modern fields', async () => {
    const { response, status } = await dispatchMcpBodyDualEra(
      JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      context(),
    );

    expect(status).toBe(200);
    const result = (response as { result: Record<string, unknown> }).result;
    expect(Object.keys(result)).toEqual(['tools']);
  });

  it('serves a request carrying modern `_meta` as modern', async () => {
    const { raw, headers } = modern('tools/list');
    const { response, status } = await dispatchMcpBodyDualEra(raw, context(headers));

    expect(status).toBe(200);
    const result = (response as { result: Record<string, unknown> }).result;
    expect(result.resultType).toBe('complete');
    expect(result.tools).toBeDefined();
  });
});

describe('server/discover', () => {
  it('advertises only modern versions, and the one capability we implement', async () => {
    const { raw, headers } = modern(SERVER_DISCOVER_METHOD);
    const { response, status } = await dispatchMcpBodyDualEra(raw, context(headers));

    expect(status).toBe(200);
    const result = (response as { result: Record<string, unknown> }).result;
    expect(result.supportedVersions).toEqual([...MODERN_SUPPORTED_VERSIONS]);
    // Listing the legacy revision here would invite a client to "choose" a
    // version that has no per-request `_meta` to speak it with.
    expect(result.supportedVersions).not.toContain(MCP_PROTOCOL_VERSION);
    expect(result.capabilities).toEqual({ tools: {} });
    expect(result.resultType).toBe('complete');
    expect((result._meta as Record<string, unknown>)['io.modelcontextprotocol/serverInfo']).toMatchObject({
      name: '@accounter/mcp-server',
    });
  });
});

describe('modern framing failures use the statuses a client detects our era by', () => {
  it('rejects an unsupported version with -32022 and the supported list', async () => {
    const raw = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {
        _meta: {
          'io.modelcontextprotocol/protocolVersion': '2099-01-01',
          'io.modelcontextprotocol/clientCapabilities': {},
        },
      },
    });
    const { response, status } = await dispatchMcpBodyDualEra(
      raw,
      context({ 'mcp-protocol-version': '2099-01-01', 'mcp-method': 'tools/list' }),
    );

    expect(status).toBe(400);
    const error = (response as { error: { code: number; data: unknown } }).error;
    expect(error.code).toBe(McpErrorCode.UnsupportedProtocolVersion);
    expect(error.data).toEqual({ supported: [...MODERN_SUPPORTED_VERSIONS], requested: '2099-01-01' });
  });

  it('rejects a header that disagrees with the body with -32020', async () => {
    const { raw } = modern('tools/list');
    const { response, status } = await dispatchMcpBodyDualEra(
      raw,
      context({ 'mcp-protocol-version': MODERN_PROTOCOL_VERSION, 'mcp-method': 'tools/call' }),
    );

    expect(status).toBe(400);
    expect((response as { error: { code: number } }).error.code).toBe(McpErrorCode.HeaderMismatch);
  });

  it('rejects a missing required header with -32020', async () => {
    const { raw } = modern('tools/list');
    const { response, status } = await dispatchMcpBodyDualEra(raw, context({}));

    expect(status).toBe(400);
    expect((response as { error: { code: number } }).error.code).toBe(McpErrorCode.HeaderMismatch);
  });

  it('rejects missing clientCapabilities with -32602', async () => {
    const raw = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {
        _meta: { 'io.modelcontextprotocol/protocolVersion': MODERN_PROTOCOL_VERSION },
      },
    });
    const { response, status } = await dispatchMcpBodyDualEra(
      raw,
      context({ 'mcp-protocol-version': MODERN_PROTOCOL_VERSION, 'mcp-method': 'tools/list' }),
    );

    expect(status).toBe(400);
    expect((response as { error: { code: number } }).error.code).toBe(-32_602);
  });

  /**
   * 404 plus a JSON-RPC error is exactly what tells a probing client we are
   * modern. A legacy server answers an unknown method with 200.
   */
  it('answers an unimplemented modern method with 404', async () => {
    const { raw, headers } = modern('resources/list');
    const { response, status } = await dispatchMcpBodyDualEra(raw, context(headers));

    expect(status).toBe(404);
    expect((response as { error: { code: number } }).error.code).toBe(-32_601);
  });
});

describe('Mcp-Name header', () => {
  // Asserts the header check *passed*, not that the tool ran: reaching the tool
  // layer at all means validation let it through, and a name that resolves to no
  // tool keeps this a transport test rather than an executor one.
  it('accepts a name that matches the body', async () => {
    const { raw, headers } = modern('tools/call', { name: 'no_such_tool', arguments: {} });
    const { response, status } = await dispatchMcpBodyDualEra(raw, context(headers));

    expect(status).toBe(200);
    expect((response as { error?: { code: number } }).error?.code).not.toBe(
      McpErrorCode.HeaderMismatch,
    );
  });

  it('rejects a name that does not match the body', async () => {
    const { raw, headers } = modern('tools/call', { name: 'a_tool', arguments: {} });
    const { response, status } = await dispatchMcpBodyDualEra(
      raw,
      context({ ...headers, 'mcp-name': 'a_different_tool' }),
    );

    expect(status).toBe(400);
    expect((response as { error: { code: number } }).error.code).toBe(McpErrorCode.HeaderMismatch);
  });

  // A non-ASCII tool name travels Base64-wrapped; comparing without decoding
  // would fail a request that is in fact correct.
  it('decodes the =?base64?..?= sentinel before comparing', async () => {
    const name = 'כלי';
    const { raw, headers } = modern('tools/call', { name, arguments: {} });
    const encoded = `=?base64?${Buffer.from(name, 'utf8').toString('base64')}?=`;
    const { status } = await dispatchMcpBodyDualEra(
      raw,
      context({ ...headers, 'mcp-name': encoded }),
    );

    // Reaches the tool layer (unknown tool) rather than failing header checks.
    expect(status).toBe(200);
  });
});
