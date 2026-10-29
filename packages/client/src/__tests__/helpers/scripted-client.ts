import { Client, fetchExchange, type RequestPolicy } from 'urql';
import { createCacheExchange } from '../../providers/urql-cache.js';

/** Answers one operation, by name, with the `data` it should resolve to. */
export type ScriptedResponse = (variables: Record<string, unknown>) => unknown;

export type ScriptedClientOptions = {
  /** Each operation's name is pushed here as it reaches the network. */
  operations?: string[];
  responses?: Record<string, ScriptedResponse>;
  /** Answers any operation `responses` has no entry for. Defaults to empty data. */
  fallback?: ScriptedResponse;
  /**
   * Puts the production normalized cache (`providers/urql-cache.ts`) in front of the fetch, with the
   * client's production default policy unless `requestPolicy` says otherwise. Fixtures then need a
   * `__typename` on every object, as the server would send: graphcache adds it to every selection.
   */
  cache?: boolean;
  requestPolicy?: RequestPolicy;
};

/**
 * A real urql `Client` backed by a scripted, request-recording `fetch`, so a test asserts on the
 * operations a component actually issues rather than on a mocked hook.
 */
export function makeScriptedClient({
  operations = [],
  responses = {},
  fallback = () => ({}),
  cache = false,
  requestPolicy,
}: ScriptedClientOptions = {}): Client {
  const mockFetch = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as {
      operationName: string;
      variables?: Record<string, unknown>;
    };
    operations.push(body.operationName);
    const data = (responses[body.operationName] ?? fallback)(body.variables ?? {});
    const payload = JSON.stringify({ data });
    return {
      status: 200,
      ok: true,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      text: async () => payload,
      json: async () => JSON.parse(payload),
    } as unknown as Response;
  }) as unknown as typeof fetch;

  return new Client({
    url: 'http://localhost/graphql',
    exchanges: cache ? [createCacheExchange(), fetchExchange] : [fetchExchange],
    fetch: mockFetch,
    // Keep every operation on POST so the harness can read the body.
    preferGetMethod: false,
    requestPolicy: requestPolicy ?? (cache ? 'cache-and-network' : undefined),
  });
}
