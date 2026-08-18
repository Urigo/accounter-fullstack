import { describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import { executeRegisteredTool } from '../execute.js';
import { MAX_TOOL_RESULT_BYTES } from '../output.js';
import type { ToolResult } from '../registry.js';
import { explainTerminologyTool, MAX_REQUESTED_TERMS } from '../terminology.js';
import { GLOSSARY } from '../terminology-data.js';

/**
 * Behavioral suite for the glossary tool, driven through the real
 * validate -> authorize -> execute pipeline rather than by calling the handler,
 * so policy and strict-input behavior are covered too.
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

function authContext(memberBusinessIds: string[]): McpAuthContext {
  return buildAuthContext(
    PRINCIPAL,
    memberBusinessIds.map(memberBusinessId => ({ memberBusinessId, roleId: 'accountant' })),
  );
}

/** A client whose fetch must never be called — the tool is pure. */
function spyingClient() {
  const fetchImpl = vi.fn(
    async () => ({ ok: true, status: 200, json: async () => ({ data: {} }) }) as unknown as Response,
  );
  const client = new UpstreamGraphQLClient({
    endpoint: 'http://localhost:4000/graphql',
    timeoutMs: 1000,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return { client, fetchImpl };
}

interface StructuredResult {
  mode?: string;
  terms?: Array<{ term: string; topic: string; summary: string; detail?: string }>;
  unmatched?: Array<{ term: string; suggestions: string[] }>;
  returnedCount?: number;
  totalCount?: number;
  truncated?: boolean;
  code?: string;
  [key: string]: unknown;
}

async function run(rawArgs: unknown, memberBusinessIds: string[] = ['b1']) {
  const { client, fetchImpl } = spyingClient();
  const result = await executeRegisteredTool({
    tool: explainTerminologyTool,
    rawArgs,
    auth: authContext(memberBusinessIds),
    correlationId: 'c',
    client,
    authorization: 'Bearer t',
  });
  return { result, fetchImpl, structured: result.structuredContent as StructuredResult };
}

function termsIn(result: ToolResult): string[] {
  return ((result.structuredContent as StructuredResult).terms ?? []).map(item => item.term);
}

describe('accounter_explain_terminology — index mode', () => {
  it('returns every term as a one-liner when called with no arguments', async () => {
    const { result, structured } = await run({});

    expect(result.isError).toBeUndefined();
    expect(structured.mode).toBe('index');
    expect(structured.totalCount).toBe(GLOSSARY.length);
    expect(structured.terms).toHaveLength(GLOSSARY.length);
    expect(structured.truncated).toBe(false);
  });

  it('omits detail in index mode so the orientation call stays cheap', async () => {
    const { structured } = await run({});

    for (const item of structured.terms ?? []) {
      expect(item.detail).toBeUndefined();
      expect(item.summary.length).toBeGreaterThan(0);
    }
  });

  it('is callable with no arguments at all (null arguments)', async () => {
    const { result, structured } = await run(undefined);

    expect(result.isError).toBeUndefined();
    expect(structured.mode).toBe('index');
  });
});

describe('accounter_explain_terminology — term lookup', () => {
  it('resolves a canonical term with full detail', async () => {
    const { structured } = await run({ terms: ['charge'] });

    expect(structured.mode).toBe('full');
    expect(structured.terms).toHaveLength(1);
    expect(structured.terms?.[0]?.term).toBe('charge');
    expect(structured.terms?.[0]?.detail).toContain('NOT a bank charge');
  });

  it('resolves an enum-token alias to its entry', async () => {
    const { result } = await run({ terms: ['INTERNAL'] });

    expect(termsIn(result)).toEqual(['internal-transfer-charge']);
  });

  it('resolves a GraphQL type name to its entry', async () => {
    const { result } = await run({ terms: ['CreditcardBankCharge'] });

    expect(termsIn(result)).toEqual(['creditcard-bank-charge']);
  });

  it('ignores case, spaces, hyphens and underscores', async () => {
    const spellings = ['value date', 'Value-Date', 'valueDate', 'VALUE_DATE'];

    for (const spelling of spellings) {
      const { result } = await run({ terms: [spelling] });
      expect(termsIn(result), spelling).toEqual(['value-date']);
    }
  });

  it('falls back to a substring match', async () => {
    const { result } = await run({ terms: ['allocation'] });

    expect(termsIn(result)).toEqual(['allocation-number']);
  });

  it('returns entries in glossary order regardless of request order', async () => {
    const { result } = await run({ terms: ['owner', 'charge'] });

    // `charge` is in the first topic block, `owner` in the last.
    expect(termsIn(result)).toEqual(['charge', 'owner']);
  });

  it('de-duplicates when several requested spellings hit one entry', async () => {
    const { result } = await run({ terms: ['INTERNAL', 'InternalTransferCharge'] });

    expect(termsIn(result)).toEqual(['internal-transfer-charge']);
  });
});

describe('accounter_explain_terminology — unmatched terms', () => {
  it('reports an unknown term without failing the call', async () => {
    const { result, structured } = await run({ terms: ['charge', 'zzzznotathing'] });

    expect(result.isError).toBeUndefined();
    expect(termsIn(result)).toEqual(['charge']);
    expect(structured.unmatched).toEqual([{ term: 'zzzznotathing', suggestions: [] }]);
  });

  it('suggests near matches by shared prefix', async () => {
    const { structured } = await run({ terms: ['chaxxxx'] });

    expect(structured.unmatched?.[0]?.term).toBe('chaxxxx');
    expect(structured.unmatched?.[0]?.suggestions.length).toBeGreaterThan(0);
    expect(structured.unmatched?.[0]?.suggestions[0]).toContain('charge');
  });

  it('tolerates trailing noise on a long term rather than giving up', async () => {
    const { result, structured } = await run({ terms: ['ledgerrr'] });

    expect(termsIn(result)).toEqual(['ledger-record']);
    expect(structured.unmatched).toEqual([]);
  });

  it('does not let a short alias match an unrelated longer word', async () => {
    // `fee` is an alias of `is-fee`; `feedback` must not resolve to it.
    const { structured } = await run({ terms: ['feedback'] });

    expect(structured.terms).toEqual([]);
    expect(structured.unmatched?.[0]?.term).toBe('feedback');
  });

  it('mentions unmatched terms in the human-readable summary', async () => {
    const { result } = await run({ terms: ['zzzznotathing'] });

    expect(result.content[0]?.text).toContain('Not found');
    expect(result.content[0]?.text).toContain('zzzznotathing');
  });
});

describe('accounter_explain_terminology — topics', () => {
  it('returns a whole topic in full', async () => {
    const { structured } = await run({ topics: ['ledger'] });

    const expected = GLOSSARY.filter(entry => entry.topic === 'ledger').map(entry => entry.term);
    expect(structured.terms?.map(item => item.term)).toEqual(expected);
    expect(structured.terms?.every(item => typeof item.detail === 'string')).toBe(true);
  });

  it('unions terms and topics without duplicating', async () => {
    const { result } = await run({ topics: ['scope'], terms: ['owner', 'charge'] });

    const scopeTerms = GLOSSARY.filter(entry => entry.topic === 'scope').map(entry => entry.term);
    expect(termsIn(result)).toEqual(['charge', ...scopeTerms]);
  });

  it('rejects an unknown topic', async () => {
    const { result, structured } = await run({ topics: ['nope'] });

    expect(result.isError).toBe(true);
    expect(structured.code).toBe('VALIDATION_ERROR');
  });
});

describe('accounter_explain_terminology — contract', () => {
  it('rejects unknown input fields', async () => {
    const { result, structured } = await run({ term: 'charge' });

    expect(result.isError).toBe(true);
    expect(structured.code).toBe('VALIDATION_ERROR');
  });

  it('rejects more terms than the cap', async () => {
    const tooMany = Array.from({ length: MAX_REQUESTED_TERMS + 1 }, () => 'charge');
    const { result, structured } = await run({ terms: tooMany });

    expect(result.isError).toBe(true);
    expect(structured.code).toBe('VALIDATION_ERROR');
  });

  it('makes no upstream call', async () => {
    const { fetchImpl } = await run({ topics: ['charge', 'ledger'] });

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not echo a business scope (there is none to echo)', async () => {
    const { structured } = await run({});

    expect(structured).not.toHaveProperty('scope');
  });

  it('works for a caller with zero memberships', async () => {
    const { result, structured } = await run({ terms: ['charge'] }, []);

    expect(result.isError).toBeUndefined();
    expect(structured.terms).toHaveLength(1);
  });

  it('fits the whole glossary in one full-detail response', async () => {
    const { result, structured } = await run({
      topics: ['charge', 'transaction', 'document', 'ledger', 'entity', 'scope'],
    });

    expect(structured.terms).toHaveLength(GLOSSARY.length);
    expect(structured.truncated).toBe(false);
    expect(Buffer.byteLength(JSON.stringify(result.structuredContent), 'utf8')).toBeLessThanOrEqual(
      MAX_TOOL_RESULT_BYTES,
    );
  });
});
