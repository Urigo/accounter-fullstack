import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  getAuthContext,
  IdentityMappingError,
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
import { generateId, getRequestContext } from '../context.js';
import { createRequestLogger, log } from '../logger.js';
import { sendUnauthorized } from '../oauth/challenge.js';
import { protectedResourceMetadataUrl } from '../oauth/metadata.js';
import { getMetrics } from '../observability/metrics.js';
import { withSpan } from '../observability/tracing.js';
import { getRateLimiter } from '../rate-limit/default-limiter.js';
import { isToolExposed } from '../tools/allowlist.js';
import { executeRegisteredTool } from '../tools/execute.js';
import { toolRegistry } from '../tools/registry-instance.js';
import { getUpstreamClient } from '../upstream/default-client.js';
import { createUpstreamMembershipSource } from '../upstream/memberships.js';
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
 * The JSON-RPC dispatcher itself performs no upstream GraphQL calls (per-tool
 * authorization is layered on in later steps); the one upstream call here is in
 * `authenticate`, which resolves the caller's business memberships from the
 * server. Unknown methods get a deterministic JSON-RPC "method not found" error.
 */

/** MCP protocol revision this server implements. */
export const MCP_PROTOCOL_VERSION = '2025-06-18';

/**
 * `event` discriminator on the handshake log line, so `initialize` can be
 * selected out of the log stream without matching on free-text messages —
 * the same contract as `TOOL_CALL_EVENT` in `tools/execute.ts`.
 */
export const MCP_INITIALIZE_EVENT = 'mcp_initialize';

/**
 * `event` discriminator for a request that looks like it came from a client
 * speaking a protocol era this server does not implement.
 *
 * The connector implements a handshake-based ("legacy") revision. Under the
 * current revision there is no `initialize` at all: version, identity and
 * capabilities travel per-request in `_meta`. A client that has moved there
 * entirely would not handshake, so `mcp_initialize` would simply stop
 * appearing — silence, not a changed value, discovered when calls began to
 * fail.
 *
 * What makes this detectable in advance is that a dual-era client on
 * Streamable HTTP tries a modern request *first* and falls back on the
 * response. That probe is the warning, and this is what records it.
 */
export const MCP_MODERN_PROBE_EVENT = 'mcp_modern_probe';

/** Header carrying the protocol revision a request is written against. */
export const MCP_PROTOCOL_VERSION_HEADER = 'mcp-protocol-version';

/** `_meta` keys a modern request carries, per the current revision. */
const META_PROTOCOL_VERSION_KEY = 'io.modelcontextprotocol/protocolVersion';
const META_CLIENT_INFO_KEY = 'io.modelcontextprotocol/clientInfo';
const META_CLIENT_CAPABILITIES_KEY = 'io.modelcontextprotocol/clientCapabilities';

/** Method a modern client calls to discover what a server supports. */
export const SERVER_DISCOVER_METHOD = 'server/discover';

/**
 * Hard cap on the length of a logged client identifier, ellipsis included.
 *
 * `clientInfo.name` and `clientInfo.version` are caller-supplied strings off the
 * wire with no schema behind them, so they are clipped before reaching the log.
 * Same motivation as `MAX_MISS_LABEL_LENGTH` in `tools/terminology.ts`, but
 * deliberately a different number: that one bounds a `/metrics` label, where
 * the constraint is a readable snapshot, while this bounds a log field and only
 * needs to stop an unbounded string. A real client identifier
 * (`claude-ai` / `1.37937.1`) is nowhere near either limit.
 */
export const MAX_CLIENT_LABEL_LENGTH = 60;

export const MCP_SERVER_INFO = {
  name: SERVICE_NAME,
  version: getServiceVersion(),
};

/** Max accepted request body size (bounded input, per spec §9.1). */
export const MAX_MCP_BODY_BYTES = 1_000_000;

/** Narrow an unknown value to a plain object, or `{}` — never throws. */
function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Clip a caller-supplied identifier for the log, or `null` when absent.
 *
 * The ellipsis counts towards the cap, so the result is never longer than
 * {@link MAX_CLIENT_LABEL_LENGTH} — a cap that its own truncation marker can
 * push past is not a cap.
 */
function clipClientLabel(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }
  return value.length <= MAX_CLIENT_LABEL_LENGTH
    ? value
    : `${value.slice(0, MAX_CLIENT_LABEL_LENGTH - 1)}\u2026`;
}

/**
 * Max capability names copied from a caller-supplied capabilities object.
 *
 * Both how many keys there are and how long each one is are the caller's
 * choice, bounded only by the 1 MB body cap — so copying the set verbatim into
 * a log line is caller-controlled amplification. Same reasoning as
 * {@link MAX_CLIENT_LABEL_LENGTH} and the metrics registry's
 * `MAX_COUNTER_LABELS`: anything derived from caller input gets a ceiling.
 */
