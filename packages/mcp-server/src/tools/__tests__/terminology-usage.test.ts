import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { Metrics } from '../../observability/metrics.js';
import { UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import { executeRegisteredTool, TOOL_CALL_EVENT } from '../execute.js';
import {
  EXPLAIN_TERMINOLOGY_TOOL_NAME,
  explainTerminologyTool,
  GLOSSARY_MODE_COUNTER,
  GLOSSARY_TERM_MISSES_COUNTER,
  GLOSSARY_TERM_REQUESTS_COUNTER,
} from '../terminology.js';
import { GLOSSARY } from '../terminology-data.js';

/**
 * Usage-telemetry suite for the glossary tool: what a caller asks the glossary
 * is the readable signal of what they were trying to do, so these assertions
 * pin the fields and counters that answer "most-requested term" and "which
 * requested terms are missing".
 *
 * Driven through `executeRegisteredTool` (not the `observe` hook directly) so
 * the log line and the counter recording are covered together with it.
 */

const PRINCIPAL: AuthPrincipal = {
  subject: 'user-1',
  issuer: 'https://tenant.auth0.com/',
  audience: 'aud',
  scopes: [],
  email: null,
  expiresAt: undefined,
  claims: { sub: 'user-1' },
};

function authContext(memberBusinessIds: string[] = ['b1']): McpAuthContext {
  return buildAuthContext(
    PRINCIPAL,
    memberBusinessIds.map(memberBusinessId => ({ memberBusinessId, roleId: 'accountant' })),
  );
}

function client() {
  return new UpstreamGraphQLClient({
    endpoint: 'http://localhost:4000/graphql',
    timeoutMs: 1000,
    fetchImpl: vi.fn() as unknown as typeof fetch,
  });
}

interface UsageLine {
  event?: string;
  tool?: string;
  outcome?: string;
  userId?: string;
  latencyMs?: number;
  glossaryMode?: string;
  requestedTerms?: string[];
  matchedTerms?: string[];
  missedTerms?: string[];
  requestedTopics?: string[];
  requestedTermCount?: number;
  returnedCount?: number;
  [key: string]: unknown;
}

let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** The single `tool_call` line emitted by the run. */
function usageLine(): UsageLine {
  const lines = logSpy.mock.calls
    .map(call => JSON.parse(String(call[0])) as UsageLine)
    .filter(entry => entry.event === TOOL_CALL_EVENT);
  expect(lines).toHaveLength(1);
  return lines[0];
}

async function run(rawArgs: unknown) {
  const metrics = new Metrics();
  const result = await executeRegisteredTool({
    tool: explainTerminologyTool,
    rawArgs,
    auth: authContext(),
    correlationId: 'corr-1',
    client: client(),
    metrics,
  });
  return { result, metrics, line: usageLine() };
}

describe('terminology usage logging', () => {
  it('logs the canonical fields for a term lookup', async () => {
    const { line } = await run({ terms: ['charge'] });

    expect(line).toMatchObject({
      event: TOOL_CALL_EVENT,
      tool: EXPLAIN_TERMINOLOGY_TOOL_NAME,
      outcome: 'success',
      userId: 'user-1',
      glossaryMode: 'full',
      matchedTerms: ['charge'],
      missedTerms: [],
      requestedTermCount: 1,
    });
    expect(typeof line.latencyMs).toBe('number');
  });

  it('keeps the verbatim spelling alongside the canonical term it resolved to', async () => {
    const { line } = await run({ terms: ['valueDate'] });

    expect(line.requestedTerms).toEqual(['valueDate']);
    expect(line.matchedTerms).toEqual(['value-date']);
  });

  it('reports an unmatched term as a miss without failing the call', async () => {
    const { result, line, metrics } = await run({ terms: ['frobnicator'] });

    expect(result.isError).toBeUndefined();
    expect(line.missedTerms).toEqual(['frobnicator']);
    expect(line.matchedTerms).toEqual([]);
    expect(metrics.snapshot().labeledTotals[GLOSSARY_TERM_MISSES_COUNTER]).toEqual({
      frobnicator: 1,
    });
  });

  it('folds a miss label so one missing concept is one label', async () => {
    const { metrics } = await run({ terms: ['Frob Nicator', 'frob-nicator'] });

    expect(metrics.snapshot().labeledTotals[GLOSSARY_TERM_MISSES_COUNTER]).toEqual({
      frobnicator: 2,
    });
  });

  it('counts each requested term under its canonical name', async () => {
    const { metrics } = await run({ terms: ['charge', 'valueDate', 'value-date'] });

    expect(metrics.snapshot().labeledTotals[GLOSSARY_TERM_REQUESTS_COUNTER]).toEqual({
      charge: 1,
      'value-date': 2,
    });
  });

  describe('index mode', () => {
    it('is logged as its own mode with no requested terms', async () => {
      const { line } = await run({});

      expect(line).toMatchObject({ glossaryMode: 'index', requestedTermCount: 0 });
      expect(line.matchedTerms).toBeUndefined();
    });

    it('credits no individual term', async () => {
      const { metrics } = await run({});
      const snapshot = metrics.snapshot();

      // Index mode returns the whole glossary; counting every entry as
      // "requested" would drown the signal from real lookups.
      expect(snapshot.labeledTotals[GLOSSARY_TERM_REQUESTS_COUNTER]).toBeUndefined();
      expect(snapshot.labeledTotals[GLOSSARY_MODE_COUNTER]).toEqual({ index: 1 });
    });
  });

  describe('topics', () => {
    it('does not credit the terms a topic pulled in', async () => {
      const { line, metrics } = await run({ topics: ['charge'] });

      // Every charge entry is returned, but none of them was asked for by name.
      expect(line.requestedTopics).toEqual(['charge']);
      expect(line.matchedTerms).toEqual([]);
      expect(line.requestedTermCount).toBe(0);
      expect(metrics.snapshot().labeledTotals[GLOSSARY_TERM_REQUESTS_COUNTER]).toBeUndefined();

      const chargeTerms = GLOSSARY.filter(entry => entry.topic === 'charge');
      expect(chargeTerms.length).toBeGreaterThan(1);
      expect(line.returnedCount).toBe(chargeTerms.length);
    });

    it('still credits a term named explicitly alongside a topic', async () => {
      const { metrics } = await run({ terms: ['charge'], topics: ['ledger'] });

      expect(metrics.snapshot().labeledTotals[GLOSSARY_TERM_REQUESTS_COUNTER]).toEqual({
        charge: 1,
      });
    });
  });

  it('emits no usage fields onto the wire payload', async () => {
    const { result } = await run({ terms: ['charge'] });

    // `tools/call` returns this object verbatim as the JSON-RPC result, so
    // telemetry leaking onto it would be sent to every caller.
    expect(Object.keys(result).sort()).toEqual(['content', 'structuredContent']);
    expect(JSON.stringify(result)).not.toContain('matchedTerms');
  });
});
