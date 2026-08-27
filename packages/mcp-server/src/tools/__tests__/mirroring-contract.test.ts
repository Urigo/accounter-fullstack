import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import { listBusinessMembershipsTool } from '../businesses.js';
import { searchChargesTool } from '../charges.js';
import { getDocumentsTool } from '../document-details.js';
import { executeRegisteredTool } from '../execute.js';
import type { ToolResult } from '../registry.js';
import { toolRegistry } from '../registry-instance.js';

/**
 * Cross-tool contract: whatever a tool puts in `structuredContent` must also
 * reach the model.
 *
 * A `content` text block is the only channel a model is guaranteed to read.
 * `structuredContent` is optional for a client to surface at all — under MCP
 * 2025-06-18 it is contractually meaningful only when the tool advertises an
 * `outputSchema`, which none of these do. When the connector's client stopped
 * surfacing it, every tool went silently blind: summaries still arrived, rows
 * never did, and the entire suite stayed green because no test asserted a row
 * reached `content`. That is the hole this file exists to close.
 *
 * Driven off `toolRegistry` rather than a hand-listed set, so a tool added later
 * is covered without anyone remembering to add it here.
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

function authContext(ids: string[] = ['b1']): McpAuthContext {
  return buildAuthContext(
    PRINCIPAL,
    ids.map(memberBusinessId => ({ memberBusinessId, roleId: 'accountant' })),
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

/** Every `content` block's text, parsed where it happens to be JSON. */
function parsedContentBlocks(result: ToolResult): unknown[] {
  return result.content.flatMap(block => {
    try {
      return [JSON.parse(block.text) as unknown];
    } catch {
      return [];
    }
  });
}

