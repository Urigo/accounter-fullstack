import { env } from '../config/env.js';
import { UpstreamGraphQLClient } from './graphql-client.js';

let cached: UpstreamGraphQLClient | undefined;

/**
 * The process-wide upstream GraphQL client, configured from the environment
 * (endpoint + timeout budget). Lazily created and memoized.
 */
export function getUpstreamClient(): UpstreamGraphQLClient {
  cached ??= new UpstreamGraphQLClient({
    endpoint: env.upstream.graphqlUrl,
    timeoutMs: env.upstream.timeoutMs,
  });
  return cached;
}

/** Test-only: reset the memoized client. */
export function resetUpstreamClient(): void {
  cached = undefined;
}
