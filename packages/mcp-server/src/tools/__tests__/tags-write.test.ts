import { describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import { executeRegisteredTool } from '../execute.js';
import { updateChargesTagsTool } from '../tags-write.js';

/**
 * `accounter_update_charges_tags` is a JSON-bodied write, so what matters here
 * is the variables it sends, how it maps the result *union*, and the guards that
 * stop a pointless or ambiguous call before it reaches upstream.
 */

const B1 = 'aa000000-0000-4000-8000-000000000001';
const B2 = 'aa000000-0000-4000-8000-000000000002';
const C1 = 'cc000000-0000-4000-8000-000000000001';
const T1 = 'dd000000-0000-4000-8000-000000000001';
const T2 = 'dd000000-0000-4000-8000-000000000002';

function authContext(memberBusinessIds: string[], roleId = 'accountant'): McpAuthContext {
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
    memberBusinessIds.map(memberBusinessId => ({ memberBusinessId, roleId })),
  );
}

interface CapturedCall {
  query: string;
  variables: Record<string, unknown>;
  headers: Record<string, string>;
}

function tagsClient(payload: unknown, status = 200) {
  const captured: CapturedCall[] = [];
  const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as {
      query: string;
      variables: Record<string, unknown>;
    };
    captured.push({
      query: body.query,
      variables: body.variables,
      headers: init.headers as Record<string, string>,
    });
    return {
      ok: status < 400,
      status,
      json: async () => ({ data: { batchUpdateChargesTags: payload } }),
    } as unknown as Response;
  });
  const client = new UpstreamGraphQLClient({
    endpoint: 'http://localhost:4000/graphql',
    timeoutMs: 1000,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return { client, captured };
}

const success = (charges: Array<{ id: string; tags: Array<{ id: string; name: string }> }>) => ({
  __typename: 'BatchUpdateChargesTagsSuccessfulResult',
  charges,
});

function run(rawArgs: unknown, client: UpstreamGraphQLClient, auth = authContext([B1])) {
  return executeRegisteredTool({
    tool: updateChargesTagsTool,
    rawArgs,
    auth,
    correlationId: 'c',
    client,
    authorization: 'Bearer t',
  });
}

describe('updateChargesTagsTool — request', () => {
  it('sends a single mutation with the requested ids', async () => {
    const { client, captured } = tagsClient(success([{ id: C1, tags: [{ id: T1, name: 'food' }] }]));
    const result = await run(
      { chargeIds: [C1], addTagIds: [T1], removeTagIds: [T2] },
      client,
    );

    expect(result.isError).toBeUndefined();
    expect(captured).toHaveLength(1);
    expect(captured[0].query).toMatch(/^\s*mutation\b/);
    expect(captured[0].variables).toEqual({
      chargeIds: [C1],
      addTagIds: [T1],
      removeTagIds: [T2],
    });
  });

  it('sends null for an omitted direction rather than an empty array', async () => {
    // An empty list and "no change in this direction" are different requests
    // upstream; sending `[]` for an omitted field would assert the former.
    const { client, captured } = tagsClient(success([]));
    await run({ chargeIds: [C1], addTagIds: [T1] }, client);

    expect(captured[0].variables.removeTagIds).toBeNull();
    expect(captured[0].variables.addTagIds).toEqual([T1]);
  });

  it('forwards the resolved business scope', async () => {
    const { client, captured } = tagsClient(success([]));
    await run({ chargeIds: [C1], addTagIds: [T1] }, client);

    expect(captured[0].headers['x-business-scope']).toBe(B1);
  });
});

describe('updateChargesTagsTool — guards', () => {
  it('rejects a call that changes nothing, without a round trip', async () => {
    const { client, captured } = tagsClient(success([]));
    const result = await run({ chargeIds: [C1] }, client);

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as { code: string; message: string };
    expect(structured.code).toBe('VALIDATION_ERROR');
    expect(structured.message).toMatch(/No tag changes/);
    expect(captured).toHaveLength(0);
  });

  it('treats explicitly empty tag lists as no change', async () => {
    const { client, captured } = tagsClient(success([]));
    const result = await run({ chargeIds: [C1], addTagIds: [], removeTagIds: [] }, client);

    expect(result.isError).toBe(true);
    expect(captured).toHaveLength(0);
  });

  it('requires at least one charge', async () => {
    const { client } = tagsClient(success([]));
    const result = await run({ chargeIds: [], addTagIds: [T1] }, client);

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('VALIDATION_ERROR');
  });

  it('refuses an ambiguous write target', async () => {
    const { client, captured } = tagsClient(success([]));
    const result = await run({ chargeIds: [C1], addTagIds: [T1] }, client, authContext([B1, B2]));

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as { code: string; message: string };
    expect(structured.code).toBe('AUTHORIZATION_ERROR');
    expect(structured.message).toMatch(/exactly one business/);
    expect(captured).toHaveLength(0);
  });

  it('denies a caller holding neither required role', async () => {
    const { client } = tagsClient(success([]));
    const result = await run(
      { chargeIds: [C1], addTagIds: [T1] },
      client,
      authContext([B1], 'viewer'),
    );

    expect(result.isError).toBe(true);
    expect((result.structuredContent as { code: string }).code).toBe('AUTHORIZATION_ERROR');
  });
});

describe('updateChargesTagsTool — result mapping', () => {
  it('reports the updated charges with their resulting tags', async () => {
    const { client } = tagsClient(
      success([
        { id: C1, tags: [{ id: T1, name: 'food' }] },
        { id: 'c2', tags: [] },
      ]),
    );
    const result = await run({ chargeIds: [C1, 'c2', 'c3'], addTagIds: [T1] }, client);

    expect(result.isError).toBeUndefined();
    const structured = result.structuredContent as {
      ok: boolean;
      updatedCount: number;
      requestedCount: number;
      addedTagIds: string[];
      removedTagIds: string[];
      charges: Array<{ id: string; tags: Array<{ id: string; name: string }> }>;
    };

    expect(structured.ok).toBe(true);
    // `updatedCount` reflects what upstream actually changed; `requestedCount`
    // is what was asked for, so a shortfall is visible rather than implied.
    expect(structured.updatedCount).toBe(2);
    expect(structured.requestedCount).toBe(3);
    expect(structured.addedTagIds).toEqual([T1]);
    expect(structured.removedTagIds).toEqual([]);
    expect(structured.charges[0]).toEqual({ id: C1, tags: [{ id: T1, name: 'food' }] });
  });

  it('surfaces a CommonError from upstream as a non-retryable failure', async () => {
    const { client } = tagsClient({ __typename: 'CommonError', message: 'Charge not found' });
    const result = await run({ chargeIds: [C1], addTagIds: [T1] }, client);

    expect(result.isError).toBe(true);
    const structured = result.structuredContent as {
      code: string;
      message: string;
      retryable: boolean;
    };
    expect(structured.code).toBe('UPSTREAM_ERROR');
    expect(structured.message).toBe('Charge not found');
    // Re-sending the identical request would be refused identically.
    expect(structured.retryable).toBe(false);
  });
});
