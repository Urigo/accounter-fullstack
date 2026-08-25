import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { Metrics } from '../../observability/metrics.js';
import { RateLimiter } from '../../rate-limit/limiter.js';
import { UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import { SEARCH_CHARGES_TOOL_NAME, searchChargesTool } from '../charges.js';
import { DOCUMENT_SOURCE_COUNTER, uploadDocumentsTool } from '../documents-write.js';
import { executeRegisteredTool, TOOL_CALL_EVENT } from '../execute.js';
import { toolRegistry } from '../registry-instance.js';
import { updateChargesTagsTool } from '../tags-write.js';
import { explainTerminologyTool } from '../terminology.js';
import type { ToolDefinition, ToolResult } from '../registry.js';

/**
 * The cross-cutting guard for usage logging: iterate the *production registry*
 * rather than a hand-listed set, so a tool added later cannot silently ship
 * without a usage log line.
 *
 * This is the only record of which tool a caller reached for — every MCP call is
 * the same `POST /mcp`, so the per-request logs in `server.ts` cannot tell one
 * tool from another.
 */

const B1 = 'aa000000-0000-4000-8000-000000000001';
const B2 = 'aa000000-0000-4000-8000-000000000002';

const PRINCIPAL: AuthPrincipal = {
  subject: 'user-1',
  issuer: 'https://tenant.auth0.com/',
  audience: 'aud',
  scopes: [],
  email: null,
  expiresAt: undefined,
  claims: { sub: 'user-1' },
};

function authContext(): McpAuthContext {
  return buildAuthContext(PRINCIPAL, [
    { memberBusinessId: B1, roleId: 'business_owner' },
    { memberBusinessId: B2, roleId: 'business_owner' },
  ]);
}

/** Upstream payloads keyed by the operation each tool issues. */
function dataFor(query: string): unknown {
  if (query.includes('allCharges')) {
    return {
      allCharges: {
        nodes: [],
        pageInfo: { totalPages: 1, totalRecords: 0, currentPage: 1, pageSize: 25 },
      },
    };
  }
  if (query.includes('chargesByIDs')) return { chargesByIDs: [] };
  if (query.includes('transactionsByIDs')) return { transactionsByIDs: [] };
  if (query.includes('documentsByIds')) return { documentsByIds: [] };
  if (query.includes('allTags')) return { allTags: [] };
  if (query.includes('allClients')) return { allClients: [] };
  if (query.includes('securityHoldings')) return { securityHoldings: [] };
  if (query.includes('securityExecutions')) {
    return { securityExecutions: { nodes: [], pageInfo: { totalPages: 0, totalRecords: 0 } } };
  }
  if (query.includes('batchUpdateChargesTags')) {
    return {
      batchUpdateChargesTags: {
        __typename: 'BatchUpdateChargesTagsSuccessfulResult',
        charges: [{ id: 'c1', tags: [{ id: 't1', name: 'travel' }] }],
      },
    };
  }
  if (query.includes('batchUploadDocumentsFromUrls')) {
    return {
      batchUploadDocumentsFromUrls: [
        {
          __typename: 'UploadDocumentSuccessfulResult',
          document: { id: 'd1', documentType: 'INVOICE' },
        },
      ],
    };
  }
  if (query.includes('taxCategories')) return { taxCategories: [] };
  if (query.includes('allBusinesses')) return { allBusinesses: { nodes: [] } };
  if (query.includes('transactionsForBalanceReport')) return { transactionsForBalanceReport: [] };
  return {};
}

function client() {
  const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as { query: string };
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: dataFor(body.query) }),
    } as unknown as Response;
  });
  return new UpstreamGraphQLClient({
    endpoint: 'http://localhost:4000/graphql',
    timeoutMs: 1000,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
}

/** Minimal valid arguments per tool; everything else is optional. */
const ARGS_BY_TOOL: Record<string, unknown> = {
  accounter_balance_report: { memberBusinessId: B1, fromDate: '2026-01-01', toDate: '2026-03-01' },
  accounter_get_charges: { chargeIds: ['c1'] },
  accounter_get_transactions: { transactionIds: ['t1'] },
  accounter_get_documents: { documentIds: ['d1'] },
  // The write tools need a resolved single write target and real arguments; `{}`
  // would only ever exercise the validation-rejection path.
  accounter_update_charges_tags: { memberBusinessId: B1, chargeIds: ['c1'], addTagIds: ['t1'] },
  // The URL branch keeps this a plain JSON mutation, which is what the shared
  // fake upstream here speaks; the multipart branch has its own coverage in
  // `documents-write.test.ts`.
  accounter_upload_documents: {
    memberBusinessId: B1,
    chargeId: 'c1',
    documentUrls: ['https://example.com/invoice.pdf?token=hunter2'],
  },
};

interface UsageLine {
  event?: string;
  tool?: string;
  outcome?: string;
  userId?: string;
  correlationId?: string;
  latencyMs?: number;
  isError?: boolean;
  businessScopeSize?: number;
  [key: string]: unknown;
}

let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function usageLines(): UsageLine[] {
  return logSpy.mock.calls
    .map(call => JSON.parse(String(call[0])) as UsageLine)
    .filter(entry => entry.event === TOOL_CALL_EVENT);
}

function usageLine(): UsageLine {
  const lines = usageLines();
  expect(lines).toHaveLength(1);
  return lines[0];
}

describe('registry-wide usage logging', () => {
  const tools = toolRegistry.list();

  it('has tools registered (guards against an empty-registry false pass)', () => {
    expect(tools.length).toBeGreaterThan(0);
  });

  it.each(tools.map(tool => [tool.name, tool] as const))(
    '%s emits exactly one usage log line with the canonical fields',
    async (name, tool) => {
      await executeRegisteredTool({
        tool,
        rawArgs: ARGS_BY_TOOL[name] ?? {},
        auth: authContext(),
        correlationId: 'corr-1',
        client: client(),
        authorization: 'Bearer t',
        metrics: new Metrics(),
      });

      const line = usageLine();
      expect(line).toMatchObject({
        tool: name,
        outcome: 'success',
        userId: 'user-1',
        correlationId: 'corr-1',
        isError: false,
      });
      expect(typeof line.latencyMs).toBe('number');
    },
  );
});

describe('usage logging across outcomes', () => {
  it('logs a validation_error for rejected input', async () => {
    await executeRegisteredTool({
      tool: searchChargesTool,
      rawArgs: { notAField: 1 },
      auth: authContext(),
      correlationId: 'corr-1',
      client: client(),
    });

    expect(usageLine()).toMatchObject({
      tool: SEARCH_CHARGES_TOOL_NAME,
      outcome: 'validation_error',
      isError: true,
    });
  });

  it('logs an authorization_error for a caller with no memberships', async () => {
    await executeRegisteredTool({
      tool: searchChargesTool,
      rawArgs: {},
      auth: buildAuthContext(PRINCIPAL, []),
      correlationId: 'corr-1',
      client: client(),
    });

    expect(usageLine()).toMatchObject({
      tool: SEARCH_CHARGES_TOOL_NAME,
      outcome: 'authorization_error',
      isError: true,
    });
  });

  it('logs a rate_limited outcome once the limiter trips', async () => {
    const limiter = new RateLimiter({ windowMs: 1000, max: 1 }, () => 0);
    const params = {
      tool: searchChargesTool,
      rawArgs: {},
      auth: authContext(),
      correlationId: 'corr-1',
      client: client(),
      limiter,
    };
    await executeRegisteredTool(params);
    await executeRegisteredTool(params);

    const outcomes = usageLines().map(line => line.outcome);
    expect(outcomes).toEqual(['success', 'rate_limited']);
  });

  it('keeps the resolved scope on a rate-limited call, which ran no handler', async () => {
    // The scope is resolved before the limiter, so it is real and worth logging
    // even though nothing executed — unlike a rejection that never got that far.
    const limiter = new RateLimiter({ windowMs: 1000, max: 1 }, () => 0);
    const params = {
      tool: explainTerminologyTool,
      rawArgs: { terms: ['charge'] },
      auth: authContext(),
      correlationId: 'corr-1',
      client: client(),
      limiter,
    };
    await executeRegisteredTool(params);
    await executeRegisteredTool(params);

    const [, limited] = usageLines();
    expect(limited).toMatchObject({ outcome: 'rate_limited', businessScopeSize: 2 });
    // `observe` must not run for a call whose handler never did, or the glossary
    // would report a lookup that never happened.
    expect(limited.glossaryMode).toBeUndefined();
    expect(limited.matchedTerms).toBeUndefined();
  });

  it('omits the scope for rejections that never resolved one', async () => {
    await executeRegisteredTool({
      tool: searchChargesTool,
      rawArgs: { notAField: 1 },
      auth: authContext(),
      correlationId: 'corr-1',
      client: client(),
    });

    expect(usageLine().businessScopeSize).toBeUndefined();
  });

  it('records the resolved scope size so a narrowed call is distinguishable', async () => {
    await executeRegisteredTool({
      tool: searchChargesTool,
      rawArgs: { memberBusinessIds: [B1] },
      auth: authContext(),
      correlationId: 'corr-1',
      client: client(),
    });

    expect(usageLine().businessScopeSize).toBe(1);
  });
});

describe('observation failures', () => {
  /** A tool whose `observe` throws — telemetry must not break the call. */
  const brokenObserveTool: ToolDefinition = {
    ...searchChargesTool,
    name: 'broken_observe_tool',
    observe: (): never => {
      throw new Error('boom');
    },
  } as ToolDefinition;

  it('still returns the result and logs the call', async () => {
    const result: ToolResult = await executeRegisteredTool({
      tool: brokenObserveTool,
      rawArgs: {},
      auth: authContext(),
      correlationId: 'corr-1',
      client: client(),
    });

    expect(result.isError).toBeUndefined();
    expect(usageLine()).toMatchObject({ tool: 'broken_observe_tool', outcome: 'success' });
  });
});

/**
 * A write's usage line is not covered by the automatic `listShapeFields` path —
 * a write result has no `returnedCount`/`totalCount`/`truncated` — so what it
 * reports comes entirely from each tool's `observe` hook. These pin what that
 * hook may and may not say.
 */
describe('write tool usage logging', () => {
  const uploadArgs = {
    memberBusinessId: B1,
    chargeId: 'c1',
    documentUrls: ['https://example.com/invoice.pdf?token=hunter2'],
  };

  function runUpload(metrics = new Metrics()) {
    return executeRegisteredTool({
      tool: uploadDocumentsTool,
      rawArgs: uploadArgs,
      auth: authContext(),
      correlationId: 'corr-1',
      client: client(),
      metrics,
    });
  }

  it('reports which branch an upload took, and what actually applied', async () => {
    await runUpload();

    expect(usageLine()).toMatchObject({
      tool: 'accounter_upload_documents',
      outcome: 'success',
      documentSource: 'urls',
      requestedDocumentCount: 1,
      uploadedCount: 1,
      failedCount: 0,
    });
  });

  it('counts the upload branch, so base64 fallbacks are visible in metrics', async () => {
    const metrics = new Metrics();
    await runUpload(metrics);

    expect(metrics.snapshot().labeledTotals[DOCUMENT_SOURCE_COUNTER]).toEqual({ urls: 1 });
  });

  it('never logs the URLs themselves — a signed link carries an access token', async () => {
    await runUpload();

    expect(JSON.stringify(usageLine())).not.toContain('hunter2');
  });

  it('reports requested and updated charge counts, whose difference is the signal', async () => {
    await executeRegisteredTool({
      tool: updateChargesTagsTool,
      // Two charges asked for; the fake upstream resolves one, which is exactly
      // the stale-id case the two counts exist to expose.
      rawArgs: { memberBusinessId: B1, chargeIds: ['c1', 'c2'], addTagIds: ['t1'] },
      auth: authContext(),
      correlationId: 'corr-1',
      client: client(),
    });

    expect(usageLine()).toMatchObject({
      tool: 'accounter_update_charges_tags',
      outcome: 'success',
      requestedChargeCount: 2,
      updatedChargeCount: 1,
      addedTagCount: 1,
      removedTagCount: 0,
    });
  });
});
