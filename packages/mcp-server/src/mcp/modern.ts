import { log } from '../logger.js';
import {
  failure,
  headerMismatch,
  JsonRpcErrorCode,
  success,
  unsupportedProtocolVersion,
  type JsonRpcId,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from './jsonrpc.js';

/**
 * The modern (per-request-metadata) MCP era, revision `2026-07-28`.
 *
 * Kept in its own module rather than folded into `handler.ts` for one reason
 * that matters more than tidiness: the legacy path must not change. A client
 * decides which era a server speaks from the shape of its replies, and this
 * connector is alive today only because dual-era clients see legacy answers and
 * fall back. So the legacy dispatcher is left byte-for-byte alone and this runs
 * beside it, with the HTTP boundary choosing between them.
 *
 * What the revision changed, and why so little of it lands here: it removed the
 * `initialize` handshake, protocol-level sessions, `ping`, `logging/setLevel`,
 * SSE resumability, and server-initiated requests; it added `server/discover`,
 * per-request `_meta`, `resultType`, `subscriptions/listen`, MRTR, and cache
 * hints. This server implements exactly one capability — `tools` — and was
 * already stateless, so most of that list is "nothing to migrate". What remains
 * is metadata validation, discovery, and result shape.
 */

/**
 * Modern revisions this server implements.
 *
 * Deliberately *only* modern ones. The legacy revision we serve on the
 * handshake path does not belong here: it has no per-request `_meta`, so a
 * request declaring it would be incoherent, and answering one with
 * `resultType` and `server/discover` would hand modern semantics to a client
 * that cannot read them. The two eras advertise themselves separately —
 * `initialize` for legacy, `server/discover` for modern.
 */
export const MODERN_SUPPORTED_VERSIONS = ['2026-07-28'] as const;

/** The modern revision. */
export const MODERN_PROTOCOL_VERSION = '2026-07-28';

/** `_meta` keys the revision reserves for per-request protocol fields. */
export const META_PROTOCOL_VERSION = 'io.modelcontextprotocol/protocolVersion';
export const META_CLIENT_INFO = 'io.modelcontextprotocol/clientInfo';
export const META_CLIENT_CAPABILITIES = 'io.modelcontextprotocol/clientCapabilities';
export const META_SERVER_INFO = 'io.modelcontextprotocol/serverInfo';

/** Headers the transport mirrors from the body so intermediaries can route. */
export const HEADER_PROTOCOL_VERSION = 'mcp-protocol-version';
export const HEADER_METHOD = 'mcp-method';
export const HEADER_NAME = 'mcp-name';

/**
 * Methods requiring `Mcp-Name`, and which body field it mirrors.
 *
 * The transport's header table maps them differently — `tools/call` and
 * `prompts/get` mirror `params.name`, `resources/read` mirrors `params.uri` —
 * so a single "name-bearing" set would validate the wrong field for one of
 * them. Only `tools/call` is reachable today, since this server implements no
 * resources or prompts, but writing the mapping out means adding one later
 * cannot silently compare against a field it does not have.
 */
const NAME_HEADER_SOURCE: ReadonlyMap<string, 'name' | 'uri'> = new Map([
  ['tools/call', 'name'],
  ['prompts/get', 'name'],
  ['resources/read', 'uri'],
]);

export const SERVER_DISCOVER_METHOD = 'server/discover';

/** `event` discriminator for a served modern-era request. */
export const MCP_MODERN_CALL_EVENT = 'mcp_modern_call';

/**
 * A JSON-RPC response plus the HTTP status the revision demands for it.
 *
 * The status is not cosmetic. A dual-era client inspects the *body of a 400*
 * to decide whether a server is modern or legacy, so returning 200 with a
 * JSON-RPC error — which is what the legacy path does — would read as "not a
 * modern server" and send the client back to the handshake.
 */
export interface ModernOutcome {
  response: JsonRpcResponse | null;
  status: number;
}

/** Narrow an unknown value to a plain object, or `{}` — never throws. */
function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Does this request open in the modern era?
 *
 * The spec's own rule for a dual-era server: "a request carrying modern
 * per-request `_meta` is served statelessly according to this revision; an
 * `initialize` request selects legacy semantics." The protocol version in
 * `_meta` is the marker, because it is the one field required on every modern
 * request.
 */
export function isModernRequest(request: JsonRpcRequest): boolean {
  return asString(asRecord(asRecord(request.params)._meta)[META_PROTOCOL_VERSION]) !== null;
}

/**
 * Decode the `=?base64?...?=` sentinel a client uses when a header value
 * cannot be represented as plain ASCII.
 *
 * Servers **MUST** decode before comparing to the body, or a tool whose name is
 * non-ASCII would fail validation against its own correct request.
 */
export function decodeHeaderValue(value: string): string {
  if (!value.startsWith('=?base64?') || !value.endsWith('?=')) {
    return value;
  }
  try {
    return Buffer.from(value.slice(9, -2), 'base64').toString('utf8');
  } catch {
    return value;
  }
}

export interface ModernRequestMeta {
  protocolVersion: string | null;
  clientName: string | null;
  clientVersion: string | null;
  /** Present-or-absent matters: the field is required, `{}` is a valid value. */
  hasClientCapabilities: boolean;
  clientCapabilities: string[];
}

/** Read the per-request protocol fields. Pure and total. */
export function readModernMeta(params: unknown): ModernRequestMeta {
  const meta = asRecord(asRecord(params)._meta);
  const clientInfo = asRecord(meta[META_CLIENT_INFO]);
  const capabilities = meta[META_CLIENT_CAPABILITIES];

  return {
    protocolVersion: asString(meta[META_PROTOCOL_VERSION]),
    clientName: asString(clientInfo.name),
    clientVersion: asString(clientInfo.version),
    hasClientCapabilities:
      capabilities !== null && typeof capabilities === 'object' && !Array.isArray(capabilities),
    clientCapabilities: Object.keys(asRecord(capabilities)).sort(),
  };
}

/**
 * Validate the mirrored headers against the body.
 *
 * The threat this closes is a request that means two different things: an
 * intermediary routes or rate-limits on `Mcp-Method`/`Mcp-Name` while the
 * server executes what the body says. Disagreement is therefore rejected
 * rather than resolved in either direction.
 */
export function validateHeaders(
  request: JsonRpcRequest,
  headers: Record<string, string | undefined>,
  metaProtocolVersion: string | null,
): string | null {
  const protocolHeader = asString(headers[HEADER_PROTOCOL_VERSION]);
  if (protocolHeader === null) {
    return `${HEADER_PROTOCOL_VERSION} header is required`;
  }
  if (protocolHeader !== metaProtocolVersion) {
    return `${HEADER_PROTOCOL_VERSION} header value '${protocolHeader}' does not match body value '${metaProtocolVersion}'`;
  }

  const methodHeader = asString(headers[HEADER_METHOD]);
  if (methodHeader === null) {
    return `${HEADER_METHOD} header is required`;
  }
  if (methodHeader !== request.method) {
    return `${HEADER_METHOD} header value '${methodHeader}' does not match body value '${request.method}'`;
  }

  const nameSource = NAME_HEADER_SOURCE.get(request.method);
  if (nameSource === undefined) {
    return null;
  }
  const bodyName = asString(asRecord(request.params)[nameSource]);
  const nameHeader = asString(headers[HEADER_NAME]);
  if (nameHeader === null) {
    return `${HEADER_NAME} header is required for ${request.method}`;
  }
  if (decodeHeaderValue(nameHeader) !== bodyName) {
    return `${HEADER_NAME} header value '${decodeHeaderValue(nameHeader)}' does not match body value '${bodyName}'`;
  }
  return null;
}

export interface ServerIdentity {
  name: string;
  version: string;
}

/** Wrap a result in the modern envelope: `resultType` plus server identity. */
export function modernResult(
  id: JsonRpcId,
  result: Record<string, unknown>,
  serverInfo: ServerIdentity,
): JsonRpcResponse {
  return success(id, {
    ...result,
    // Spread after `result` so a handler cannot accidentally set either: every
    // modern result is `complete` here, since this server has no MRTR flows.
    resultType: 'complete',
    _meta: { ...asRecord(result._meta), [META_SERVER_INFO]: serverInfo },
  });
}

/**
 * `server/discover` — a server **MUST** implement it.
 *
 * Answering it truthfully is what makes a dual-era client stay modern instead
 * of falling back, so it is the single most load-bearing method in this module.
 */
export function discoverResult(
  id: JsonRpcId,
  serverInfo: ServerIdentity,
  instructions: string,
): JsonRpcResponse {
  return modernResult(
    id,
    {
      supportedVersions: [...MODERN_SUPPORTED_VERSIONS],
      // Only what we actually implement. Advertising a capability we do not
      // serve would invite requests we answer with method-not-found.
      capabilities: { tools: {} },
      instructions,
      ttlMs: 3_600_000,
      cacheScope: 'private',
    },
    serverInfo,
  );
}

export interface ModernDispatchContext {
  headers: Record<string, string | undefined>;
  serverInfo: ServerIdentity;
  instructions: string;
  correlationId: string;
  userId: string;
  /**
   * Serves the tool methods, shared verbatim with the legacy path so the two
   * eras cannot answer the same call differently.
   */
  dispatch: (request: JsonRpcRequest) => Promise<JsonRpcResponse | null>;
}

/**
 * Serve one modern-era request.
 *
 * Order is deliberate and follows the spec's own precedence: version support
 * first (a client speaking a revision we do not implement should be told which
 * ones we do, not lectured about headers it wrote correctly for its own
 * revision), then required metadata, then header agreement.
 */
export async function dispatchModernRequest(
  request: JsonRpcRequest,
  context: ModernDispatchContext,
): Promise<ModernOutcome> {
  const id = request.id ?? null;
  const meta = readModernMeta(request.params);

  log('info', 'mcp modern call', {
    event: MCP_MODERN_CALL_EVENT,
    method: request.method,
    protocolVersion: meta.protocolVersion,
    clientName: meta.clientName,
    clientVersion: meta.clientVersion,
    userId: context.userId,
    correlationId: context.correlationId,
  });

  if (
    meta.protocolVersion === null ||
    !MODERN_SUPPORTED_VERSIONS.includes(
      meta.protocolVersion as (typeof MODERN_SUPPORTED_VERSIONS)[number],
    )
  ) {
    return {
      response: unsupportedProtocolVersion(id, meta.protocolVersion, MODERN_SUPPORTED_VERSIONS),
      status: 400,
    };
  }

  // `clientCapabilities` is required even when empty — its absence means the
  // client has told us nothing, which is different from telling us it has none.
  if (!meta.hasClientCapabilities) {
    return {
      response: failure(
        id,
        JsonRpcErrorCode.InvalidParams,
        `Missing required _meta field: ${META_CLIENT_CAPABILITIES}`,
      ),
      status: 400,
    };
  }

  const headerProblem = validateHeaders(request, context.headers, meta.protocolVersion);
  if (headerProblem !== null) {
    return { response: headerMismatch(id, headerProblem), status: 400 };
  }

  switch (request.method) {
    case SERVER_DISCOVER_METHOD:
      return {
        response: discoverResult(id, context.serverInfo, context.instructions),
        status: 200,
      };

    case 'tools/list':
    case 'tools/call': {
      const served = await context.dispatch(request);
      if (served === null) {
        return { response: null, status: 202 };
      }
      if ('error' in served) {
        // A tool-layer error keeps its own code and a 200: it is an error about
        // the call, not about the request's modern framing, and only the latter
        // carries the 4xx statuses a client uses to detect our era.
        return { response: served, status: 200 };
      }
      // `CacheableResult` on the list only: a freshness hint plus `private`,
      // because the tool list varies by the caller's authorization and a shared
      // intermediary must not serve one caller's list to another.
      const cacheHints =
        request.method === 'tools/list' ? { ttlMs: 60_000, cacheScope: 'private' } : {};
      return {
        response: modernResult(
          id,
          { ...asRecord(served.result), ...cacheHints },
          context.serverInfo,
        ),
        status: 200,
      };
    }

    default:
      // Modern servers answer an unimplemented method with 404 plus a JSON-RPC
      // error, which is precisely what tells a probing client we are modern.
      return {
        response: failure(
          id,
          JsonRpcErrorCode.MethodNotFound,
          `Method not found: ${request.method}`,
        ),
        status: 404,
      };
  }
}
