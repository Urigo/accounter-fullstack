import { GraphQLError, Kind, type ObjectTypeExtensionNode } from 'graphql';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminContextProvider } from '../../../admin-context/providers/admin-context.provider.js';
import { AuthContextProvider } from '../../../auth/providers/auth-context.provider.js';
import { BusinessUsersProvider } from '../../../auth/providers/business-users.provider.js';
import { DynamicReportCommentsProvider } from '../../providers/dynamic-report-comments.provider.js';
import commentsTypeDefs from '../../typeDefs/dynamic-report-comments.graphql.js';
import { dynamicReportCommentsResolver } from '../dynamic-report-comments.resolver.js';

const OWNER = '00000000-0000-0000-0000-0000000005a1';
const USER = '00000000-0000-4000-8000-0000000007b1';
const OTHER_USER = '00000000-0000-4000-8000-0000000007b2';
const THREAD_ID = '01900000-0000-7000-8000-000000000001';
const COMMENT_ID = '01900000-0000-7000-8000-000000000002';

type AnyResolver = (parent: unknown, args: unknown, context: unknown, info: unknown) => unknown;
const queries = dynamicReportCommentsResolver.Query as unknown as Record<string, AnyResolver>;
const mutations = dynamicReportCommentsResolver.Mutation as unknown as Record<string, AnyResolver>;
const threadFields = dynamicReportCommentsResolver.DynamicReportThread as unknown as Record<
  string,
  AnyResolver
>;
const commentFields = dynamicReportCommentsResolver.DynamicReportComment as unknown as Record<
  string,
  AnyResolver
>;

function threadRow(overrides: Record<string, unknown> = {}) {
  return {
    id: THREAD_ID,
    owner_id: OWNER,
    template_name: 'tpl',
    node_id: 'node-1',
    node_kind: 'leaf',
    node_label: 'Cash',
    resolved_at: null,
    resolved_by: null,
    created_at: new Date('2025-06-01T10:00:00Z'),
    ...overrides,
  };
}

function commentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: COMMENT_ID,
    owner_id: OWNER,
    thread_id: THREAD_ID,
    author_id: USER,
    content: 'hello',
    from_date: '2025-01-01',
    to_date: '2025-12-31',
    scope_owner_id: OWNER,
    created_at: new Date('2025-06-01T10:00:00Z'),
    edited_at: null,
    deleted_at: null,
    ...overrides,
  };
}

const validInput = {
  templateName: 'tpl',
  nodeId: 'node-1',
  nodeKind: 'LEAF',
  nodeLabel: ' Cash ',
  content: '  hello  ',
  fromDate: '2025-01-01',
  toDate: '2025-12-31',
  scopeOwnerId: OWNER,
};

let provider: {
  getThreadsByTemplate: ReturnType<typeof vi.fn>;
  addComment: ReturnType<typeof vi.fn>;
  updateCommentContent: ReturnType<typeof vi.fn>;
  softDeleteComment: ReturnType<typeof vi.fn>;
  setThreadResolved: ReturnType<typeof vi.fn>;
  getCommentsByThreadIdLoader: { load: ReturnType<typeof vi.fn> };
};
let displayNames: { load: ReturnType<typeof vi.fn> };

/** One simulated request. `userId` is what the auth context carries: a uuid, an API key id, or none. */
function context(userId: string | null) {
  const services = new Map<unknown, unknown>([
    [AdminContextProvider, { getVerifiedAdminContext: () => Promise.resolve({ ownerId: OWNER }) }],
    [
      AuthContextProvider,
      {
        getAuthContext: () =>
          Promise.resolve(userId ? { user: { userId }, tenant: { businessId: OWNER } } : null),
      },
    ],
    [DynamicReportCommentsProvider, provider],
    [BusinessUsersProvider, { getUserDisplayNamesLoader: displayNames }],
  ]);
  return { injector: { get: (token: unknown) => services.get(token) } };
}

