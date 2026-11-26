import { withDevAuthHeader } from '../auth/local-dev-auth.js';
import { env, type AppConfig } from '../config/env.js';
import { UpstreamGraphQLClient } from './graphql-client.js';

let cached: UpstreamGraphQLClient | undefined;

/**
 * Build the upstream client a configuration calls for. In local dev-auth mode its `fetch` adds
 * `X-Dev-Auth` and drops `Authorization` on every call (`auth/local-dev-auth.ts`); otherwise the
 * caller's bearer token is forwarded per call, as before.
 */
export function createUpstreamClient(
  config: Pick<AppConfig, 'upstream' | 'localDevAuth'>,
  fetchImpl: typeof fetch = globalThis.fetch,
): UpstreamGraphQLClient {
  return new UpstreamGraphQLClient({
    endpoint: config.upstream.graphqlUrl,
    timeoutMs: config.upstream.timeoutMs,
    longRunningTimeoutMs: config.upstream.longTimeoutMs,
    fetchImpl: config.localDevAuth
      ? withDevAuthHeader(config.localDevAuth.userId, fetchImpl)
      : fetchImpl,
  });
}

/**
 * The process-wide upstream GraphQL client, configured from the environment
 * (endpoint + timeout budget). Lazily created and memoized.
 */
export function getUpstreamClient(): UpstreamGraphQLClient {
  cached ??= createUpstreamClient(env);
  return cached;
}

/** Test-only: reset the memoized client. */
export function resetUpstreamClient(): void {
  cached = undefined;
}