describe('structured payloads are mirrored into content', () => {
  /**
   * Deliberately runs each tool with empty args and an empty upstream response.
   * The point is not to exercise a happy path per tool — it is that *whatever*
   * result comes back (rows, a validation error, an authorization error) must
   * satisfy the invariant, since `toToolErrorResult` mirrors too. That is what
   * lets this stay fixture-free and registry-driven.
   */
  it.each(toolRegistry.list().map(tool => [tool.name, tool] as const))(
    '%s mirrors its structuredContent into a content block',
    async (_name, tool) => {
      const result = await executeRegisteredTool({
        tool,
        rawArgs: {},
        auth: authContext(),
        correlationId: 'c',
        client: clientReturning({}),
        authorization: 'Bearer t',
      });

      if (result.structuredContent === undefined) {
        return; // Nothing to mirror.
      }

      expect(
        parsedContentBlocks(result),
        `${tool.name} returned structuredContent that no content block carries — a model reading this call sees only the summary line`,
      ).toContainEqual(result.structuredContent);
    },
  );

  it('covers the whole production registry, not a subset', () => {
    // Guards against the list silently emptying out (a bad import, a registry
    // that stopped registering) and the suite still reporting green.
    expect(toolRegistry.list().length).toBeGreaterThanOrEqual(17);
  });

  /**
   * Second layer, because the sweep above has a known blind spot: with an empty
   * upstream response most data tools return an *error* result, which
   * `toToolErrorResult` mirrors — so a new tool that hand-rolls an unmirrored
   * success result could still pass it.
   *
   * Closing that means checking the source: `shapeListResult` /
   * `shapeWriteResult` are the only sanctioned way to build a list or write
   * result, and both mirror. A tool assembling `content: [...]` itself has
   * stepped outside the guarantee, whether or not it remembered to mirror today.
   *
   * Matched by pattern rather than substring: prettier normalizes the spacing
   * today, but a guard against drift should not itself depend on prettier
   * having run.
   */
  it('no tool builds a result payload by hand', () => {
    const HAND_ROLLED_CONTENT = /\bcontent\s*:\s*\[/;
    const toolsDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    const offenders = readdirSync(toolsDir)
      .filter(file => file.endsWith('.ts') && file !== 'output.ts')
      .filter(file => HAND_ROLLED_CONTENT.test(readFileSync(join(toolsDir, file), 'utf8')));

    expect(
      offenders,
      'these files construct a `content` array directly instead of going through shapeListResult/shapeWriteResult, so their payload is not guaranteed to reach the model',
    ).toEqual([]);
  });
});

describe('row data actually reaches the model', () => {
  it('search_charges puts charge ids, amounts and dates in content', async () => {
    const result = await executeRegisteredTool({
      tool: searchChargesTool,
      rawArgs: {},
      auth: authContext(['b1', 'b2']),
      correlationId: 'c',
      authorization: 'Bearer t',
      client: clientReturning({
        allCharges: {
          nodes: [
            {
              id: 'CHARGE-AAA',
              ownerId: 'b1',
              userDescription: 'donation',
              owner: { id: 'b1', name: 'The Guild' },
              totalAmount: { raw: -180, formatted: '-180.00', currency: 'ILS' },
              minEventDate: '2026-03-11',
            },
          ],
          pageInfo: { totalPages: 1, totalRecords: 1, currentPage: 1, pageSize: 100 },
        },
      }),
    });

    const text = JSON.stringify(result.content);
    expect(text).toContain('CHARGE-AAA');
    expect(text).toContain('2026-03-11');
    expect(text).toContain('-180');
  });

  /**
   * The tool whose summary line instructs the model to "Pass their
   * memberBusinessId values" — which it could not do while those ids lived only
   * in `structuredContent`. Discovery that cannot be acted on breaks the scoping
   * workflow every other tool depends on.
   */
  it('list_business_memberships puts the ids its summary asks for in content', async () => {
    const result = await executeRegisteredTool({
      tool: listBusinessMembershipsTool,
      rawArgs: {},
      auth: authContext(['b1', 'b2']),
      correlationId: 'c',
      authorization: 'Bearer t',
      client: clientReturning({}),
    });

    expect(result.content[0]?.text).toContain('memberBusinessId');
    expect(JSON.stringify(result.content)).toContain('b2');
  });

  it('get_documents puts document ids in content', async () => {
    const result = await executeRegisteredTool({
      tool: getDocumentsTool,
      rawArgs: { documentIds: ['DOC-XYZ'] },
      auth: authContext(['b1', 'b2']),
      correlationId: 'c',
      authorization: 'Bearer t',
      client: clientReturning({
        documentsByIds: [{ id: 'DOC-XYZ', ownerId: 'b2', charge: { id: 'c1' } }],
      }),
    });

    expect(JSON.stringify(result.content)).toContain('DOC-XYZ');
  });
});

describe('error payloads reach the model too', () => {
  /**
   * A rejected call whose `issues` stay in `structuredContent` tells the model
   * only *that* it was wrong, never *what* to fix — so it retries the same
   * shape. The field-level issues have to be readable.
   */
  it('a validation error carries its field-level issues in content', async () => {
    const result = await executeRegisteredTool({
      tool: searchChargesTool,
      rawArgs: { pageSize: 99_999 },
      auth: authContext(['b1']),
      correlationId: 'corr-42',
      authorization: 'Bearer t',
      client: clientReturning({}),
    });

    expect(result.isError).toBe(true);
    const text = JSON.stringify(result.content);
    expect(text).toContain('corr-42');
    // The offending field must be nameable from `content` alone.
    expect(text).toContain('issues');
    expect(text).toContain('pageSize');
  });

  /**
   * The counterpart: an authorization message is deliberately sanitized and does
   * NOT echo the rejected id, so mirroring must not be read as "everything is
   * now visible". What reaches the model is exactly the payload, no more.
   */
  it('an authorization error mirrors its payload without leaking the rejected id', async () => {
    const result = await executeRegisteredTool({
      tool: searchChargesTool,
      rawArgs: { memberBusinessIds: ['not-a-member'] },
      auth: authContext(['b1']),
      correlationId: 'corr-43',
      authorization: 'Bearer t',
      client: clientReturning({}),
    });

    expect(result.isError).toBe(true);
    const text = JSON.stringify(result.content);
    expect(text).toContain('AUTHORIZATION_ERROR');
    expect(text).toContain('corr-43');
    expect(text).not.toContain('not-a-member');
  });
});
