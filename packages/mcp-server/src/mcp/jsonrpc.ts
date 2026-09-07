/**
 * Minimal JSON-RPC 2.0 primitives used by the MCP transport.
 *
 * MCP speaks JSON-RPC 2.0. This module intentionally implements only the small
 * subset the connector needs, avoiding a heavyweight framework dependency while
 * the protocol surface is still small. It can be swapped for the official MCP
 * SDK later without changing tool handlers.
 */

export const JSON_RPC_VERSION = '2.0';

/** Standard JSON-RPC 2.0 error codes plus the range reserved for the server. */
export const JsonRpcErrorCode = {
  ParseError: -32_700,
  InvalidRequest: -32_600,
  MethodNotFound: -32_601,
  InvalidParams: -32_602,
  InternalError: -32_603,
} as const;

/**
 * Error codes defined by the MCP specification itself (revision 2026-07-28).
 *
 * JSON-RPC reserves `-32000..-32099` for implementation-defined server errors;
 * MCP partitions it, keeping `-32020..-32099` for the specification. A server
 * **MUST NOT** emit a code from that sub-range that the spec does not define,
 * and **MUST** use the defined ones only with their specified meanings — so
 * these are deliberately separate from {@link JsonRpcErrorCode}, which holds
 * the transport-level codes we are free to use anywhere.
 *
 * All three are modern-era only. The legacy handshake path never emits them.
 */
export const McpErrorCode = {
  /** Headers disagree with the body, or a required header is missing. */
  HeaderMismatch: -32_020,
  /** The request needs a capability the client did not declare. */
  MissingRequiredClientCapability: -32_021,
  /** The requested protocol revision is one this server does not implement. */
  UnsupportedProtocolVersion: -32_022,
} as const;

export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc: typeof JSON_RPC_VERSION;
  id?: JsonRpcId;
  method: string;
  params?: unknown;
}

export interface JsonRpcSuccess {
  jsonrpc: typeof JSON_RPC_VERSION;
  id: JsonRpcId;
  result: unknown;
}

export interface JsonRpcErrorResponse {
  jsonrpc: typeof JSON_RPC_VERSION;
  id: JsonRpcId;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcErrorResponse;

export function success(id: JsonRpcId, result: unknown): JsonRpcSuccess {
  return { jsonrpc: JSON_RPC_VERSION, id, result };
}

export function failure(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcErrorResponse {
  return {
    jsonrpc: JSON_RPC_VERSION,
    id,
    error: { code, message, ...(data !== undefined && { data }) },
  };
}

/**
 * Validate that an arbitrary parsed value is a well-formed JSON-RPC request.
 * Returns the narrowed request or `null` when the shape is invalid.
 */
export function asJsonRpcRequest(value: unknown): JsonRpcRequest | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.jsonrpc !== JSON_RPC_VERSION) {
    return null;
  }
  if (typeof candidate.method !== 'string') {
    return null;
  }
  const id = candidate.id;
  if (id !== undefined && id !== null && typeof id !== 'string' && typeof id !== 'number') {
    return null;
  }
  // Per JSON-RPC 2.0, `params` (when present) must be a structured value —
  // an object or an array — never a primitive.
  const params = candidate.params;
  if (params !== undefined && (typeof params !== 'object' || params === null)) {
    return null;
  }
  return candidate as unknown as JsonRpcRequest;
}

/** A request with no `id` is a notification: the server must not reply. */
export function isNotification(request: JsonRpcRequest): boolean {
  return request.id === undefined;
}

/**
 * `UnsupportedProtocolVersionError` (`-32022`).
 *
 * The `supported` list is the useful half: a client that asked for a revision
 * we do not implement can pick one from it and retry, rather than failing. On
 * HTTP this **MUST** be sent with `400 Bad Request` — which is also how a
 * dual-era client tells a modern server from a legacy one, since it inspects
 * the body of a 400 before deciding to fall back.
 */
export function unsupportedProtocolVersion(
  id: JsonRpcId,
  requested: string | null,
  supported: readonly string[],
): JsonRpcErrorResponse {
  return failure(id, McpErrorCode.UnsupportedProtocolVersion, 'Unsupported protocol version', {
    supported: [...supported],
    requested,
  });
}

/**
 * `HeaderMismatch` (`-32020`).
 *
 * Raised when a mirrored header disagrees with the body, or a required one is
 * absent. The point is not pedantry: intermediaries route on the header while
 * the server executes the body, so a disagreement is a request that means two
 * different things depending on who reads it.
 */
export function headerMismatch(id: JsonRpcId, message: string): JsonRpcErrorResponse {
  return failure(id, McpErrorCode.HeaderMismatch, `Header mismatch: ${message}`);
}
