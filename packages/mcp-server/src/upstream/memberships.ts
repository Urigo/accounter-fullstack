/**
 * Upstream membership source.
 *
 * The connector never derives business memberships from token claims (spec
 * §6.4, §7.1). Instead it forwards the caller's bearer token to the Accounter
 * GraphQL server and reads the memberships back from the dedicated
 * `myMemberships` query — the server maps the Auth0 `sub`/verified email to
 * `business_users` at request time. Because the connector holds a real
 * end-user token, "authenticating to the server" is plain token pass-through:
 * no Auth0 custom claim and no shared service secret.
 *
 * This is a {@link MembershipSource} implementation wired into
 * {@link resolveAuthContext}, replacing the default claims source.
 */

import {
  coerceMembership,
  type BusinessMembership,
  type MembershipSource,
} from '../auth/identity.js';
import {
  createReadOperation,
  UpstreamError,
  type UpstreamGraphQLClient,
} from './graphql-client.js';

/**
 * Read-only query for the authenticated caller's own business memberships.
 *
 * Only `businessId` and `roleId` are selected: the internal
 * {@link BusinessMembership} shape keeps nothing else, so fetching `businessName`
 * would just add payload and upstream work for a field that is immediately
 * dropped.
 */
export const MY_MEMBERSHIPS_QUERY = /* GraphQL */ `
  query McpMyMemberships {
    myMemberships {
      businessId
      roleId
    }
  }
`;

interface MyMembershipsData {
  myMemberships?: unknown;
}

/**
 * Typed, read-only wrapper around `myMemberships`. Maps the GraphQL rows to the
 * internal {@link BusinessMembership} shape via the shared `coerceMembership`.
 *
 * A non-array payload violates the server's non-null `[MyBusinessMembership!]!`
 * contract, so it is treated as an upstream error rather than silently coerced
 * to an empty (unscoped) result. A legitimately empty list maps to `[]`.
 */
const runMyMemberships = createReadOperation<
  MyMembershipsData,
  Record<string, never>,
  BusinessMembership[]
>(MY_MEMBERSHIPS_QUERY, data => {
  // A misbehaving upstream/proxy can return `data: null` (which the client
  // passes through, since only `undefined` is treated as "no data"). Guard it
  // so we raise a sanitized UpstreamError instead of a raw TypeError.
  if (!data || typeof data !== 'object') {
    throw new UpstreamError('UPSTREAM_ERROR', 'Upstream returned an invalid response body', false);
  }
  const rows = data.myMemberships;
  if (!Array.isArray(rows)) {
    throw new UpstreamError(
      'UPSTREAM_ERROR',
      'Upstream myMemberships did not return a list',
      false,
    );
  }
  const memberships: BusinessMembership[] = [];
  for (const row of rows) {
    const membership = coerceMembership(row);
    if (membership) {
      memberships.push(membership);
    }
  }
  return memberships;
});

export interface UpstreamMembershipSourceOptions {
  /** The shared upstream GraphQL client. */
  client: UpstreamGraphQLClient;
  /**
   * The caller's `Authorization` header value (`Bearer <token>`) to forward.
   * Never logged. Omitted ⇒ no header sent (the upstream will reject as 401,
   * which surfaces as an error rather than a silent empty scope).
   */
  authorization?: string;
  /** Correlation id propagated to the upstream call for tracing. */
  correlationId: string;
}

/**
 * Build a {@link MembershipSource} that resolves memberships from the server by
 * forwarding the caller's token to `myMemberships`.
 *
 * Error semantics: any upstream/auth/infra failure throws (the caller lets it
 * surface as 401/5xx) so a failed lookup never degrades into a silent empty
 * scope. Only a genuinely empty server result resolves to `[]`.
 *
 * The identity is carried entirely by the forwarded token, so the resolved
 * principal is not consulted here.
 */
export function createUpstreamMembershipSource(
  options: UpstreamMembershipSourceOptions,
): MembershipSource {
  const { client, authorization, correlationId } = options;
  return () => runMyMemberships(client, {}, { correlationId, authorization });
}
