import { describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { BUSINESS_SCOPE_HEADER, UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import { LIST_BUSINESS_MEMBERSHIPS_TOOL_NAME } from '../businesses.js';
import { executeRegisteredTool } from '../execute.js';
import { toolRegistry } from '../registry-instance.js';
import { EXPLAIN_TERMINOLOGY_TOOL_NAME } from '../terminology.js';

/**
 * The cross-cutting guard: iterate the *production registry* rather than a
 * hand-listed set, so a tool added later cannot silently regress.
 *
 * Every registered tool that talks upstream must send `x-business-scope` with
 * the resolved ids and echo `scope.memberBusinessIds`. Asserting on the outbound HTTP
 * headers (not the context object) means a handler that hand-builds
 * `{ correlationId, authorization }` and drops the scope fails here.
 */

/**
 * The tools that legitimately make no upstream call, and so have no scope to
 * forward or echo. Membership discovery *is* the scope; the glossary is static
 * reference content with no business data at all.
 *
 * Kept as an explicit named set rather than loosening the assertion, so a *data*
 * tool that forgets to forward scope still fails — which is the whole point of
 * iterating the production registry here.
 */
const PURE_TOOLS = new Set<string>([
  LIST_BUSINESS_MEMBERSHIPS_TOOL_NAME,
  EXPLAIN_TERMINOLOGY_TOOL_NAME,
]);

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

/**
 * The document a tool sent, whether it went out as JSON (reads, and writes with
 * no files) or as a multipart form (writes carrying files, where the operation
 * travels in the `operations` part). Both encodings must be understood here, or
 * the write tools would silently skip the header assertions below.
 */
function queryFromBody(body: BodyInit | null | undefined): string {
  if (typeof body === 'string') {
    return (JSON.parse(body) as { query: string }).query;
  }
  const operations = (body as FormData).get('operations');
  return (JSON.parse(String(operations)) as { query: string }).query;
}

/** Upstream payloads keyed by the operation each tool issues. */
function dataFor(query: string): unknown {
  if (query.includes('batchUploadDocuments')) return { batchUploadDocuments: [] };
  if (query.includes('batchUpdateChargesTags')) {
    return {
      batchUpdateChargesTags: {
        __typename: 'BatchUpdateChargesTagsSuccessfulResult',
        charges: [],
      },
    };
  }
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
  if (query.includes('securityHoldings')) return { securityHoldings: [] };
  if (query.includes('securityExecutions')) {
    return { securityExecutions: { nodes: [], pageInfo: { totalPages: 0, totalRecords: 0 } } };
  }
  if (query.includes('taxCategories')) return { taxCategories: [] };
  if (query.includes('allBusinesses')) return { allBusinesses: { nodes: [] } };
  if (query.includes('transactionsForBalanceReport')) return { transactionsForBalanceReport: [] };
  return {};
}

function capturingClient() {
  const headersSeen: Array<Record<string, string>> = [];
  const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
    headersSeen.push(init.headers as Record<string, string>);
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: dataFor(queryFromBody(init.body)) }),
    } as unknown as Response;
  });
  const client = new UpstreamGraphQLClient({
    endpoint: 'http://localhost:4000/graphql',
    timeoutMs: 1000,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return { client, headersSeen };
}

/**
 * Minimal valid arguments per tool; everything else is optional.
 *
 * A `memberBusinessId` here is not just a filter — it is also what the expected
 * scope is derived from below, so narrowing a tool's args narrows its assertion
 * automatically. The write tools must pass one: a mutating policy refuses an
 * ambiguous target, and this fixture's caller belongs to two businesses.
 */
const ARGS_BY_TOOL: Record<string, unknown> = {
  accounter_balance_report: { memberBusinessId: B1, fromDate: '2026-01-01', toDate: '2026-03-01' },
  accounter_get_charges: { chargeIds: ['c1'] },
  accounter_get_transactions: { transactionIds: ['t1'] },
  accounter_get_documents: { documentIds: ['d1'] },
  accounter_update_charges_tags: {
    memberBusinessId: B1,
    chargeIds: ['c1'],
    addTagIds: ['tag-1'],
  },
  accounter_upload_documents: {
    memberBusinessId: B1,
    chargeId: 'c1',
    documents: [{ filename: 'a.pdf', mimeType: 'application/pdf', contentBase64: 'eA==' }],
  },
};

describe('registry-wide business-scope forwarding', () => {
  const tools = toolRegistry.list();

  it('has tools registered (guards against an empty-registry false pass)', () => {
    expect(tools.length).toBeGreaterThan(0);
  });

  it.each(tools.map(tool => [tool.name, tool] as const))(
    '%s forwards the resolved scope and echoes it',
    async (name, tool) => {
      const { client, headersSeen } = capturingClient();
      const args = ARGS_BY_TOOL[name] ?? {};
      const result = await executeRegisteredTool({
        tool,
        rawArgs: args,
        auth: authContext(),
        correlationId: 'c',
        client,
        authorization: 'Bearer t',
      });

      expect(result.isError, `${name} should succeed`).toBeUndefined();
      const structured = result.structuredContent as Record<string, unknown>;

      if (PURE_TOOLS.has(name)) {
        // No upstream call means there is nothing to forward and nothing to echo.
        expect(headersSeen).toHaveLength(0);
        expect(structured).not.toHaveProperty('scope');
        return;
      }

      expect(headersSeen.length, `${name} should call upstream`).toBeGreaterThan(0);
      // A tool given an explicit `memberBusinessId` narrows to it; the rest keep
      // the caller's full membership set.
      const requested = (args as { memberBusinessId?: string }).memberBusinessId;
      const expectedScope = requested ? [requested] : [B1, B2];
      for (const headers of headersSeen) {
        expect(headers[BUSINESS_SCOPE_HEADER]).toBe(expectedScope.join(','));
      }
      expect(structured.scope).toEqual({ memberBusinessIds: expectedScope });
    },
  );
});
