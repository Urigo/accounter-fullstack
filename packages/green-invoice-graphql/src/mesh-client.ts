import { LegacyLogger, Logger, type LogLevel } from '@graphql-hive/logger';
import { getSdkRequesterForUnifiedGraph } from '@graphql-mesh/fusion-runtime';
import * as restTransport from '@graphql-mesh/transport-rest';
import { getSdk, type Sdk } from './__generated__/sdk.js';
import supergraph from './__generated__/supergraph.js';

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
