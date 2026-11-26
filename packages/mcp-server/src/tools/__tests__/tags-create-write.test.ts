import { describe, expect, it, vi } from 'vitest';
import { buildAuthContext, type McpAuthContext } from '../../auth/identity.js';
import type { AuthPrincipal } from '../../auth/token.js';
import { UpstreamGraphQLClient } from '../../upstream/graphql-client.js';
import { executeRegisteredTool } from '../execute.js';
import { createTagTool } from '../tags-write.js';

/**
 * `accounter_create_tag` wraps a mutation that returns only `true`, so what
 * matters is the reads around it: the duplicate refusal before, and finding the
 * new tag's id after.
 */

const B1 = 'aa000000-0000-4000-8000-000000000001';
const B2 = 'aa000000-0000-4000-8000-000000000002';
const T1 = 'dd000000-0000-4000-8000-000000000001';
const T2 = 'dd000000-0000-4000-8000-000000000002';

interface Tag {
  id: string;
  name: string;
  ownerId: string;
  namePath?: string[];
}

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

/** A fake upstream: `allTags` answers from `tags`, and `addTag` appends `created` to it. */
function tagsClient(tags: Tag[], created?: Tag, addTagResult: unknown = true) {
  const calls: Array<{ query: string; variables: Record<string, unknown> }> = [];
  const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string) as {
      query: string;
      variables: Record<string, unknown>;
    };
    calls.push(body);
    let data: unknown;
    if (body.query.includes('mutation McpCreateTag')) {
      if (created && addTagResult === true) tags.push(created);
      data = { addTag: addTagResult };
    } else {
      data = { allTags: [...tags] };
    }
    return { ok: true, status: 200, json: async () => ({ data }) } as unknown as Response;
  });
  const client = new UpstreamGraphQLClient({
    endpoint: 'http://localhost:4000/graphql',
    timeoutMs: 1000,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return { client, calls };
}

function run(rawArgs: unknown, client: UpstreamGraphQLClient, auth = authContext([B1])) {
  return executeRegisteredTool({
    tool: createTagTool,
    rawArgs,
    auth,
    correlationId: 'c',
    client,
    authorization: 'Bearer t',
  });
}

const mutations = (calls: Array<{ query: string }>) =>
  calls.filter(call => call.query.trimStart().startsWith('mutation'));

describe('createTagTool', () => {
  it('creates the tag and returns the id it reads back', async () => {
    const { client, calls } = tagsClient([{ id: T1, name: 'Travel', ownerId: B1 }], {
      id: T2,
      name: 'Groceries',
      ownerId: B1,
    });

    const result = await run({ name: '  Groceries ' }, client);

    expect(result.isError).toBeFalsy();
    expect(mutations(calls)).toHaveLength(1);
    expect(mutations(calls)[0]?.variables).toEqual({ name: 'Groceries' });
    expect(result.structuredContent).toMatchObject({
      ok: true,
      action: 'create_tag',
      tagId: T2,
      parentTagId: null,
      scope: { memberBusinessIds: [B1] },
      tags: [{ id: T2, name: 'Groceries', ownerId: B1, namePath: ['Groceries'] }],
    });
  });

  it('forwards the parent tag', async () => {
    const { client, calls } = tagsClient([{ id: T1, name: 'Food', ownerId: B1 }], {
      id: T2,
      name: 'Groceries',
      ownerId: B1,
      namePath: ['Food', 'Groceries'],
    });

    const result = await run({ name: 'Groceries', parentTagId: T1 }, client);

    expect(mutations(calls)[0]?.variables).toEqual({ name: 'Groceries', parentId: T1 });
    expect(result.structuredContent).toMatchObject({
      parentTagId: T1,
      tags: [{ namePath: ['Food', 'Groceries'] }],
    });
  });

  it('refuses a name the business already has, without mutating', async () => {
    const { client, calls } = tagsClient([{ id: T1, name: 'Groceries', ownerId: B1 }]);

    const result = await run({ name: 'groceries' }, client);

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.structuredContent)).toContain(T1);
    expect(mutations(calls)).toHaveLength(0);
  });

  it('does not treat another business’s tag of the same name as a duplicate', async () => {
    const { client, calls } = tagsClient([{ id: T1, name: 'Groceries', ownerId: B2 }], {
      id: T2,
      name: 'Groceries',
      ownerId: B1,
    });

    const result = await run(
      { memberBusinessId: B1, name: 'Groceries' },
      client,
      authContext([B1, B2]),
    );

    expect(result.isError).toBeFalsy();
    expect(mutations(calls)).toHaveLength(1);
    expect(result.structuredContent).toMatchObject({ tagId: T2 });
  });

  it('reports a null id when the new tag cannot be read back', async () => {
    const { client } = tagsClient([]);

    const result = await run({ name: 'Groceries' }, client);

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ ok: true, tagId: null, tags: [] });
  });

  it('fails when upstream does not confirm the creation', async () => {
    const { client } = tagsClient([], undefined, false);

    const result = await run({ name: 'Groceries' }, client);

    expect(result.isError).toBe(true);
  });

  it('rejects an empty name before any round trip', async () => {
    const { client, calls } = tagsClient([]);

    const result = await run({ name: '   ' }, client);

    expect(result.isError).toBe(true);
    expect(calls).toHaveLength(0);
  });
});
