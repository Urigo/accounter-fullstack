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
  return candidate as unknown as JsonRpcRequest;
}

/** A request with no `id` is a notification: the server must not reply. */
export function isNotification(request: JsonRpcRequest): boolean {
  return request.id === undefined;
}