async function rejection(promise: unknown): Promise<GraphQLError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(GraphQLError);
    return error as GraphQLError;
  }
  throw new Error('expected the resolver to reject');
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  provider = {
    getThreadsByTemplate: vi.fn().mockResolvedValue([threadRow()]),
    addComment: vi.fn().mockResolvedValue(threadRow()),
    updateCommentContent: vi.fn().mockResolvedValue(commentRow({ edited_at: new Date() })),
    softDeleteComment: vi.fn().mockResolvedValue(commentRow({ deleted_at: new Date() })),
    setThreadResolved: vi.fn().mockResolvedValue(threadRow()),
    getCommentsByThreadIdLoader: { load: vi.fn().mockResolvedValue([commentRow()]) },
  };
  displayNames = { load: vi.fn().mockResolvedValue('Ada Lovelace') };
});

describe('API-key callers (no user id) are refused every write', () => {
  const writes: [string, Record<string, unknown>][] = [
    ['addDynamicReportComment', { input: validInput }],
    ['editDynamicReportComment', { id: COMMENT_ID, content: 'x' }],
    ['deleteDynamicReportComment', { id: COMMENT_ID }],
    ['setDynamicReportThreadResolved', { threadId: THREAD_ID, resolved: true }],
  ];

  it.each(writes)('%s rejects an API key with FORBIDDEN and writes nothing', async (name, args) => {
    const error = await rejection(mutations[name]({}, args, context('api-key:abc'), {}));

    expect(error.extensions.code).toBe('FORBIDDEN');
    expect(error.message).toBe('Comments need a signed-in user');
    for (const write of [
      provider.addComment,
      provider.updateCommentContent,
      provider.softDeleteComment,
      provider.setThreadResolved,
    ]) {
      expect(write).not.toHaveBeenCalled();
    }
  });

  it.each(writes)('%s rejects a caller with no auth context with FORBIDDEN', async (name, args) => {
    const error = await rejection(mutations[name]({}, args, context(null), {}));
    expect(error.extensions.code).toBe('FORBIDDEN');
  });

  it('still lets an API key read threads', async () => {
    await expect(
      queries.dynamicReportThreads({}, { templateName: 'tpl' }, context('api-key:abc'), {}),
    ).resolves.toEqual([threadRow()]);
  });
});

describe('Query.dynamicReportThreads', () => {
  it("lists the admin context owner's threads of the template", async () => {
    await queries.dynamicReportThreads({}, { templateName: 'tpl' }, context(USER), {});
    expect(provider.getThreadsByTemplate).toHaveBeenCalledWith({
      ownerId: OWNER,
      templateName: 'tpl',
    });
  });
});

describe('Mutation.addDynamicReportComment', () => {
  it('writes the validated input as the acting user under the admin context owner', async () => {
    const result = await mutations.addDynamicReportComment(
      {},
      { input: validInput },
      context(USER),
      {},
    );

    expect(result).toEqual(threadRow());
    expect(provider.addComment).toHaveBeenCalledWith({
      thread: {
        ownerId: OWNER,
        templateName: 'tpl',
        nodeId: 'node-1',
        nodeKind: 'leaf',
        nodeLabel: 'Cash',
      },
      comment: {
        authorId: USER,
        content: 'hello',
        fromDate: '2025-01-01',
        toDate: '2025-12-31',
        scopeOwnerId: OWNER,
      },
    });
  });

  it('maps BRANCH to the branch column value', async () => {
    await mutations.addDynamicReportComment(
      {},
      { input: { ...validInput, nodeKind: 'BRANCH' } },
      context(USER),
      {},
    );
    expect(provider.addComment.mock.calls[0][0].thread.nodeKind).toBe('branch');
  });

  it('rejects invalid input with BAD_USER_INPUT before writing', async () => {
    const error = await rejection(
      mutations.addDynamicReportComment(
        {},
        { input: { ...validInput, content: '   ' } },
        context(USER),
        {},
      ),
    );
    expect(error.extensions.code).toBe('BAD_USER_INPUT');
    expect(provider.addComment).not.toHaveBeenCalled();
  });

  it('passes a provider GraphQLError (e.g. template not found) through unchanged', async () => {
    const notFound = new GraphQLError('Report template "tpl" not found', {
      extensions: { code: 'NOT_FOUND' },
    });
    provider.addComment.mockRejectedValue(notFound);

    await expect(
      mutations.addDynamicReportComment({}, { input: validInput }, context(USER), {}),
    ).rejects.toBe(notFound);
  });

  it('wraps an unexpected error in a generic message', async () => {
    provider.addComment.mockRejectedValue(new Error('connection reset'));

    const error = await rejection(
      mutations.addDynamicReportComment({}, { input: validInput }, context(USER), {}),
    );
    expect(error.message).toBe('Failed to add a comment to dynamic report "tpl"');
  });
});

