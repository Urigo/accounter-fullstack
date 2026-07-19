import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TokenVerificationError } from '../../auth/token.js';
import { verifyAccessToken } from '../../auth/verifier.js';
import { handleMcpBody, MCP_PROTOCOL_VERSION, mcpHttpHandler } from '../handler.js';
import type { JsonRpcErrorResponse, JsonRpcSuccess } from '../jsonrpc.js';
import { JsonRpcErrorCode } from '../jsonrpc.js';
import { SMOKE_TOOL_NAME } from '../tools.js';

// The MCP handler verifies bearer tokens via the env-backed verifier, which
// would otherwise fetch a remote JWKS. Mock it so tests stay hermetic.
vi.mock('../../auth/verifier.js', () => ({ verifyAccessToken: vi.fn() }));
const mockVerify = vi.mocked(verifyAccessToken);

const PRINCIPAL = {
  subject: 'user-1',
  issuer: 'https://tenant.auth0.com/',
  audience: 'aud',
  scopes: [],
  email: null,
  expiresAt: undefined,
  claims: { sub: 'user-1' },
};

function rpc(method: string, params?: unknown, id: string | number | null = 1) {
  return JSON.stringify({ jsonrpc: '2.0', id, method, ...(params !== undefined && { params }) });
}

describe('handleMcpBody — method dispatch', () => {
  it('handles initialize', () => {
    const res = handleMcpBody(rpc('initialize')) as JsonRpcSuccess;
    const result = res.result as Record<string, unknown>;
    expect(result.protocolVersion).toBe(MCP_PROTOCOL_VERSION);
    expect(result.capabilities).toEqual({ tools: { listChanged: false } });
    expect(result.serverInfo).toMatchObject({ name: '@accounter/mcp-server' });
  });

  it('handles ping', () => {
    const res = handleMcpBody(rpc('ping')) as JsonRpcSuccess;
    expect(res.result).toEqual({});
  });

  it('lists the smoke tool', () => {
    const res = handleMcpBody(rpc('tools/list')) as JsonRpcSuccess;
    const result = res.result as { tools: Array<{ name: string }> };
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].name).toBe(SMOKE_TOOL_NAME);
  });

  it('calls the smoke tool and echoes the message', () => {
    const res = handleMcpBody(
      rpc('tools/call', { name: SMOKE_TOOL_NAME, arguments: { message: 'hi' } }),
    ) as JsonRpcSuccess;
    expect(res.result).toEqual({ content: [{ type: 'text', text: 'pong: hi' }], isError: false });
  });

  it('returns InvalidParams for an unknown tool', () => {
    const res = handleMcpBody(rpc('tools/call', { name: 'nope' })) as JsonRpcErrorResponse;
    expect(res.error.code).toBe(JsonRpcErrorCode.InvalidParams);
  });

  it('returns MethodNotFound for an unsupported method', () => {
    const res = handleMcpBody(rpc('resources/list')) as JsonRpcErrorResponse;
    expect(res.error.code).toBe(JsonRpcErrorCode.MethodNotFound);
    expect(res.error.message).toContain('resources/list');
  });

  it('returns null for a notification (no id)', () => {
    expect(handleMcpBody(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }))).toBeNull();
  });
});

describe('handleMcpBody — malformed input', () => {
  it('maps invalid JSON to ParseError with null id', () => {
    const res = handleMcpBody('{ not json') as JsonRpcErrorResponse;
    expect(res.id).toBeNull();
    expect(res.error.code).toBe(JsonRpcErrorCode.ParseError);
  });

  it('rejects JSON-RPC batches', () => {
    const res = handleMcpBody('[{"jsonrpc":"2.0","id":1,"method":"ping"}]') as JsonRpcErrorResponse;
    expect(res.error.code).toBe(JsonRpcErrorCode.InvalidRequest);
  });

  it('rejects a malformed request shape', () => {
    const res = handleMcpBody('{"jsonrpc":"1.0","method":"ping"}') as JsonRpcErrorResponse;
    expect(res.error.code).toBe(JsonRpcErrorCode.InvalidRequest);
  });
});

// ---------------------------------------------------------------------------
// HTTP adapter
// ---------------------------------------------------------------------------

function mockReq(
  body: string,
  headers: Record<string, string> = { authorization: 'Bearer test-token' },
): IncomingMessage {
  const stream = Readable.from([Buffer.from(body, 'utf8')]) as unknown as IncomingMessage;
  stream.headers = headers as IncomingMessage['headers'];
  return stream;
}

