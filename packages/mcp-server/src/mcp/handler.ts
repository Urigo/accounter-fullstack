import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  getAuthContext,
  resolveAuthContext,
  setAuthContext,
  type McpAuthContext,
} from '../auth/identity.js';
import {
  extractBearerToken,
  setAuthPrincipal,
  TokenVerificationError,
  type AuthPrincipal,
} from '../auth/token.js';
import { verifyAccessToken } from '../auth/verifier.js';
import { env } from '../config/env.js';
import { getRequestContext } from '../context.js';
import { createRequestLogger, log } from '../logger.js';
import { sendUnauthorized } from '../oauth/challenge.js';
import { protectedResourceMetadataUrl } from '../oauth/metadata.js';
import { executeRegisteredTool } from '../tools/execute.js';
import { toolRegistry } from '../tools/registry-instance.js';
import { getUpstreamClient } from '../upstream/default-client.js';
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

/** Parse a raw body into a JSON-RPC request or a terminal error response. */
function parseMcpBody(raw: string): { request: JsonRpcRequest } | { response: JsonRpcResponse } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      response: failure(null, JsonRpcErrorCode.ParseError, 'Parse error: body is not valid JSON'),
    };
  }

  // JSON-RPC batching is not supported by MCP 2025-06-18.
  if (Array.isArray(parsed)) {
    return {
      response: failure(null, JsonRpcErrorCode.InvalidRequest, 'Batch requests are not supported'),
    };
  }

  const request = asJsonRpcRequest(parsed);
  if (!request) {
    return {
      response: failure(null, JsonRpcErrorCode.InvalidRequest, 'Invalid JSON-RPC 2.0 request'),
    };
  }
  return { request };
}

/**
 * Process a raw (already string-decoded) request body into a JSON-RPC response.
 * Returns `null` for notifications. Never throws for malformed input — it maps
 * to the appropriate JSON-RPC error instead. Synchronous path: does not execute
 * registry tools (see {@link dispatchMcpBody}).
 */
export function handleMcpBody(raw: string): JsonRpcResponse | null {
  const parsed = parseMcpBody(raw);
  return 'response' in parsed ? parsed.response : handleRpcRequest(parsed.request);
}

/** Per-request context for the authenticated tool-dispatch path. */
export interface McpDispatchContext {
  auth: McpAuthContext;
  correlationId: string;
  /** Caller's Authorization header value, forwarded upstream (never logged). */
  authorization?: string;
}

/**
 * Async dispatch used by the HTTP handler. Handles `tools/list` (curated
 * registry + the smoke tool) and `tools/call` for registered tools (validation
 * → policy → execution), delegating everything else to {@link handleRpcRequest}.
 */
export async function dispatchMcpRequest(
  request: JsonRpcRequest,
  context: McpDispatchContext,
): Promise<JsonRpcResponse | null> {
  if (isNotification(request)) {
    return null;
  }
  const id = request.id ?? null;

  if (request.method === 'tools/list') {
    return success(id, { tools: [...listedTools, ...toolRegistry.describe()] });
  }

  if (request.method === 'tools/call') {
    const params = (request.params ?? {}) as { name?: unknown; arguments?: unknown };
    const name = typeof params.name === 'string' ? params.name : '';
    if (name === SMOKE_TOOL_NAME) {
      return success(id, runSmokeTool(params.arguments));
    }
    const tool = toolRegistry.get(name);
    if (!tool) {
      return failure(id, JsonRpcErrorCode.InvalidParams, `Unknown tool: ${name}`);
    }
    const result = await executeRegisteredTool({
      tool,
      rawArgs: params.arguments,
      auth: context.auth,
      correlationId: context.correlationId,
      authorization: context.authorization,
      client: getUpstreamClient(),
    });
    return success(id, result);
  }

  return handleRpcRequest(request);
}

/** Parse + async-dispatch a raw body. Returns `null` for notifications. */
export async function dispatchMcpBody(
  raw: string,
  context: McpDispatchContext,
): Promise<JsonRpcResponse | null> {
  const parsed = parseMcpBody(raw);
  if ('response' in parsed) {
    return parsed.response;
  }
  return dispatchMcpRequest(parsed.request, context);
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
 * Query-param tokens are intentionally ignored. Kept for callers that only
 * need presence; the handler itself verifies the token.
 */
export function hasBearerToken(req: IncomingMessage): boolean {
  return extractBearerToken(req) !== null;
}

/**
 * Authenticate the request: extract and verify the bearer token. On success
 * returns the principal (and stores it on the request); on failure writes the
 * appropriate 401 challenge and returns `null`. Never returns a JSON-RPC/tool
 * error for auth problems, and never logs the token.
 */
async function authenticate(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<AuthPrincipal | null> {
  const token = extractBearerToken(req);
  if (!token) {
    sendUnauthorized(res, {
      resourceMetadataUrl: protectedResourceMetadataUrl(env.server.publicBaseUrl),
    });
    return null;
  }

  try {
    const principal = await verifyAccessToken(token);
    setAuthPrincipal(req, principal);
    // Map the verified identity to internal user + business membership context.
    // An empty membership set is a valid user with no access; per-tool policy
    // (a later step) decides what that permits.
    setAuthContext(req, await resolveAuthContext(principal));
    return principal;
  } catch (error) {
    // Only an invalid token is a 401; infrastructure failures (e.g. a JWKS
    // outage) propagate so the request surfaces as a 5xx rather than a
    // misleading auth error.
    if (!(error instanceof TokenVerificationError)) {
      throw error;
    }
    // Log the reason only — never the token.
    const context = getRequestContext(req);
    if (context) {
      createRequestLogger(context).warn('access token verification failed', {
        reason: error.message,
      });
    } else {
      log('warn', 'access token verification failed', { reason: error.message });
    }
    sendUnauthorized(res, {
      resourceMetadataUrl: protectedResourceMetadataUrl(env.server.publicBaseUrl),
      error: 'invalid_token',
      errorDescription: 'The access token is invalid or expired',
    });
    return null;
  }
}

/**
 * HTTP handler for `POST /mcp`. Authenticates the caller (extract + verify the
 * bearer token), reads the JSON-RPC body, dispatches it, and writes the
 * response as `application/json`. Notifications get `202 Accepted` with no body.
 */
export async function mcpHttpHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const principal = await authenticate(req, res);
  if (!principal) {
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

  const auth = getAuthContext(req);
  if (!auth) {
    // Should be set by authenticate(); treat an unexpected miss as internal.
    log('error', 'authenticated request is missing its auth context');
    sendJson(res, 500, failure(null, JsonRpcErrorCode.InternalError, 'Internal server error'));
    return;
  }

  const response = await dispatchMcpBody(raw, {
    auth,
    correlationId: getRequestContext(req)?.correlationId ?? '',
    authorization:
      typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined,
  });

  if (response === null) {
    // Notification: acknowledge without a JSON-RPC response body.
    res.writeHead(202);
    res.end();
    return;
  }

  sendJson(res, 200, response);
}
