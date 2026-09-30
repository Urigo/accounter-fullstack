import { GraphQLError } from 'graphql';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DynamicReportCommentsProvider } from '../dynamic-report-comments.provider.js';

const pgTypedRuntimeMock = vi.hoisted(() => {
  const runMocks = {
    getThreadsByTemplateRun: vi.fn(),
    getCommentsByThreadIdsRun: vi.fn(),
    upsertThreadRun: vi.fn(),
    insertCommentRun: vi.fn(),
    updateCommentContentRun: vi.fn(),
    softDeleteCommentRun: vi.fn(),
    setThreadResolvedRun: vi.fn(),
  };

  // Every statement the provider module defines, recorded at import time (before any mock reset).
  const statements: string[] = [];

  const sql = vi.fn((strings: TemplateStringsArray) => {
    const query = strings.join(' ');
    statements.push(query);

    if (query.includes('INSERT INTO accounter_schema.dynamic_report_threads')) {
      return { run: runMocks.upsertThreadRun };
    }
    if (query.includes('INSERT INTO accounter_schema.dynamic_report_comments')) {
      return { run: runMocks.insertCommentRun };
    }
    if (query.includes('SET content =')) {
      return { run: runMocks.updateCommentContentRun };
    }
    if (query.includes('SET deleted_at =')) {
      return { run: runMocks.softDeleteCommentRun };
    }
    if (query.includes('SET resolved_at =')) {
      return { run: runMocks.setThreadResolvedRun };
    }
    if (query.includes('FROM accounter_schema.dynamic_report_comments')) {
      return { run: runMocks.getCommentsByThreadIdsRun };
    }
    if (query.includes('FROM accounter_schema.dynamic_report_threads')) {
      return { run: runMocks.getThreadsByTemplateRun };
    }
    return { run: vi.fn().mockResolvedValue([]) };
  });

  return {
    runMocks,
    sql,
    statements,
    reset() {
      for (const mock of Object.values(runMocks)) {
        mock.mockReset();
      }
    },
  };
});

vi.mock('@pgtyped/runtime', () => ({
  sql: pgTypedRuntimeMock.sql,
}));

const { runMocks } = pgTypedRuntimeMock;

const threadParams = {
  ownerId: 'owner-1',
  templateName: 'tpl',
  nodeId: 'node-1',
  nodeKind: 'leaf',
  nodeLabel: 'Cash',
};
const commentParams = {
  authorId: 'user-1',
  content: 'hello',
  fromDate: '2025-01-01',
  toDate: '2025-12-31',
  scopeOwnerId: 'owner-1',
};

