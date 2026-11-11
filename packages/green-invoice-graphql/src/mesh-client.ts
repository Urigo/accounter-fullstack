import { LegacyLogger, Logger, type LogLevel } from '@graphql-hive/logger';
import { getSdkRequesterForUnifiedGraph } from '@graphql-mesh/fusion-runtime';
import * as restTransport from '@graphql-mesh/transport-rest';
import { getSdk, type Sdk } from './__generated__/sdk.js';
import supergraph from './__generated__/supergraph.js';
import { isUnauthorizedError, type GreenInvoiceTokenSource } from './access-token.js';

export type GreenInvoiceContext = {
  /** Fills `{context.authToken}` in the composed operation headers */
  authToken: string;
  /** Replaces the HTTP client for the upstream calls, e.g. to run tests offline */
  fetch?: typeof fetch;
};

const LOG_LEVELS: readonly LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error'];

/**
 * Reads `GREEN_INVOICE_LOG_LEVEL`, defaulting to `info`. An unknown value falls back to `info`
 * rather than reaching the logger, which would silently drop every log, errors included.
 */
function resolveLogLevel(raw = process.env['GREEN_INVOICE_LOG_LEVEL']): LogLevel {
  const value = raw?.trim().toLowerCase();
  if (!value) {
    return 'info';
  }
  const level = LOG_LEVELS.find(candidate => candidate === value);
  if (!level) {
    console.warn(`Ignoring unknown GREEN_INVOICE_LOG_LEVEL "${raw}"; using "info"`);
    return 'info';
  }
  return level;
}

/**
 * The REST transport logs every upstream request at debug level, headers (`Authorization: Bearer
 * <token>`) and response bodies included. A Hive `Logger` with no explicit level follows the
 * generic `DEBUG` / `LOG_LEVEL` env vars, and fusion-runtime's fallback when no logger is passed has
 * changed between releases, so the level is set explicitly, from `GREEN_INVOICE_LOG_LEVEL` only.
 * `debug` and `trace` print the bearer token and response bodies: local troubleshooting only.
 */
const log = new Logger({ level: resolveLogLevel() });

/**
 * Executes operations in-process against the composed supergraph, with no gateway server. Built once
 * per process (the counterpart of Mesh v0's cached `getBuiltMesh()`), since building it parses the
 * supergraph.
 */
const requester = getSdkRequesterForUnifiedGraph({
  getUnifiedGraph: () => supergraph,
  // Passed explicitly: otherwise the runtime resolves it with a name-based dynamic import
  // (`@graphql-mesh/transport-${kind}`), which only works if the package happens to be hoisted.
  transports: { rest: restTransport },
  transportContext: { log, logger: LegacyLogger.from(log) },
});

/**
 * Same contract as Mesh v0's generated `getMeshSDK(globalContext)`: every call runs with the given
 * context. Results resolve to `data`; GraphQL errors are thrown (several as an `AggregateError`).
 */
export function getMeshSDK(context: GreenInvoiceContext): Sdk {
  return getSdk((document, variables, operationContext?: object) =>
    requester(document, variables, { ...context, ...operationContext }),
  );
}

export type GreenInvoiceSdkOptions = {
  /** API key ID */
  id: string;
  /** API key secret */
  secret: string;
  /** Supplies the access token for each call; share one cache across requests to reuse tokens */
  tokenCache: GreenInvoiceTokenSource;
  /** Replaces the HTTP client for the upstream calls, e.g. to run tests offline */
  fetch?: typeof fetch;
  /**
   * `tokenCache.epoch` as observed **before** `id` and `secret` were read. If any key is evicted
   * after that, the credentials may be outdated and this SDK stops using the cache (see
   * `GetTokenOptions.epoch`). Defaults to the epoch when the SDK is created.
   */
  epoch?: number;
};

/**
 * An SDK that takes its access token from `tokenCache` on every call, instead of being bound to one
 * token. If the API rejects the token (HTTP 401), the token is dropped from the cache and the call is
 * retried once with a new one; a 401 means the request was rejected before it had any effect, so
 * this is safe for mutations too.
 */
export function createGreenInvoiceSdk({
  id,
  secret,
  tokenCache,
  fetch: fetchFn,
  epoch = tokenCache.epoch,
}: GreenInvoiceSdkOptions): Sdk {
  const tokenOptions = { epoch };

  /** Runs one operation with the given token; the token wins over any caller-supplied `authToken` */
  const execute = async (
    document: Parameters<typeof requester>[0],
    variables: Parameters<typeof requester>[1],
    operationContext: object | undefined,
    token: string,
  ) => {
    const context: Partial<GreenInvoiceContext> = {};
    if (fetchFn) {
      context.fetch = fetchFn;
    }
    return requester(document, variables, { ...context, ...operationContext, authToken: token });
  };

  return getSdk(async (document, variables, operationContext?: object) => {
    const token = await tokenCache.getToken(id, secret, tokenOptions);
    try {
      return await execute(document, variables, operationContext, token);
    } catch (error) {
      if (!isUnauthorizedError(error)) {
        throw error;
      }
      tokenCache.invalidate(id, token);
      const newToken = await tokenCache.getToken(id, secret, tokenOptions);
      try {
        return await execute(document, variables, operationContext, newToken);
      } catch (retryError) {
        // the replacement was rejected too: don't leave it cached for the next caller
        if (isUnauthorizedError(retryError)) {
          tokenCache.invalidate(id, newToken);
        }
        throw retryError;
      }
    }
  });
}
