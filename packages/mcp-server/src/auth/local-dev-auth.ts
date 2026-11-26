import type { AuthPrincipal } from './token.js';

/**
 * Local dev-auth mode: run the MCP server against a GraphQL server on this machine without Auth0.
 *
 * With `MCP_LOCAL_DEV_AUTH_USER_ID` set, every `/mcp` request is treated as that user (a
 * `business_users.user_id`), no bearer token is asked for or verified, and every upstream call
 * carries `X-Dev-Auth: <user id>` instead of an `Authorization` header. The upstream honours that
 * header only when it was started with `ALLOW_DEV_AUTH=1` (`packages/server/src/plugins/auth-plugin.ts`).
 *
 * It is off unless the variable is set, and `parseEnv` refuses it unless all of these hold, so it
 * cannot be switched on for a deployment by accident:
 * - `GRAPHQL_UPSTREAM_URL` is on a loopback host, so the header only ever reaches this machine;
 * - `MCP_PUBLIC_BASE_URL` is on a loopback host, so the server is not published as a connector;
 * - `NODE_ENV` is not `production`.
 * The server then listens on 127.0.0.1 only (`server.ts`) and logs a warning at startup.
 */

export const LOCAL_DEV_AUTH_ENV = 'MCP_LOCAL_DEV_AUTH_USER_ID';

/** Header the upstream reads for dev auth. Mirrors `packages/server/src/plugins/auth-plugin.ts`. */
export const DEV_AUTH_HEADER = 'X-Dev-Auth';

/** Address the server binds to in local mode: loopback only. */
export const LOCAL_DEV_AUTH_LISTEN_HOST = '127.0.0.1';

/** Issuer recorded on the synthetic principal, so logs never mistake it for an Auth0 one. */
export const LOCAL_DEV_AUTH_ISSUER = 'local-dev-auth';

/**
 * Whether a URL hostname (as `new URL(...).hostname` gives it) names this machine:
 * `localhost` and its subdomains, `127.0.0.0/8`, and `::1`. `0.0.0.0` is not included: as a
 * destination it is "any interface", which is not a promise about where the request lands.
 */
export function isLoopbackHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1');
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '::1' ||
    /^127(\.\d{1,3}){3}$/.test(host)
  );
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Reasons the local mode may not be enabled with this configuration; empty when it may.
 * Called by `parseEnv` only when the variable is set.
 */
export function localDevAuthRefusals(options: {
  upstreamUrl: string;
  publicBaseUrl: string;
  nodeEnv: string | undefined;
}): string[] {
  const refusals: string[] = [];
  const upstreamHost = hostnameOf(options.upstreamUrl);
  if (upstreamHost === null || !isLoopbackHostname(upstreamHost)) {
    refusals.push(
      `${LOCAL_DEV_AUTH_ENV} requires GRAPHQL_UPSTREAM_URL on a loopback host (localhost, ` +
        `127.0.0.1, ::1); got "${upstreamHost ?? options.upstreamUrl}". The ${DEV_AUTH_HEADER} ` +
        'header must never leave this machine.',
    );
  }
  const publicHost = hostnameOf(options.publicBaseUrl);
  if (publicHost === null || !isLoopbackHostname(publicHost)) {
    refusals.push(
      `${LOCAL_DEV_AUTH_ENV} requires MCP_PUBLIC_BASE_URL on a loopback host; got ` +
        `"${publicHost ?? options.publicBaseUrl}". A server reachable from elsewhere must ` +
        'authenticate its callers.',
    );
  }
  if (options.nodeEnv === 'production') {
    refusals.push(`${LOCAL_DEV_AUTH_ENV} cannot be set when NODE_ENV=production.`);
  }
  return refusals;
}

/**
 * The principal every request is mapped to in local mode. It carries no token material; the
 * memberships come from the upstream `myMemberships`, exactly as for a verified token.
 */
export function localDevPrincipal(userId: string): AuthPrincipal {
  return {
    subject: userId,
    issuer: LOCAL_DEV_AUTH_ISSUER,
    audience: undefined,
    scopes: [],
    email: null,
    expiresAt: undefined,
    claims: { sub: userId, iss: LOCAL_DEV_AUTH_ISSUER },
  };
}

/**
 * Wrap a `fetch` so every request carries `X-Dev-Auth: <userId>` and no `Authorization` header.
 * Installed on the upstream client in local mode (`upstream/default-client.ts`), so the
 * membership lookup and every tool call authenticate the same way without each call site knowing.
 */
export function withDevAuthHeader(userId: string, fetchImpl: typeof fetch): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    headers.delete('authorization');
    headers.set(DEV_AUTH_HEADER, userId);
    return fetchImpl(input, { ...init, headers });
  };
}

/** The startup banner. Printed to stderr in addition to the structured warning. */
export function localDevAuthBanner(userId: string, upstreamUrl: string): string {
  return [
    '',
    '  ⚠️  ==================================================================',
    '  ⚠️  MCP LOCAL DEV AUTH IS ON — requests are NOT authenticated.',
    `  ⚠️  Every /mcp request acts as business user ${userId},`,
    `  ⚠️  sent upstream as ${DEV_AUTH_HEADER} to ${upstreamUrl}.`,
    `  ⚠️  Listening on ${LOCAL_DEV_AUTH_LISTEN_HOST} only. Unset ${LOCAL_DEV_AUTH_ENV} to turn it off.`,
    '  ⚠️  ==================================================================',
    '',
  ].join('\n');
}