describe('Mutation.editDynamicReportComment', () => {
  it('updates with trimmed content, guarded by owner and author', async () => {
    await mutations.editDynamicReportComment(
      {},
      { id: COMMENT_ID, content: ' new text ' },
      context(USER),
      {},
    );
    expect(provider.updateCommentContent).toHaveBeenCalledWith({
      id: COMMENT_ID,
      ownerId: OWNER,
      userId: USER,
      content: 'new text',
    });
  });

  it('throws NOT_FOUND when no row matched (missing, deleted, or not yours)', async () => {
    provider.updateCommentContent.mockResolvedValue(undefined);

    const error = await rejection(
      mutations.editDynamicReportComment({}, { id: COMMENT_ID, content: 'x' }, context(USER), {}),
    );
    expect(error.extensions.code).toBe('NOT_FOUND');
    expect(error.message).toMatch(/not found, or it is not yours/);
  });

  it('rejects empty content with BAD_USER_INPUT before writing', async () => {
    const error = await rejection(
      mutations.editDynamicReportComment({}, { id: COMMENT_ID, content: '' }, context(USER), {}),
    );
    expect(error.extensions.code).toBe('BAD_USER_INPUT');
    expect(provider.updateCommentContent).not.toHaveBeenCalled();
  });
});

describe('Mutation.deleteDynamicReportComment', () => {
  it('soft-deletes guarded by owner and author', async () => {
    await mutations.deleteDynamicReportComment({}, { id: COMMENT_ID }, context(USER), {});
    expect(provider.softDeleteComment).toHaveBeenCalledWith({
      id: COMMENT_ID,
      ownerId: OWNER,
      userId: USER,
    });
  });

  it('throws NOT_FOUND when no row matched', async () => {
    provider.softDeleteComment.mockResolvedValue(undefined);
    const error = await rejection(
      mutations.deleteDynamicReportComment({}, { id: COMMENT_ID }, context(USER), {}),
    );
    expect(error.extensions.code).toBe('NOT_FOUND');
  });
});

describe('Mutation.setDynamicReportThreadResolved', () => {
  it.each([true, false])('passes resolved=%s with the acting user', async resolved => {
    await mutations.setDynamicReportThreadResolved(
      {},
      { threadId: THREAD_ID, resolved },
      context(USER),
      {},
    );
    expect(provider.setThreadResolved).toHaveBeenCalledWith({
      threadId: THREAD_ID,
      ownerId: OWNER,
      userId: USER,
      resolved,
    });
  });

  it('throws NOT_FOUND for a missing thread', async () => {
    provider.setThreadResolved.mockResolvedValue(undefined);
    const error = await rejection(
      mutations.setDynamicReportThreadResolved(
        {},
        { threadId: THREAD_ID, resolved: true },
        context(USER),
        {},
      ),
    );
    expect(error.extensions.code).toBe('NOT_FOUND');
  });
});

describe('DynamicReportThread fields', () => {
  it('maps the row', async () => {
    const row = threadRow({ node_kind: 'branch' });
    const ctx = context(USER);
    expect(threadFields.id(row, {}, ctx, {})).toBe(THREAD_ID);
    expect(threadFields.nodeId(row, {}, ctx, {})).toBe('node-1');
    expect(threadFields.nodeKind(row, {}, ctx, {})).toBe('BRANCH');
    expect(threadFields.nodeLabel(row, {}, ctx, {})).toBe('Cash');
    expect(threadFields.createdAt(row, {}, ctx, {})).toEqual(row.created_at);
    expect(threadFields.resolvedAt(row, {}, ctx, {})).toBeNull();
  });

  it('resolves resolvedBy to a display name within the owner business', async () => {
    const row = threadRow({ resolved_at: new Date(), resolved_by: USER });
    await expect(threadFields.resolvedBy(row, {}, context(USER), {})).resolves.toBe('Ada Lovelace');
    expect(displayNames.load).toHaveBeenCalledWith({ userId: USER, businessId: OWNER });
  });

  it('resolvedBy is null on an open thread without a lookup', async () => {
    expect(await threadFields.resolvedBy(threadRow(), {}, context(USER), {})).toBeNull();
    expect(displayNames.load).not.toHaveBeenCalled();
  });

  it('resolvedBy is null for a user who has left the business', async () => {
    displayNames.load.mockResolvedValue(null);
    const row = threadRow({ resolved_at: new Date(), resolved_by: USER });
    await expect(threadFields.resolvedBy(row, {}, context(USER), {})).resolves.toBeNull();
  });

  it('loads messages through the loader', async () => {
    await expect(threadFields.messages(threadRow(), {}, context(USER), {})).resolves.toEqual([
      commentRow(),
    ]);
    expect(provider.getCommentsByThreadIdLoader.load).toHaveBeenCalledWith(THREAD_ID);
  });
});

