import { describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import { executeRegisteredTool } from '../execute.js';
import { listBusinessesTool, listTagsTool, listTaxCategoriesTool } from '../lookups.js';

function authContext(memberBusinessIds: string[]): McpAuthContext {
  const principal: AuthPrincipal = {
    subject: 'user-1',
    issuer: 'https://tenant.auth0.com/',
    audience: 'aud',
    scopes: [],
    email: null,
    expiresAt: undefined,
    claims: { sub: 'user-1' },
  };
  return buildAuthContext(
    principal,
    memberBusinessIds.map(memberBusinessId => ({ memberBusinessId, roleId: 'accountant' })),
  );
}

function clientReturning(data: unknown, capture?: (init: RequestInit) => void) {
  const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
    capture?.(init);
    return { ok: true, status: 200, json: async () => ({ data }) } as unknown as Response;
  });
  return new UpstreamGraphQLClient({
    endpoint: 'http://localhost:4000/graphql',
    timeoutMs: 1000,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
}

const runTool = (
  tool: typeof listTagsTool | typeof listTaxCategoriesTool | typeof listBusinessesTool,
  client: UpstreamGraphQLClient,
  auth: McpAuthContext,
  rawArgs: unknown,
) => executeRegisteredTool({ tool, rawArgs, auth, correlationId: 'c', client, authorization: 'Bearer t' });

describe('listTagsTool', () => {
  const client = () =>
    clientReturning({
      allTags: [
        { id: '3', name: 'Zebra', namePath: ['Zebra'] },
        { id: '1', name: 'apple', namePath: ['apple'] },
        { id: '2', name: 'Banana', namePath: ['food', 'Banana'] },
      ],
    });

  it('returns tags sorted by name (case-insensitive), then id', async () => {
    const result = await runTool(listTagsTool, client(), authContext(['b1']), {});
    const names = (result.structuredContent as { tags: Array<{ name: string }> }).tags.map(t => t.name);
    expect(names).toEqual(['apple', 'Banana', 'Zebra']);
  });

  it('filters by nameContains (case-insensitive)', async () => {
    const result = await runTool(listTagsTool, client(), authContext(['b1']), { nameContains: 'an' });
    const structured = result.structuredContent as {
      tags: Array<{ name: string }>;
      totalCount: number;
    };
    expect(structured.tags.map(t => t.name)).toEqual(['Banana']);
    expect(structured.totalCount).toBe(1);
  });

  it('caps results and flags truncation', async () => {
    const result = await runTool(listTagsTool, client(), authContext(['b1']), { limit: 2 });
    const structured = result.structuredContent as {
      tags: unknown[];
      totalCount: number;
      truncated: boolean;
      continuation: { reason: string };
    };
    expect(structured.tags).toHaveLength(2);
    expect(structured.totalCount).toBe(3);
    expect(structured.truncated).toBe(true);
    expect(structured.continuation.reason).toBe('result_cap');
  });

  it('enforces business scope (denies a caller with no memberships)', async () => {
    const result = await runTool(listTagsTool, client(), authContext([]), {});
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('AUTHORIZATION_ERROR');
  });

  it('rejects unknown input fields', async () => {
    const result = await runTool(listTagsTool, client(), authContext(['b1']), { bogus: 1 });
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
  });
});

describe('listTaxCategoriesTool', () => {
  const client = () =>
    clientReturning({
      taxCategories: [
        {
          id: '1',
          name: 'Income',
          irsCode: 100,
          isActive: true,
          sortCode: { key: 900, name: 'Revenue' },
        },
        { id: '2', name: 'Assets', irsCode: null, isActive: false, sortCode: null },
      ],
    });

  it('returns tax categories sorted by name with fields limited to the use case', async () => {
    const result = await runTool(listTaxCategoriesTool, client(), authContext(['b1']), {});
    const rows = (
      result.structuredContent as {
        taxCategories: Array<{
          name: string;
          irsCode: number | null;
          isActive: boolean;
          sortCode: { key: number; name: string | null } | null;
        }>;
      }
    ).taxCategories;
    expect(rows).toEqual([
      { id: '2', name: 'Assets', irsCode: null, isActive: false, sortCode: null },
      {
        id: '1',
        name: 'Income',
        irsCode: 100,
        isActive: true,
        sortCode: { key: 900, name: 'Revenue' },
      },
    ]);
  });

  it('filters to active categories when activeOnly is set', async () => {
    const result = await runTool(listTaxCategoriesTool, client(), authContext(['b1']), {
      activeOnly: true,
    });
    const rows = (result.structuredContent as { taxCategories: Array<{ name: string }> }).taxCategories;
    expect(rows.map(r => r.name)).toEqual(['Income']);
  });
});

describe('listBusinessesTool', () => {
  const client = () =>
    clientReturning({
      allBusinesses: {
        nodes: [
          { id: '3', name: 'Zebra', ownerId: 'o1', isActive: true },
          { id: '1', name: 'apple', ownerId: 'o1', isActive: false },
          { id: '2', name: 'Banana', ownerId: 'o1', isActive: true },
        ],
      },
    });

  it('returns businesses sorted by name (case-insensitive), then id', async () => {
    const result = await runTool(listBusinessesTool, client(), authContext(['b1']), {});
    const names = (
      result.structuredContent as { businesses: Array<{ name: string }> }
    ).businesses.map(b => b.name);
    expect(names).toEqual(['apple', 'Banana', 'Zebra']);
  });

  it('filters by nameContains (case-insensitive)', async () => {
    const result = await runTool(listBusinessesTool, client(), authContext(['b1']), {
      nameContains: 'an',
    });
    const structured = result.structuredContent as {
      businesses: Array<{ name: string }>;
      totalCount: number;
    };
    expect(structured.businesses.map(b => b.name)).toEqual(['Banana']);
    expect(structured.totalCount).toBe(1);
  });

  it('filters to active businesses when activeOnly is set', async () => {
    const result = await runTool(listBusinessesTool, client(), authContext(['b1']), {
      activeOnly: true,
    });
    const rows = (result.structuredContent as { businesses: Array<{ name: string }> }).businesses;
    expect(rows.map(b => b.name)).toEqual(['Banana', 'Zebra']);
  });

  it('enforces business scope (denies a caller with no memberships)', async () => {
    const result = await runTool(listBusinessesTool, client(), authContext([]), {});
    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('AUTHORIZATION_ERROR');
  });

  // `allBusinesses(page:, limit:)` used to be left unset, so the directory was
  // unwalkable past `limit` rows. Pin the forwarding — including the 1-based →
  // 0-based translation, which is the easy half to get wrong.
  it('forwards limit and the 0-based page to allBusinesses', async () => {
    let sentInit: RequestInit | undefined;
    const client = clientReturning(
      {
        allBusinesses: {
          nodes: [{ id: '1', name: 'apple', ownerId: 'o1', isActive: true }],
          pageInfo: { totalPages: 4, totalRecords: 7, currentPage: 1, pageSize: 2 },
        },
      },
      init => (sentInit = init),
    );
    const result = await runTool(listBusinessesTool, client, authContext(['b1']), {
      page: 2,
      limit: 2,
    });

    const variables = (JSON.parse(sentInit!.body as string) as { variables: Record<string, unknown> })
      .variables;
    expect(variables.page).toBe(1);
    expect(variables.limit).toBe(2);

    // `totalRecords` covers the whole directory, not the page, so the model can
    // tell how much it has not seen; `pagination` is reported 1-based.
    const structured = result.structuredContent as {
      totalCount: number;
      pagination: { page: number; pageSize: number; totalPages: number; hasNextPage: boolean };
    };
    expect(structured.totalCount).toBe(7);
    expect(structured.pagination).toEqual({
      page: 2,
      pageSize: 2,
      totalPages: 4,
      hasNextPage: true,
    });
  });

  it('requests the first upstream page by default', async () => {
    let sentInit: RequestInit | undefined;
    const client = clientReturning(
      { allBusinesses: { nodes: [] } },
      init => (sentInit = init),
    );
    await runTool(listBusinessesTool, client, authContext(['b1']), {});
    const variables = (JSON.parse(sentInit!.body as string) as { variables: Record<string, unknown> })
      .variables;
    expect(variables.page).toBe(0);
  });

  it('tolerates a null allBusinesses payload', async () => {
    const result = await runTool(
      listBusinessesTool,
      clientReturning({ allBusinesses: null }),
      authContext(['b1']),
      {},
    );
    const structured = result.structuredContent as {
      businesses: unknown[];
      totalCount: number;
    };
    expect(structured.businesses).toEqual([]);
    expect(structured.totalCount).toBe(0);
  });
});

describe('lookups — business scoping', () => {
  const TAGS = { allTags: [{ id: '1', name: 'a', namePath: ['a'], ownerId: 'b2' }] };
  const TAX_CATEGORIES = {
    taxCategories: [
      { id: '1', name: 'a', ownerId: 'b2', irsCode: null, isActive: true, sortCode: null },
    ],
  };
  const BUSINESSES = {
    allBusinesses: { nodes: [{ id: '1', name: 'a', ownerId: 'b2', isActive: true }] },
  };

  it.each([
    ['accounter_list_tags', listTagsTool, TAGS, 'tags'],
    ['accounter_list_tax_categories', listTaxCategoriesTool, TAX_CATEGORIES, 'taxCategories'],
    ['accounter_list_businesses', listBusinessesTool, BUSINESSES, 'businesses'],
  ] as const)('%s narrows to a requested subset and reflects it in scope', async (
    _name,
    tool,
    data,
    itemsKey,
  ) => {
    let sentHeaders: Record<string, string> | undefined;
    const client = clientReturning(data, init => {
      sentHeaders = init.headers as Record<string, string>;
    });

    const result = await runTool(tool, client, authContext(['b1', 'b2']), {
      memberBusinessIds: ['b2'],
    });

    expect(result.isError).toBeUndefined();
    // The header is the only way these argument-less queries can be narrowed.
    expect(sentHeaders?.['x-business-scope']).toBe('b2');
    const structured = result.structuredContent as Record<string, unknown> & {
      scope: { memberBusinessIds: string[] };
    };
    expect(structured.scope).toEqual({ memberBusinessIds: ['b2'] });
    // ownerId passes straight through so rows stay attributable.
    expect((structured[itemsKey] as Array<{ ownerId?: string }>)[0]?.ownerId).toBe('b2');
  });

  it.each([
    ['accounter_list_tags', listTagsTool, TAGS],
    ['accounter_list_tax_categories', listTaxCategoriesTool, TAX_CATEGORIES],
    ['accounter_list_businesses', listBusinessesTool, BUSINESSES],
  ] as const)('%s denies ids outside the caller memberships', async (_name, tool, data) => {
    const result = await runTool(tool, clientReturning(data), authContext(['b1']), {
      memberBusinessIds: ['b9'],
    });

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('AUTHORIZATION_ERROR');
  });
});
