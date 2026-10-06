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