describe('DynamicReportComment fields', () => {
  it('maps the row, with timeless dates', async () => {
    const row = commentRow({ edited_at: new Date('2025-06-02T00:00:00Z') });
    const ctx = context(USER);
    expect(commentFields.id(row, {}, ctx, {})).toBe(COMMENT_ID);
    expect(commentFields.content(row, {}, ctx, {})).toBe('hello');
    expect(commentFields.createdAt(row, {}, ctx, {})).toEqual(row.created_at);
    expect(commentFields.editedAt(row, {}, ctx, {})).toEqual(row.edited_at);
    expect(commentFields.deletedAt(row, {}, ctx, {})).toBeNull();
    expect(commentFields.fromDate(row, {}, ctx, {})).toBe('2025-01-01');
    expect(commentFields.toDate(row, {}, ctx, {})).toBe('2025-12-31');
    expect(commentFields.scopeOwnerId(row, {}, ctx, {})).toBe(OWNER);
  });

  it('content is null once deleted', () => {
    const row = commentRow({ deleted_at: new Date() });
    expect(commentFields.content(row, {}, context(USER), {})).toBeNull();
    expect(commentFields.deletedAt(row, {}, context(USER), {})).toEqual(row.deleted_at);
  });

  it('author resolves through the display-name loader of the owner business', async () => {
    await expect(commentFields.author(commentRow(), {}, context(USER), {})).resolves.toBe(
      'Ada Lovelace',
    );
    expect(displayNames.load).toHaveBeenCalledWith({ userId: USER, businessId: OWNER });
  });

  it('isMine is true for the author', async () => {
    await expect(commentFields.isMine(commentRow(), {}, context(USER), {})).resolves.toBe(true);
  });

  it('isMine is false for another user', async () => {
    await expect(commentFields.isMine(commentRow(), {}, context(OTHER_USER), {})).resolves.toBe(
      false,
    );
  });

  it('isMine is false for an API key', async () => {
    await expect(commentFields.isMine(commentRow(), {}, context('api-key:abc'), {})).resolves.toBe(
      false,
    );
  });
});

describe('schema', () => {
  const rootFields = commentsTypeDefs.definitions
    .filter(
      (definition): definition is ObjectTypeExtensionNode =>
        definition.kind === Kind.OBJECT_TYPE_EXTENSION,
    )
    .flatMap(definition =>
      (definition.fields ?? []).map(
        field => [`${definition.name.value}.${field.name.value}`, field] as const,
      ),
    );

  it('declares the query and the four mutations', () => {
    expect(rootFields.map(([name]) => name).sort()).toEqual([
      'Mutation.addDynamicReportComment',
      'Mutation.deleteDynamicReportComment',
      'Mutation.editDynamicReportComment',
      'Mutation.setDynamicReportThreadResolved',
      'Query.dynamicReportThreads',
    ]);
  });

  it.each(rootFields)(
    '%s requires auth and a business_owner or accountant role',
    (_name, field) => {
      const directives = new Map(
        field.directives?.map(directive => [directive.name.value, directive]),
      );
      expect(directives.has('requiresAuth')).toBe(true);
      const roles = directives.get('requiresAnyRole')?.arguments?.[0]?.value;
      expect(roles?.kind).toBe(Kind.LIST);
      expect(
        roles?.kind === Kind.LIST
          ? roles.values.map(value => (value.kind === Kind.STRING ? value.value : null))
          : null,
      ).toEqual(['business_owner', 'accountant']);
    },
  );
});