describe('DynamicReportCommentsProvider', () => {
  let db: { query: ReturnType<typeof vi.fn>; transaction: ReturnType<typeof vi.fn> };
  let txClient: { query: ReturnType<typeof vi.fn> };
  let provider: DynamicReportCommentsProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    pgTypedRuntimeMock.reset();
    txClient = { query: vi.fn() };
    db = {
      query: vi.fn(),
      transaction: vi.fn(async (fn: (client: unknown) => Promise<unknown>) => fn(txClient)),
    };
    provider = new DynamicReportCommentsProvider(db as never);
  });

  describe('addComment', () => {
    it('upserts the thread, then inserts the message under it, on one transaction client', async () => {
      runMocks.upsertThreadRun.mockResolvedValue([{ id: 'thread-1', owner_id: 'owner-1' }]);
      runMocks.insertCommentRun.mockResolvedValue([{ id: 'comment-1' }]);

      await expect(
        provider.addComment({ thread: threadParams, comment: commentParams }),
      ).resolves.toEqual({ id: 'thread-1', owner_id: 'owner-1' });

      expect(db.transaction).toHaveBeenCalledTimes(1);
      expect(runMocks.upsertThreadRun).toHaveBeenCalledWith(threadParams, txClient);
      expect(runMocks.insertCommentRun).toHaveBeenCalledWith(
        { ...commentParams, ownerId: 'owner-1', threadId: 'thread-1' },
        txClient,
      );
      expect(runMocks.upsertThreadRun.mock.invocationCallOrder[0]).toBeLessThan(
        runMocks.insertCommentRun.mock.invocationCallOrder[0],
      );
    });

    it('maps a template FK violation to a NOT_FOUND GraphQLError', async () => {
      runMocks.upsertThreadRun.mockRejectedValue(
        Object.assign(new Error('insert violates foreign key'), {
          code: '23503',
          constraint: 'dynamic_report_threads_template_fk',
        }),
      );

      const error = await provider
        .addComment({ thread: threadParams, comment: commentParams })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(GraphQLError);
      expect((error as GraphQLError).message).toBe('Report template "tpl" not found');
      expect((error as GraphQLError).extensions.code).toBe('NOT_FOUND');
      expect(runMocks.insertCommentRun).not.toHaveBeenCalled();
    });

    it('rethrows any other database error unchanged', async () => {
      const other = Object.assign(new Error('check violation'), {
        code: '23514',
        constraint: 'dynamic_report_comments_content_length',
      });
      runMocks.upsertThreadRun.mockResolvedValue([{ id: 'thread-1' }]);
      runMocks.insertCommentRun.mockRejectedValue(other);

      await expect(
        provider.addComment({ thread: threadParams, comment: commentParams }),
      ).rejects.toBe(other);
    });

    it("clears the thread's cached messages so the response includes the new one", async () => {
      runMocks.getCommentsByThreadIdsRun
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'comment-1', thread_id: 'thread-1' }]);
      runMocks.upsertThreadRun.mockResolvedValue([{ id: 'thread-1' }]);
      runMocks.insertCommentRun.mockResolvedValue([{ id: 'comment-1' }]);

      await expect(provider.getCommentsByThreadIdLoader.load('thread-1')).resolves.toEqual([]);
      await provider.addComment({ thread: threadParams, comment: commentParams });
      await expect(provider.getCommentsByThreadIdLoader.load('thread-1')).resolves.toEqual([
        { id: 'comment-1', thread_id: 'thread-1' },
      ]);
    });
  });

  describe('getCommentsByThreadIdLoader', () => {
    it('batches thread ids into one query and splits the rows per thread, in order', async () => {
      runMocks.getCommentsByThreadIdsRun.mockResolvedValue([
        { id: 'a1', thread_id: 'a' },
        { id: 'b1', thread_id: 'b' },
        { id: 'a2', thread_id: 'a' },
      ]);

      const [a, b, c] = await Promise.all([
        provider.getCommentsByThreadIdLoader.load('a'),
        provider.getCommentsByThreadIdLoader.load('b'),
        provider.getCommentsByThreadIdLoader.load('c'),
      ]);

      expect(runMocks.getCommentsByThreadIdsRun).toHaveBeenCalledTimes(1);
      expect(runMocks.getCommentsByThreadIdsRun).toHaveBeenCalledWith(
        { threadIds: ['a', 'b', 'c'] },
        db,
      );
      expect(a.map(row => row.id)).toEqual(['a1', 'a2']);
      expect(b.map(row => row.id)).toEqual(['b1']);
      expect(c).toEqual([]);
    });
  });

  describe.each([
    ['updateCommentContent', 'updateCommentContentRun', { content: 'new' }],
    ['softDeleteComment', 'softDeleteCommentRun', {}],
  ] as const)('%s', (method, run, extra) => {
    const params = { id: 'comment-1', ownerId: 'owner-1', userId: 'user-1', ...extra } as never;

    it('returns the updated row and clears its thread from the loader', async () => {
      runMocks.getCommentsByThreadIdsRun.mockResolvedValue([]);
      await provider.getCommentsByThreadIdLoader.load('thread-1');
      runMocks[run].mockResolvedValue([{ id: 'comment-1', thread_id: 'thread-1' }]);

      await expect(provider[method](params)).resolves.toEqual({
        id: 'comment-1',
        thread_id: 'thread-1',
      });
      expect(runMocks[run]).toHaveBeenCalledWith(params, db);

      await provider.getCommentsByThreadIdLoader.load('thread-1');
      expect(runMocks.getCommentsByThreadIdsRun).toHaveBeenCalledTimes(2);
    });

    it('returns undefined when no row matched', async () => {
      runMocks[run].mockResolvedValue([]);
      await expect(provider[method](params)).resolves.toBeUndefined();
    });
  });

  it('setThreadResolved returns the row, or undefined for a missing thread', async () => {
    const params = { threadId: 't', ownerId: 'owner-1', userId: 'user-1', resolved: true };
    runMocks.setThreadResolvedRun.mockResolvedValueOnce([{ id: 't' }]).mockResolvedValueOnce([]);

    await expect(provider.setThreadResolved(params)).resolves.toEqual({ id: 't' });
    await expect(provider.setThreadResolved(params)).resolves.toBeUndefined();
  });

  it('writes no snapshot and never touches the template', () => {
    // Every statement the provider defines is on the two comment tables: posting a message must
    // never write a snapshot (that would rebase every other leaf's diff) or the template row.
    const { statements } = pgTypedRuntimeMock;
    expect(statements).toHaveLength(7);
    for (const statement of statements) {
      expect(statement).not.toMatch(/dynamic_report_template_snapshots|dynamic_report_templates/);
    }
  });
});