export const MAX_LOGGED_CAPABILITIES = 20;

/**
 * Capability *names* from a caller-supplied capabilities object — sorted,
 * clipped, and capped.
 *
 * Values are never read: they are unbounded and carry no diagnostic value here.
 * Sorted so the same handshake logs the same line and a change is visible by
 * diffing. When more names are present than the cap allows, a final `+N more`
 * entry says so, because a list that is silently short reads as a client that
 * declared fewer capabilities.
 */
function capabilityNames(value: unknown): string[] {
  const names = Object.keys(asRecord(value)).sort();
  const kept = names
    .slice(0, MAX_LOGGED_CAPABILITIES)
    .map(name => clipClientLabel(name))
    .filter((name): name is string => name !== null);

  return names.length > MAX_LOGGED_CAPABILITIES
    ? [...kept, `+${names.length - MAX_LOGGED_CAPABILITIES} more`]
    : kept;
}

/** What a client told us about itself during `initialize`. */
export interface InitializeHandshake {
  clientName: string | null;
  clientVersion: string | null;
  requestedProtocolVersion: string | null;
  servedProtocolVersion: string;
  /** The client asked for a revision this server does not implement. */
  protocolVersionMismatch: boolean;
  /** Capability *names* only — the values are unbounded and caller-supplied. */
  clientCapabilities: string[];
}

/**
 * Describe an `initialize` request for the log.
 *
 * Pure, and deliberately total: `params` is `unknown` off the wire and is
 * validated only as a non-null object *or array* (`jsonrpc.ts`), so every field
 * is narrowed here and anything unexpected degrades to `null`/`[]` rather than
 * throwing. A malformed handshake must still be recorded — a client sending
 * something this server cannot parse is precisely the event worth seeing.
 *
 * An absent `protocolVersion` is not a mismatch: nothing was asked for.
 */
export function describeInitializeParams(params: unknown): InitializeHandshake {
  const record = asRecord(params);
  const requestedProtocolVersion = clipClientLabel(record.protocolVersion);
  const clientInfo = asRecord(record.clientInfo);

  return {
    clientName: clipClientLabel(clientInfo.name),
    clientVersion: clipClientLabel(clientInfo.version),
    requestedProtocolVersion,
    servedProtocolVersion: MCP_PROTOCOL_VERSION,
    protocolVersionMismatch:
      requestedProtocolVersion !== null && requestedProtocolVersion !== MCP_PROTOCOL_VERSION,
    clientCapabilities: capabilityNames(record.capabilities),
  };
}

/** A request bearing signals of a protocol era this server does not implement. */
export interface ModernEraProbe {
  method: string;
  /** The header value, recorded only when it disagrees with what we serve. */
  protocolVersionHeader: string | null;
  metaProtocolVersion: string | null;
  metaClientName: string | null;
  metaClientVersion: string | null;
  metaClientCapabilities: string[];
  /** True when the method itself only exists in the modern protocol. */
  modernMethod: boolean;
}

/**
 * Describe a request's modern-era signals, or `null` when it has none.
 *
 * Returning `null` for the ordinary case is the design: this line must mean
 * "something changed", not "a request happened". `MCP-Protocol-Version` is
 * required by the revision we already implement, so it may well be on every
 * call — recorded only when its value *disagrees* with ours, since
 * `mcp_initialize` already reports the negotiated version.
 *
 * Pure and total, like {@link describeInitializeParams}: everything here is
 * caller-supplied and unvalidated, and a probe this server cannot parse is
 * exactly the event worth seeing rather than throwing on.
 */
