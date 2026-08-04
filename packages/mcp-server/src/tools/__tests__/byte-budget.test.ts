import { describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import { executeRegisteredTool } from '../execute.js';
import { listTagsTool, MAX_LOOKUP_RESULTS } from '../lookups.js';
import { MAX_TOOL_RESULT_BYTES } from '../output.js';

/**
 * Payload-size guard at the cap. Every row now carries `ownerId` (Phase 5), so a
 * full 500-row lookup is meaningfully larger than before — this pins the
 * behaviour at the boundary rather than assuming the extra field is free.
 *
 * The contract when the guard trips: whole trailing items are dropped (never
 * invalid JSON), `truncated` is true, and the continuation hint says the payload
 * size — not the result cap — is what stopped it.
 */

const B1 = 'aa000000-0000-4000-8000-000000000001';

function authContext(): McpAuthContext {
  const principal: AuthPrincipal = {
    subject: 'user-1',
    issuer: 'https://tenant.auth0.com/',
    audience: 'aud',
    scopes: [],
    email: null,
    expiresAt: undefined,
    claims: { sub: 'user-1' },
  };
  return buildAuthContext(principal, [{ businessId: B1, roleId: 'accountant' }]);
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

/** 500 owner-tagged tags with names long enough to blow the byte budget. */
function manyTags(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `tag-${String(i).padStart(4, '0')}`,
    name: `Tag ${String(i).padStart(4, '0')} ${'x'.repeat(120)}`,
    namePath: [`Tag ${String(i).padStart(4, '0')}`],
    ownerId: B1,
  }));
}

describe('payload byte budget with owner-tagged rows', () => {
  it('caps a full lookup at the byte budget, keeping valid JSON', async () => {
    const result = await executeRegisteredTool({
      tool: listTagsTool,
      rawArgs: {},
      auth: authContext(),
      correlationId: 'c',
      client: clientReturning({ allTags: manyTags(MAX_LOOKUP_RESULTS) }),
      authorization: 'Bearer t',
    });

    expect(result.isError).toBeUndefined();
    const structured = result.structuredContent as {
      tags: Array<{ id: string; ownerId: string }>;
      returnedCount: number;
      totalCount: number;
      truncated: boolean;
      continuation?: { reason: string };
    };

    expect(structured.totalCount).toBe(MAX_LOOKUP_RESULTS);
    expect(structured.truncated).toBe(true);
    expect(structured.continuation?.reason).toBe('payload_size');

    // Whole items only — the guard must never emit a half-serialized row.
    expect(structured.returnedCount).toBe(structured.tags.length);
    expect(structured.returnedCount).toBeLessThan(MAX_LOOKUP_RESULTS);
    for (const tag of structured.tags) {
      expect(tag.ownerId).toBe(B1);
    }

    // Serializable, and within the advertised budget.
    const serialized = JSON.stringify(structured);
    expect(() => JSON.parse(serialized)).not.toThrow();
    expect(serialized.length).toBeLessThanOrEqual(MAX_TOOL_RESULT_BYTES);
  });

  it('does not truncate when the row count fits the budget', async () => {
    // A full MAX_LOOKUP_RESULTS lookup no longer fits the byte budget even with
    // short names, so this pins the no-truncation contract at a count that does
    // fit. Kept below the result cap so nothing is dropped for either reason.
    const fittingRowCount = 500;
    const result = await executeRegisteredTool({
      tool: listTagsTool,
      rawArgs: {},
      auth: authContext(),
      correlationId: 'c',
      // Short names: rows well inside the budget.
      client: clientReturning({
        allTags: Array.from({ length: fittingRowCount }, (_, i) => ({
          id: `t${i}`,
          name: `n${i}`,
          namePath: [`n${i}`],
          ownerId: B1,
        })),
      }),
    });

    const structured = result.structuredContent as {
      returnedCount: number;
      truncated: boolean;
      continuation?: unknown;
    };
    expect(structured.truncated).toBe(false);
    expect(structured.returnedCount).toBe(fittingRowCount);
    expect(structured.continuation).toBeUndefined();
  });
});
