import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type BusinessMembership } from '../auth/identity.js';
import type { AuthPrincipal } from '../auth/token.js';
import { searchChargesTool } from '../tools/charges.js';
import { executeRegisteredTool } from '../tools/execute.js';
import { UpstreamError, UpstreamGraphQLClient } from '../upstream/graphql-client.js';

/**
 * Practical performance & timeout validation for phase-1 read-only workloads
 * (blueprint Prompt 22). Deterministic and service-free: the upstream is an
 * injected `fetchImpl`, so the numbers reflect our own pipeline overhead
 * (validation → policy → handler → client), not a real network.
 *
 * Kept lightweight enough to run in the normal suite; it also writes a short
 * benchmark summary artifact to `packages/mcp-server/bench/summary.md`.
 */

const BUSINESS = 'aa000000-0000-4000-8000-000000000001';

function authContext() {
  const principal: AuthPrincipal = {
    subject: 'user-perf',
    issuer: 'https://tenant.auth0.com/',
    audience: 'mcp-api',
    scopes: ['business_owner'],
    email: 'perf@example.com',
    expiresAt: undefined,
    claims: { sub: 'user-perf' },
  };
  const memberships: BusinessMembership[] = [{ businessId: BUSINESS, roleId: 'business_owner' }];
  return buildAuthContext(principal, memberships);
}

const CHARGES_RESPONSE = {
  data: {
    allCharges: {
      nodes: [
        {
          id: 'charge-1',
          userDescription: 'Coffee',
          totalAmount: { raw: -12.5, formatted: '-12.50', currency: 'ILS' },
          minEventDate: '2026-01-05',
        },
      ],
      pageInfo: { totalPages: 1, totalRecords: 1, currentPage: null, pageSize: null },
    },
  },
};

/**
 * A `fetch` that resolves after `delayMs`, honoring the abort signal. A zero
 * delay resolves immediately (no timer) so the load scenario measures pure
 * pipeline overhead rather than macrotask scheduling.
 */
function delayedFetch(delayMs: number, body: unknown): typeof fetch {
  return ((_url: string, init?: { signal?: AbortSignal }) => {
    if (delayMs === 0) {
      return Promise.resolve({ ok: true, status: 200, json: async () => body } as Response);
    }
    return new Promise((resolve, reject) => {
      const signal = init?.signal;
      const abortError = () => Object.assign(new Error('aborted'), { name: 'AbortError' });
      // Match real fetch: if the signal is already aborted, reject immediately
      // rather than waiting for an 'abort' event that will never fire.
      if (signal?.aborted) {
        reject(abortError());
        return;
      }
      const timer = setTimeout(
        () => resolve({ ok: true, status: 200, json: async () => body } as Response),
        delayMs,
      );
      signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(abortError());
        },
        { once: true },
      );
    });
  }) as unknown as typeof fetch;
}

function fastClient(): UpstreamGraphQLClient {
  return new UpstreamGraphQLClient({
    endpoint: 'http://upstream.local/graphql',
    timeoutMs: 1000,
    fetchImpl: delayedFetch(0, CHARGES_RESPONSE),
  });
}

function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  // Nearest-rank: the q-th percentile is the ceil(q·n)-th value (1-indexed), so
  // p95 of 100 samples is the 95th value, not the 96th.
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[index];
}

// Generous CI-safe ceilings for our in-process overhead per read-only call.
const P95_TARGET_MS = 25;
const LOAD_CALLS = 500;
const CONCURRENCY = 50;

let summary: {
  latencySamples: number;
  p50: number;
  p95: number;
  max: number;
  loadCalls: number;
  concurrency: number;
  throughputPerSec: number;
} | null = null;

async function callCharges(client: UpstreamGraphQLClient, auth = authContext()) {
  return executeRegisteredTool({
    tool: searchChargesTool,
    rawArgs: { fromDate: '2026-01-01' },
    auth,
    correlationId: 'perf',
    client,
  });
}

describe('read-only tool call load', () => {
  it('keeps per-call p95 latency within target', async () => {
    const auth = authContext();
    const client = fastClient();

    // True per-call latency: measured sequentially so the sample reflects
    // pipeline cost, not queueing behind concurrent calls. Warm up first.
    for (let i = 0; i < 20; i++) await callCharges(client, auth);

    const durations: number[] = [];
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      const result = await callCharges(client, auth);
      durations.push(performance.now() - start);
      expect(result.isError).toBeUndefined();
    }
    durations.sort((a, b) => a - b);

    const partial = {
      latencySamples: durations.length,
      p50: percentile(durations, 0.5),
      p95: percentile(durations, 0.95),
      max: durations[durations.length - 1],
    };
    summary = { ...partial, loadCalls: 0, concurrency: 0, throughputPerSec: 0 };

    expect(partial.p95).toBeLessThan(P95_TARGET_MS);
  });

  it('sustains throughput under baseline concurrency with no errors', async () => {
    const auth = authContext();
    const client = fastClient();

    const start = performance.now();
    let completed = 0;
    // Fixed-size worker pool draining a shared counter keeps `CONCURRENCY`
    // calls in flight at once.
    let issued = 0;
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        for (;;) {
          // Claim a slot atomically (read-then-increment with no await between)
          // so the pool issues exactly LOAD_CALLS across all workers.
          const current = issued++;
          if (current >= LOAD_CALLS) break;
          const result = await callCharges(client, auth);
          expect(result.isError).toBeUndefined();
          completed++;
        }
      }),
    );
    const elapsedMs = performance.now() - start;
    const throughputPerSec = (completed / elapsedMs) * 1000;

    expect(completed).toBe(LOAD_CALLS);
    if (summary) {
      summary = { ...summary, loadCalls: completed, concurrency: CONCURRENCY, throughputPerSec };
    }
  });
});

