import { describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import { executeRegisteredTool } from '../execute.js';
import { listTagsTool, listTaxCategoriesTool } from '../lookups.js';

function authContext(businessIds: string[]): McpAuthContext {
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
    businessIds.map(businessId => ({ businessId, roleId: 'accountant' })),
  );
}

function clientReturning(data: unknown) {
  const fetchImpl = vi.fn(
    async () => ({ ok: true, status: 200, json: async () => ({ data }) }) as unknown as Response,
  );
  return new UpstreamGraphQLClient({
    endpoint: 'http://localhost:4000/graphql',
    timeoutMs: 1000,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
}

const runTool = (
  tool: typeof listTagsTool | typeof listTaxCategoriesTool,
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
    const structured = result.structuredContent as { tags: Array<{ name: string }>; total: number };
    expect(structured.tags.map(t => t.name)).toEqual(['Banana']);
    expect(structured.total).toBe(1);
  });

  it('caps results and flags truncation', async () => {
    const result = await runTool(listTagsTool, client(), authContext(['b1']), { limit: 2 });
    const structured = result.structuredContent as { tags: unknown[]; total: number; truncated: boolean };
    expect(structured.tags).toHaveLength(2);
    expect(structured.total).toBe(3);
    expect(structured.truncated).toBe(true);
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
        { id: '1', name: 'Income', irsCode: 100, isActive: true },
        { id: '2', name: 'Assets', irsCode: null, isActive: false },
      ],
    });

  it('returns tax categories sorted by name with fields limited to the use case', async () => {
    const result = await runTool(listTaxCategoriesTool, client(), authContext(['b1']), {});
    const rows = (result.structuredContent as {
      taxCategories: Array<{ name: string; irsCode: number | null; isActive: boolean }>;
    }).taxCategories;
    expect(rows).toEqual([
      { id: '2', name: 'Assets', irsCode: null, isActive: false },
      { id: '1', name: 'Income', irsCode: 100, isActive: true },
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
