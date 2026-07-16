import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import type { JsonRpcErrorResponse, JsonRpcSuccess } from '../jsonrpc.js';
import { JsonRpcErrorCode } from '../jsonrpc.js';
import {
  handleMcpBody,
  MCP_PROTOCOL_VERSION,
  mcpHttpHandler,
} from '../handler.js';
import { SMOKE_TOOL_NAME } from '../tools.js';

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

function mockReq(body: string): IncomingMessage {
  return Readable.from([Buffer.from(body, 'utf8')]) as unknown as IncomingMessage;
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
});