export function describeModernEraProbe(
  method: string,
  params: unknown,
  protocolVersionHeader: string | undefined,
): ModernEraProbe | null {
  const meta = asRecord(asRecord(params)._meta);
  const metaClientInfo = asRecord(meta[META_CLIENT_INFO_KEY]);
  const headerDisagrees =
    typeof protocolVersionHeader === 'string' &&
    protocolVersionHeader.length > 0 &&
    protocolVersionHeader !== MCP_PROTOCOL_VERSION;

  const probe: ModernEraProbe = {
    method,
    protocolVersionHeader: headerDisagrees ? clipClientLabel(protocolVersionHeader) : null,
    metaProtocolVersion: clipClientLabel(meta[META_PROTOCOL_VERSION_KEY]),
    metaClientName: clipClientLabel(metaClientInfo.name),
    metaClientVersion: clipClientLabel(metaClientInfo.version),
    metaClientCapabilities: capabilityNames(meta[META_CLIENT_CAPABILITIES_KEY]),
    modernMethod: method === SERVER_DISCOVER_METHOD,
  };

  const sawSomething =
    probe.protocolVersionHeader !== null ||
    probe.metaProtocolVersion !== null ||
    probe.metaClientName !== null ||
    probe.metaClientVersion !== null ||
    probe.metaClientCapabilities.length > 0 ||
    probe.modernMethod;

  return sawSomething ? probe : null;
}

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
      // Params, when present, must be a JSON object. An array (which
      // asJsonRpcRequest permits) or other non-object shape is a malformed
      // params error, not a mislabeled "Unknown tool: undefined".
      const rawParams = request.params;
      if (
        rawParams !== undefined &&
        (typeof rawParams !== 'object' || rawParams === null || Array.isArray(rawParams))
      ) {
        return failure(id, JsonRpcErrorCode.InvalidParams, 'tools/call params must be an object');
      }
      const params = (rawParams ?? {}) as { name?: unknown; arguments?: unknown };
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
  /**
   * The caller's `MCP-Protocol-Version` header, for era detection only.
   *
   * Read, never enforced. Enforcing it would change what we answer, and a
   * dual-era client decides we are legacy from the shape of our reply — look
   * modern and it stops falling back, which is the failure this is meant to
   * warn about rather than cause.
   */
  protocolVersionHeader?: string;
  /**
   * `MCP_TOOL_ALLOWLIST`, resolved at the HTTP boundary. Empty ⇒ no restriction
   * (every registered tool is exposed); non-empty ⇒ `tools/list` and
   * `tools/call` are limited to exactly these tool names.
   *
   * Required — not optional — precisely because it is a security control:
   * making every caller pass it (even the empty, unrestricted case) means a new
   * call site cannot silently bypass enforcement by forgetting the field.
   */
  allowlist: readonly string[];
  /**
   * `MCP_ENABLE_WRITE_TOOLS`, resolved at the HTTP boundary. When false,
   * mutating tools are absent from `tools/list` and rejected by `tools/call`.
   *
   * Required for the same reason as `allowlist`, and deliberately not defaulted:
   * a defaulted `writeToolsEnabled` would have to default to something, and
   * either choice is wrong — `true` silently enables writes for a call site that
   * forgot the field, `false` makes write tools mysteriously vanish for one that
   * did. Making it explicit means the question is answered at every call site.
   */
  writeToolsEnabled: boolean;
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

  // Era detection, before anything else: a request carrying modern signals is
  // the only advance warning available that a client is moving off the
  // handshake-based protocol this server implements.
  //
  // Observation only — nothing below changes, and no response byte differs.
  // That is deliberate rather than incidental: era detection keys off exactly
  // what we return, so answering a modern probe would stop the fallback that is
  // currently keeping every client working.
  const probe = describeModernEraProbe(
    request.method,
    request.params,
    context.protocolVersionHeader,
  );
  if (probe) {
    log('warn', 'mcp modern-era probe', {
      ...probe,
      event: MCP_MODERN_PROBE_EVENT,
      servedProtocolVersion: MCP_PROTOCOL_VERSION,
      servedEra: 'legacy',
      userId: context.auth.userId,
      correlationId: context.correlationId,
    });
  }

  // Record the handshake, then let `handleRpcRequest` build the response.
  //
  // It is logged here rather than in that function's `case 'initialize'` for two
  // reasons: `handleRpcRequest` is the pure, env-free half and takes only the
  // request, so it has neither the caller nor the correlation id to log; and
  // keeping the response in one place means the two cannot drift.
  //
  // This is the one hop that was never recorded, which is why a client changing
  // its handling of tool results underneath this server had to be reconstructed
  // from the *client's* own logs. `clientInfo` is what dates such a change.
  if (request.method === 'initialize') {
    // Caller-derived fields spread first so the canonical ones below always win
    // a name collision — cf. the `tool_call` line in `tools/execute.ts`. A
    // client cannot misreport who it is by putting `userId` in `clientInfo`.
    log('info', 'mcp initialize', {
      ...describeInitializeParams(request.params),
      event: MCP_INITIALIZE_EVENT,
      userId: context.auth.userId,
      correlationId: context.correlationId,
    });
    return handleRpcRequest(request);
  }

  // Exposure controls: `MCP_TOOL_ALLOWLIST` (empty ⇒ every tool; non-empty ⇒
  // only the named subset) and `MCP_ENABLE_WRITE_TOOLS` (off ⇒ no mutating
  // tool). Both are threaded in via the dispatch context (built at the HTTP
  // boundary) so this function stays env-free and directly unit-testable.
  const { allowlist, writeToolsEnabled } = context;
  const exposure = { allowlist, writeToolsEnabled };

  if (request.method === 'tools/list') {
    // `describe()` yields descriptors, which carry no policy — look the tool
    // back up so the write switch is evaluated against the real policy rather
    // than inferred from the name.
    const registered = toolRegistry.describe().filter(descriptor => {
      const tool = toolRegistry.get(descriptor.name);
      return tool !== undefined && isToolExposed(tool, exposure);
    });
    return success(id, { tools: [...listedTools, ...registered] });
  }

  if (request.method === 'tools/call') {
    const params = (request.params ?? {}) as { name?: unknown; arguments?: unknown };
    const name = typeof params.name === 'string' ? params.name : '';
    if (name === SMOKE_TOOL_NAME) {
      return success(id, runSmokeTool(params.arguments));
    }
    // A tool that exists but is excluded by the allowlist or by the write switch
    // is reported as unknown — indistinguishable from a nonexistent one, so
    // neither control leaks which capabilities the server could otherwise offer.
    const registered = toolRegistry.get(name);
    const tool = registered && isToolExposed(registered, exposure) ? registered : undefined;
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
      limiter: getRateLimiter(),
      metrics: getMetrics(),
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
  const correlationId = getRequestContext(req)?.correlationId ?? '';
  const token = extractBearerToken(req);
  if (!token) {
    getMetrics().recordAuthFailure('missing_token');
    // Log the tokenless 401 too (previously silent). A client re-establishing a
    // connection probes without a token, gets this 401, then follows the
    // WWW-Authenticate pointer to re-auth — so a burst of `missing_token` here
    // is the fingerprint of clients reconnecting, distinct from `expired_token`
    // (a live token that aged out) or `invalid_token` (a broken token).
    const context = getRequestContext(req);
    if (context) {
      createRequestLogger(context).warn('access token verification failed', {
        reason: 'missing bearer token',
        category: 'missing_token',
      });
    } else {
      log('warn', 'access token verification failed', {
        reason: 'missing bearer token',
        category: 'missing_token',
      });
    }
    sendUnauthorized(res, {
      resourceMetadataUrl: protectedResourceMetadataUrl(env.server.publicBaseUrl),
    });
    return null;
  }

  try {
    const principal = await withSpan('auth:verify', correlationId, () => verifyAccessToken(token));
    setAuthPrincipal(req, principal);
    // Map the verified identity to internal user + business membership context.
    // Memberships are resolved from the Accounter server (not token claims) by
    // forwarding the caller's bearer token to `myMemberships`. An upstream/auth
    // failure throws (surfaces as 401/5xx); only a genuinely empty membership
    // set resolves to no access, and per-tool policy decides what that permits.
    const membershipSource = createUpstreamMembershipSource({
      client: getUpstreamClient(),
      authorization: req.headers.authorization,
      correlationId: getRequestContext(req)?.correlationId ?? generateId(),
    });
    setAuthContext(req, await resolveAuthContext(principal, membershipSource));
    return principal;
  } catch (error) {
    // An invalid token, or a verified token that cannot be mapped to a usable
    // identity (e.g. a missing subject claim), is a 401. Infrastructure failures
    // (e.g. a JWKS outage) propagate so the request surfaces as a 5xx rather than
    // a misleading auth error.
    if (!(error instanceof TokenVerificationError) && !(error instanceof IdentityMappingError)) {
      throw error;
    }
    // Meter expiry separately from other invalid-token failures: an expired
    // token means the client should have refreshed, whereas a bad
    // signature/issuer/audience (or an unmappable identity) points at
    // misconfiguration or abuse. The transport response is identical.
    const category =
      error instanceof TokenVerificationError && error.expired ? 'expired_token' : 'invalid_token';
    getMetrics().recordAuthFailure(category);
    // Log the reason only — never the token.
    const context = getRequestContext(req);
    if (context) {
      createRequestLogger(context).warn('access token verification failed', {
        reason: error.message,
        category,
      });
    } else {
      log('warn', 'access token verification failed', { reason: error.message, category });
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
    protocolVersionHeader:
      typeof req.headers[MCP_PROTOCOL_VERSION_HEADER] === 'string'
        ? (req.headers[MCP_PROTOCOL_VERSION_HEADER] as string)
        : undefined,
    allowlist: env.server.toolAllowlist,
    writeToolsEnabled: env.server.writeToolsEnabled,
  });

  if (response === null) {
    // Notification: acknowledge without a JSON-RPC response body.
    res.writeHead(202);
    res.end();
    return;
  }

  sendJson(res, 200, response);
}