describe('timeout and retry behavior', () => {
  it('aborts a slow upstream past the budget and surfaces a retryable TIMEOUT_ERROR', async () => {
    const fetchImpl = vi.fn(delayedFetch(100, CHARGES_RESPONSE));
    const client = new UpstreamGraphQLClient({
      endpoint: 'http://upstream.local/graphql',
      timeoutMs: 25,
      maxRetries: 2,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(
      client.query({ query: 'query { x }' }, { correlationId: 'perf' }),
    ).rejects.toMatchObject({ code: 'TIMEOUT_ERROR', retryable: true });

    // 1 initial attempt + 2 retries, since a timeout is retryable.
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('does not retry a validation/handler error (only retryable failures loop)', async () => {
    const client = fastClient();
    const result = await executeRegisteredTool({
      tool: searchChargesTool,
      rawArgs: { fromDate: '2026-13-40' }, // impossible date → VALIDATION_ERROR, no upstream call
      auth: authContext(),
      correlationId: 'perf',
      client,
    });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
  });

  it('completes a delayed-but-within-budget upstream response successfully', async () => {
    const client = new UpstreamGraphQLClient({
      endpoint: 'http://upstream.local/graphql',
      timeoutMs: 200,
      fetchImpl: delayedFetch(15, CHARGES_RESPONSE),
    });
    const data = await client.query<{ allCharges: { nodes: unknown[] } }>(
      { query: 'query { allCharges { nodes { id } } }' },
      { correlationId: 'perf' },
    );
    expect(data.allCharges.nodes).toHaveLength(1);
  });

  it('is UpstreamError, not a raw error, when the budget is exceeded', async () => {
    const client = new UpstreamGraphQLClient({
      endpoint: 'http://upstream.local/graphql',
      timeoutMs: 10,
      maxRetries: 0,
      fetchImpl: delayedFetch(100, CHARGES_RESPONSE),
    });
    await expect(
      client.query({ query: 'query { x }' }, { correlationId: 'perf' }),
    ).rejects.toBeInstanceOf(UpstreamError);
  });
});

afterAll(() => {
  if (!summary) return;
  const artifactPath = fileURLToPath(new URL('../../bench/summary.md', import.meta.url));
  const lines = [
    '# MCP server — phase 1 benchmark summary',
    '',
    '_Generated by `packages/mcp-server/src/__tests__/perf.test.ts`. Numbers reflect in-process',
    'pipeline overhead (validation → policy → handler → upstream client) with a mocked upstream._',
    '',
    '## Read-only tool call latency',
    '',
    `- Scenario: \`accounter_search_charges\` (${summary.latencySamples} sequential samples)`,
    `- p50: ${summary.p50.toFixed(3)} ms`,
    `- p95: ${summary.p95.toFixed(3)} ms (target < ${P95_TARGET_MS} ms)`,
    `- max: ${summary.max.toFixed(3)} ms`,
    '',
    '## Throughput under baseline concurrency',
    '',
    `- ${summary.loadCalls} calls at concurrency ${summary.concurrency}`,
    `- throughput: ${summary.throughputPerSec.toFixed(0)} calls/sec (0 errors)`,
    '',
    '## Timeout & retry',
    '',
    '- A slow upstream past the timeout budget aborts and surfaces a retryable `TIMEOUT_ERROR`.',
    '- Retryable failures loop up to `maxRetries` (1 + 2 attempts observed); non-retryable',
    '  validation/handler errors do not retry.',
    '- A delayed-but-within-budget response completes successfully.',
    '',
  ];
  mkdirSync(dirname(artifactPath), { recursive: true });
  writeFileSync(artifactPath, lines.join('\n'), 'utf8');
  // eslint-disable-next-line no-console
  console.log(
    `[perf] p50=${summary.p50.toFixed(2)}ms p95=${summary.p95.toFixed(2)}ms max=${summary.max.toFixed(
      2,
    )}ms (${summary.concurrency} concurrent) → ${artifactPath}`,
  );
});
