import { describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import { LIST_BUSINESS_MEMBERSHIPS_TOOL_NAME } from '../businesses.js';
import { executeRegisteredTool } from '../execute.js';
import { toolRegistry } from '../registry-instance.js';

/**
 * A declared `outputSchema` is binding: the spec says servers **MUST** provide
 * structured results that conform to it, and clients **SHOULD** validate. That
 * makes a schema which can drift from the payload worse than no schema at all —
 * it converts a working call into a client-side error.
 *
 * These tests are the reason declaring one is safe here: the schema is
 * generated from the same Zod definition the handler builds rows with, and this
 * checks that end-to-end against real tool output rather than trusting it.
 *
 * Registry-driven, so the tools that gain schemas later are covered without
 * anyone remembering to extend this file.
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

function authContext(ids: string[] = ['b1', 'b2']): McpAuthContext {
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

const declaring = toolRegistry.list().filter(tool => tool.outputSchema !== undefined);

/** Arguments and canned upstream response that drive one tool to a *success*. */
interface Fixture {
  rawArgs: Record<string, unknown>;
  upstream: unknown;
}

/**
 * Required for every tool that declares a schema — deliberately not optional.
 *
 * An earlier version of this sweep ran each tool with empty args against an
 * empty upstream and returned early on an error result, reasoning that an error
 * payload is the taxonomy shape rather than the declared one. That is true, and
 * it made the test worthless: a tool could declare a schema, fail under the
 * harness for any reason, and pass here having validated nothing.
 *
 * Declaring an `outputSchema` is opt-in and binding, so the cost of proving the
 * tool can actually produce a conforming result belongs with the declaration.
 * Adding a schema without adding a fixture fails the suite.
 */
const FIXTURES: Record<string, Fixture> = {
  [LIST_BUSINESS_MEMBERSHIPS_TOOL_NAME]: { rawArgs: {}, upstream: {} },
};

describe('declared output schemas', () => {
  it('at least one tool declares one, so the sweep below is not vacuous', () => {
    expect(declaring.map(tool => tool.name)).toContain(LIST_BUSINESS_MEMBERSHIPS_TOOL_NAME);
  });

  it('every tool declaring a schema has a fixture that exercises it', () => {
    const unfixtured = declaring.map(tool => tool.name).filter(name => !(name in FIXTURES));

    expect(
      unfixtured,
      'these tools declare an outputSchema but cannot be exercised here, so their schema would never be checked against real output',
    ).toEqual([]);
  });

  it.each(declaring.map(tool => [tool.name, tool] as const))(
    '%s produces structuredContent conforming to its declared schema',
    async (name, tool) => {
      const fixture = FIXTURES[name];
      expect(fixture, `${name} has no fixture — see FIXTURES above`).toBeDefined();

      const result = await executeRegisteredTool({
        tool,
        rawArgs: fixture!.rawArgs,
        auth: authContext(),
        correlationId: 'c',
        client: clientReturning(fixture!.upstream),
        authorization: 'Bearer t',
      });

      // The check that stops this passing vacuously: a tool that cannot reach a
      // successful result has not demonstrated anything about its schema.
      expect(
        result.isError ?? false,
        `${name} did not produce a success result, so its schema went unchecked: ${JSON.stringify(result.content)}`,
      ).toBe(false);

      const parsed = tool.outputSchema!.safeParse(result.structuredContent);
      expect(
        parsed.success ? [] : parsed.error.issues,
        `${name} returned structuredContent its own outputSchema rejects`,
      ).toEqual([]);
    },
  );

  it('advertises the schema on tools/list only for tools that declare one', () => {
    const descriptors = toolRegistry.describe();
    const canary = descriptors.find(d => d.name === LIST_BUSINESS_MEMBERSHIPS_TOOL_NAME);

    expect(canary?.outputSchema).toMatchObject({
      type: 'object',
      properties: {
        businesses: { type: 'array' },
        returnedCount: { type: 'integer' },
        totalCount: { type: 'integer' },
        truncated: { type: 'boolean' },
      },
    });

    // Absent, not `undefined` — an empty contract is worse than no contract,
    // because a client may try to validate against it.
    const undeclared = descriptors.filter(d => !declaring.some(t => t.name === d.name));
    expect(undeclared.length).toBeGreaterThan(0);
    for (const descriptor of undeclared) {
      expect(Object.keys(descriptor)).not.toContain('outputSchema');
    }
  });

  it('describes the row fields the summary line tells the model to use', () => {
    const canary = toolRegistry.describe().find(d => d.name === LIST_BUSINESS_MEMBERSHIPS_TOOL_NAME);
    const businesses = (canary?.outputSchema as { properties: { businesses: { items: unknown } } })
      .properties.businesses.items;

    expect(businesses).toMatchObject({
      type: 'object',
      properties: {
        memberBusinessId: { type: 'string' },
        role: { type: 'string' },
      },
    });
  });
});