function mockRes() {
  const res = {
    writeHead: vi.fn(() => res),
    end: vi.fn(() => res),
    setHeader: vi.fn(() => res),
    on: vi.fn(() => res),
  };
  return res as unknown as ServerResponse & {
    writeHead: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
    setHeader: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
  };
}

describe('mcpHttpHandler', () => {
  beforeEach(() => {
    // A valid bearer token resolves to a principal by default.
    mockVerify.mockReset();
    mockVerify.mockResolvedValue(PRINCIPAL);
  });

  it('responds 200 with the JSON-RPC result for a request', async () => {
    const res = mockRes();
    await mcpHttpHandler(mockReq(rpc('tools/list')), res);

    expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
    const body = JSON.parse(res.end.mock.calls[0][0] as string);
    expect(body.result.tools[0].name).toBe(SMOKE_TOOL_NAME);
  });

  it('responds 202 with no body for a notification', async () => {
    const res = mockRes();
    await mcpHttpHandler(
      mockReq(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })),
      res,
    );
    expect(res.writeHead).toHaveBeenCalledWith(202);
    expect(res.end).toHaveBeenCalledWith();
  });

  it('responds 413 when the body exceeds the size cap', async () => {
    const res = mockRes();
    // Build a body larger than MAX_MCP_BODY_BYTES (1,000,000).
    const huge = `{"jsonrpc":"2.0","id":1,"method":"ping","params":"${'x'.repeat(1_000_001)}"}`;
    await mcpHttpHandler(mockReq(huge), res);
    expect(res.writeHead).toHaveBeenCalledWith(413, { 'Content-Type': 'application/json' });
  });

  it('challenges with 401 + WWW-Authenticate when no bearer token is present', async () => {
    vi.stubEnv('MCP_PUBLIC_BASE_URL', 'https://mcp.example.com');
    vi.stubEnv('AUTH0_ISSUER_URL', 'https://tenant.auth0.com/');
    vi.stubEnv('AUTH0_AUDIENCE', 'aud');
    vi.stubEnv('GRAPHQL_UPSTREAM_URL', 'http://localhost:4000/graphql');
    const { resetEnvCache } = await import('../../config/env.js');
    resetEnvCache();

    const res = mockRes();
    await mcpHttpHandler(mockReq(rpc('tools/list'), {}), res);

    expect(res.writeHead).toHaveBeenCalledWith(401, { 'Content-Type': 'application/json' });
    const wwwAuth = res.setHeader.mock.calls.find(([name]) => name === 'WWW-Authenticate');
    expect(wwwAuth?.[1]).toContain(
      'resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource"',
    );
    expect(mockVerify).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
    resetEnvCache();
  });

  it('challenges with 401 + error="invalid_token" when the token fails verification', async () => {
    vi.stubEnv('MCP_PUBLIC_BASE_URL', 'https://mcp.example.com');
    vi.stubEnv('AUTH0_ISSUER_URL', 'https://tenant.auth0.com/');
    vi.stubEnv('AUTH0_AUDIENCE', 'aud');
    vi.stubEnv('GRAPHQL_UPSTREAM_URL', 'http://localhost:4000/graphql');
    const { resetEnvCache } = await import('../../config/env.js');
    resetEnvCache();
    mockVerify.mockRejectedValue(new TokenVerificationError('expired'));

    const res = mockRes();
    await mcpHttpHandler(mockReq(rpc('tools/list'), { authorization: 'Bearer bad' }), res);

    expect(res.writeHead).toHaveBeenCalledWith(401, { 'Content-Type': 'application/json' });
    const wwwAuth = res.setHeader.mock.calls.find(([name]) => name === 'WWW-Authenticate');
    expect(wwwAuth?.[1]).toContain('error="invalid_token"');
    vi.unstubAllEnvs();
    resetEnvCache();
  });
});

describe('hasBearerToken', () => {
  it('detects a bearer token (case-insensitive)', async () => {
    const { hasBearerToken } = await import('../handler.js');
    expect(hasBearerToken(mockReq('', { authorization: 'Bearer abc' }))).toBe(true);
    expect(hasBearerToken(mockReq('', { authorization: 'bearer abc' }))).toBe(true);
  });

  it('rejects a missing, empty, or non-bearer header', async () => {
    const { hasBearerToken } = await import('../handler.js');
    expect(hasBearerToken(mockReq('', {}))).toBe(false);
    expect(hasBearerToken(mockReq('', { authorization: 'Bearer ' }))).toBe(false);
    expect(hasBearerToken(mockReq('', { authorization: 'Basic xyz' }))).toBe(false);
  });
});
