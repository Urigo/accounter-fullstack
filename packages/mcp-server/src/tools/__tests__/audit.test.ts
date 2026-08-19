import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import { executeRegisteredTool } from '../execute.js';
import type { ToolDefinition } from '../registry.js';
import { z } from 'zod';

/**
 * The audit line for mutating tools.
 *
 * What it records is a security property, not a formatting detail: identifiers
 * are what make the line answerable after the fact ("which charges did this
 * retag?"), and payload — a document's bytes, filename, MIME type — must never
 * appear in it. Both halves are asserted here.
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
  return buildAuthContext(principal, [{ memberBusinessId: B1, roleId: 'accountant' }]);
}

const noopClient = new UpstreamGraphQLClient({
  endpoint: 'http://localhost:4000/graphql',
  timeoutMs: 1000,
  fetchImpl: (async () => {
    throw new Error('not used');
  }) as unknown as typeof fetch,
});

/** A stand-in write tool, so the assertions are about the executor, not a tool. */
function writeTool(schema: z.ZodObject): ToolDefinition {
  return {
    name: 'test_write_tool',
    description: 'd',
    inputSchema: schema,
    policy: { requiresBusinessScope: true, dataClassification: 'business', mutating: true },
    handler: () => ({ content: [{ type: 'text', text: 'ok' }] }),
  } as unknown as ToolDefinition;
}

/** Run a tool and return the parsed audit log entry, if one was emitted. */
async function auditLineFor(schema: z.ZodObject, rawArgs: unknown) {
  const lines: string[] = [];
  const spy = vi.spyOn(console, 'log').mockImplementation(line => void lines.push(String(line)));
  try {
    await executeRegisteredTool({
      tool: writeTool(schema),
      rawArgs,
      auth: authContext(),
      correlationId: 'corr-1',
      client: noopClient,
      authorization: 'Bearer t',
    });
  } finally {
    spy.mockRestore();
  }
  return lines
    .map(line => JSON.parse(line) as Record<string, unknown>)
    .find(entry => entry.audit === true);
}

afterEach(() => vi.restoreAllMocks());

describe('audit line for mutating tools', () => {
  it('records the ids touched, not merely how many', async () => {
    const entry = await auditLineFor(
      z.object({
        memberBusinessId: z.string().optional(),
        chargeIds: z.array(z.string()),
        addTagIds: z.array(z.string()).optional(),
      }),
      { chargeIds: ['c1', 'c2'], addTagIds: ['t1'] },
    );

    expect(entry).toBeDefined();
    expect(entry).toMatchObject({
      audit: true,
      tool: 'test_write_tool',
      userId: 'user-1',
      correlationId: 'corr-1',
      writeTargetBusinessId: B1,
      // The ids themselves — a bare `chargeIdsCount: 2` could not answer which
      // charges were changed.
      chargeIds: ['c1', 'c2'],
      chargeIdsCount: 2,
      addTagIds: ['t1'],
      addTagIdsCount: 1,
    });
  });

  it('records a scalar id field', async () => {
    const entry = await auditLineFor(
      z.object({ memberBusinessId: z.string().optional(), chargeId: z.string() }),
      { chargeId: 'c1' },
    );
    expect(entry).toMatchObject({ chargeId: 'c1' });
  });

  it('never logs payload — a non-id array contributes only its length', async () => {
    const entry = await auditLineFor(
      z.object({
        memberBusinessId: z.string().optional(),
        chargeId: z.string(),
        documents: z.array(
          z.object({ filename: z.string(), mimeType: z.string(), contentBase64: z.string() }),
        ),
      }),
      {
        chargeId: 'c1',
        documents: [
          { filename: 'secret.pdf', mimeType: 'application/pdf', contentBase64: 'aGVsbG8=' },
        ],
      },
    );

    expect(entry).toMatchObject({ chargeId: 'c1', documentsCount: 1 });
    expect(entry).not.toHaveProperty('documents');
    // Nothing from the payload leaks anywhere in the serialized line.
    const serialized = JSON.stringify(entry);
    for (const secret of ['secret.pdf', 'application/pdf', 'aGVsbG8=']) {
      expect(serialized).not.toContain(secret);
    }
  });

  it('bounds a very long id list and flags the truncation', async () => {
    const ids = Array.from({ length: 60 }, (_, i) => `c${i}`);
    const entry = await auditLineFor(
      z.object({ memberBusinessId: z.string().optional(), chargeIds: z.array(z.string()) }),
      { chargeIds: ids },
    );

    expect((entry?.chargeIds as string[]).length).toBe(50);
    expect(entry?.chargeIdsCount).toBe(60);
    expect(entry?.chargeIdsTruncated).toBe(true);
  });

  it('emits nothing for a non-mutating tool', async () => {
    const lines: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation(line => void lines.push(String(line)));
    await executeRegisteredTool({
      tool: {
        ...writeTool(z.object({ chargeId: z.string() })),
        policy: { requiresBusinessScope: true, dataClassification: 'business' },
      } as ToolDefinition,
      rawArgs: { chargeId: 'c1' },
      auth: authContext(),
      correlationId: 'corr-1',
      client: noopClient,
      authorization: 'Bearer t',
    });
    spy.mockRestore();

    expect(lines.map(l => JSON.parse(l) as Record<string, unknown>).some(e => e.audit)).toBe(false);
  });
});
