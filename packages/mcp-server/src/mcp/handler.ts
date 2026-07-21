import type { IncomingMessage, ServerResponse } from 'node:http';
import { env } from '../config/env.js';
import { log } from '../logger.js';
import { sendUnauthorized } from '../oauth/challenge.js';
import { protectedResourceMetadataUrl } from '../oauth/metadata.js';
import { getServiceVersion, SERVICE_NAME } from '../version.js';
import {
  asJsonRpcRequest,
  failure,
  isNotification,
  JsonRpcErrorCode,
  success,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from './jsonrpc.js';
import { listedTools, runSmokeTool, SMOKE_TOOL_NAME } from './tools.js';

/**
 * MCP transport route (Streamable HTTP) — request dispatch skeleton.
 *
 * Handles the JSON-RPC methods needed to establish a session and list tools.
 * It is intentionally auth-agnostic for now (authentication and per-tool
 * authorization are layered on in later steps) and performs NO upstream
 * GraphQL calls. Unknown methods get a deterministic JSON-RPC "method not
 * found" error.
 */

/** MCP protocol revision this server implements. */
export const MCP_PROTOCOL_VERSION = '2025-06-18';

export const MCP_SERVER_INFO = {
  name: SERVICE_NAME,
  version: getServiceVersion(),
};

/** Max accepted request body size (bounded input, per spec §9.1). */
export const MAX_MCP_BODY_BYTES = 1_000_000;

/**
 * Dispatch a single JSON-RPC request to its MCP method handler. Returns the
 * response, or `null` for notifications (which must not be answered).
 */
export function handleRpcRequest(request: JsonRpcRequest): JsonRpcResponse | null {
  const { method } = request;

  // Notifications carry no id and expect no reply (e.g. notifications/initialized).
  if (isNotification(request)) {
    return null;
  }

  const id = request.id ?? null;

  switch (method) {
    case 'initialize':
      return success(id, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: MCP_SERVER_INFO,
      });

    case 'ping':
      return success(id, {});

    case 'tools/list':
      return success(id, { tools: listedTools });

    case 'tools/call': {
      const params = (request.params ?? {}) as { name?: unknown; arguments?: unknown };
      if (params.name === SMOKE_TOOL_NAME) {
        return success(id, runSmokeTool(params.arguments));
      }
      // The `tools/call` method itself is supported; an unrecognized tool name
      // is an invalid parameter, not an unsupported method.
      return failure(id, JsonRpcErrorCode.InvalidParams, `Unknown tool: ${String(params.name)}`);
    }

    default:
      return failure(id, JsonRpcErrorCode.MethodNotFound, `Unsupported method: ${method}`);
  }
}

/**
 * Process a raw (already string-decoded) request body into a JSON-RPC response.
 * Returns `null` for notifications. Never throws for malformed input — it maps
 * to the appropriate JSON-RPC error instead.
 */
export function handleMcpBody(raw: string): JsonRpcResponse | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return failure(null, JsonRpcErrorCode.ParseError, 'Parse error: body is not valid JSON');
  }

  // JSON-RPC batching is not supported by MCP 2025-06-18.
  if (Array.isArray(parsed)) {
    return failure(null, JsonRpcErrorCode.InvalidRequest, 'Batch requests are not supported');
  }

  const request = asJsonRpcRequest(parsed);
  if (!request) {
    return failure(null, JsonRpcErrorCode.InvalidRequest, 'Invalid JSON-RPC 2.0 request');
  }

  return handleRpcRequest(request);
}

function readBody(req: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        // Pause (don't destroy) the stream so the caller can still write the
        // 413 response before the socket is closed.
        req.pause();
        reject(new Error('PAYLOAD_TOO_LARGE'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

/**
 * Whether the request carries a bearer token in the Authorization header.
 * Token *validity* is verified in a later step; here we only detect presence
 * so an unauthenticated call gets the standard 401 challenge (never a
 * JSON-RPC/tool-level error). Query-param tokens are intentionally ignored.
 */
export function hasBearerToken(req: IncomingMessage): boolean {
  const header = req.headers.authorization;
  if (typeof header !== 'string') {
    return false;
  }
  const match = /^Bearer[ ]+(.+)$/i.exec(header.trim());
  return match !== null && match[1].trim().length > 0;
}

/**
 * HTTP handler for `POST /mcp`. Enforces authentication (presence for now),
 * reads the JSON-RPC body, dispatches it, and writes the response as
 * `application/json`. Notifications get `202 Accepted` with no body.
 */
export async function mcpHttpHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!hasBearerToken(req)) {
    sendUnauthorized(res, {
      resourceMetadataUrl: protectedResourceMetadataUrl(env.server.publicBaseUrl),
    });
    return;
  }

  let raw: string;
  try {
    raw = await readBody(req, MAX_MCP_BODY_BYTES);
  } catch (error) {
    if (error instanceof Error && error.message === 'PAYLOAD_TOO_LARGE') {
      // Close the connection cleanly after the 413 is flushed — the request
      // body was only partially consumed, so the socket cannot be reused.
      res.setHeader('Connection', 'close');
      sendJson(res, 413, failure(null, JsonRpcErrorCode.InvalidRequest, 'Request body too large'));
      res.on('finish', () => req.destroy());
      return;
    }
    log('error', 'failed to read MCP request body', { error: String(error) });
    sendJson(res, 400, failure(null, JsonRpcErrorCode.ParseError, 'Failed to read request body'));
    return;
  }

  const response = handleMcpBody(raw);

  if (response === null) {
    // Notification: acknowledge without a JSON-RPC response body.
    res.writeHead(202);
    res.end();
    return;
  }

  sendJson(res, 200, response);
}
