import DataLoader from 'dataloader';
import { GraphQLError } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { sql } from '@pgtyped/runtime';
import { TenantAwareDBClient } from '../../app-providers/tenant-db-client.js';
import type {
  IGetCommentsByThreadIdsQuery,
  IGetThreadsByTemplateParams,
  IGetThreadsByTemplateQuery,
  IInsertCommentParams,
  IInsertCommentQuery,
  ISetThreadResolvedParams,
  ISetThreadResolvedQuery,
  ISoftDeleteCommentParams,
  ISoftDeleteCommentQuery,
  IUpdateCommentContentParams,
  IUpdateCommentContentQuery,
  IUpsertThreadParams,
  IUpsertThreadQuery,
} from '../types.js';

const getThreadsByTemplate = sql<IGetThreadsByTemplateQuery>`
  SELECT *
  FROM accounter_schema.dynamic_report_threads
  WHERE owner_id = $ownerId! AND template_name = $templateName!
  ORDER BY created_at, id;`;

// Backed by dynamic_report_comments_thread_index. The id tie-break keeps the order total for
// messages written in the same microsecond; ids are uuidv7, so it also follows insertion.
const getCommentsByThreadIds = sql<IGetCommentsByThreadIdsQuery>`
  SELECT *
  FROM accounter_schema.dynamic_report_comments
  WHERE thread_id IN $$threadIds
  ORDER BY created_at, id;`;

// A post on an existing thread refreshes the node's label and kind, and reopens the thread: a
// reply to a resolved discussion means it is not settled any more.
const upsertThread = sql<IUpsertThreadQuery>`
  INSERT INTO accounter_schema.dynamic_report_threads
    (owner_id, template_name, node_id, node_kind, node_label)
  VALUES ($ownerId!, $templateName!, $nodeId!, $nodeKind!, $nodeLabel!)
  ON CONFLICT (owner_id, template_name, node_id) DO UPDATE
    SET node_label = EXCLUDED.node_label,
        node_kind = EXCLUDED.node_kind,
        resolved_at = NULL,
        resolved_by = NULL
  RETURNING *;`;

const insertComment = sql<IInsertCommentQuery>`
  INSERT INTO accounter_schema.dynamic_report_comments
    (owner_id, thread_id, author_id, content, from_date, to_date, scope_owner_id)
  VALUES ($ownerId!, $threadId!, $authorId!, $content!, $fromDate!, $toDate!, $scopeOwnerId!)
  RETURNING *;`;

// The author guard is part of the WHERE, so someone else's message and a missing one look the
// same to the caller: no row.
const updateCommentContent = sql<IUpdateCommentContentQuery>`
  UPDATE accounter_schema.dynamic_report_comments
  SET content = $content!,
      edited_at = clock_timestamp()
  WHERE id = $id!
    AND owner_id = $ownerId!
    AND author_id = $userId!
    AND deleted_at IS NULL
  RETURNING *;`;

const softDeleteComment = sql<ISoftDeleteCommentQuery>`
  UPDATE accounter_schema.dynamic_report_comments
  SET deleted_at = clock_timestamp()
  WHERE id = $id!
    AND owner_id = $ownerId!
    AND author_id = $userId!
    AND deleted_at IS NULL
  RETURNING *;`;

// Resolving an already resolved thread keeps its original stamp, so a repeated click (or two
// reviewers racing) doesn't rewrite who closed it. Reopening clears both columns.
const setThreadResolved = sql<ISetThreadResolvedQuery>`
  UPDATE accounter_schema.dynamic_report_threads
  SET resolved_at = CASE WHEN $resolved!::boolean THEN COALESCE(resolved_at, clock_timestamp()) END,
      resolved_by = CASE
        WHEN NOT $resolved!::boolean THEN NULL
        WHEN resolved_at IS NULL THEN $userId!::uuid
        ELSE resolved_by
      END
  WHERE id = $threadId! AND owner_id = $ownerId!
  RETURNING *;`;

const FOREIGN_KEY_VIOLATION = '23503';
const TEMPLATE_FK = 'dynamic_report_threads_template_fk';

function isTemplateFkViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const { code, constraint } = error as { code?: unknown; constraint?: unknown };
  return code === FOREIGN_KEY_VIOLATION && constraint === TEMPLATE_FK;
}

export type AddCommentParams = {
  thread: IUpsertThreadParams;
  comment: Omit<IInsertCommentParams, 'threadId' | 'ownerId'>;
};

/**
 * Comment threads on dynamic report nodes. Deliberately independent of the template and its
 * snapshots: a post takes effect immediately, on locked templates too, without a save.
 */
@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class DynamicReportCommentsProvider {
  constructor(private db: TenantAwareDBClient) {}

  public async getThreadsByTemplate(params: IGetThreadsByTemplateParams) {
    return getThreadsByTemplate.run(params, this.db);
  }

  private async batchCommentsByThreadIds(threadIds: readonly string[]) {
    const comments = await getCommentsByThreadIds.run({ threadIds }, this.db);
    // The query already orders the rows, and filtering keeps that order per thread.
    return threadIds.map(id => comments.filter(comment => comment.thread_id === id));
  }

  /** A thread's messages, oldest first. */
  public getCommentsByThreadIdLoader = new DataLoader((threadIds: readonly string[]) =>
    this.batchCommentsByThreadIds(threadIds),
  );

  /**
   * Posts a message, creating the node's thread on first use. The thread upsert and the message
   * insert share a transaction, so a failed insert never leaves a thread reopened or relabelled for
   * a message that does not exist. Resolves to the thread row.
   */
  public async addComment({ thread, comment }: AddCommentParams) {
    try {
      const row = await this.db.transaction(async client => {
        const [upserted] = await upsertThread.run(thread, client);
        await insertComment.run(
          { ...comment, ownerId: thread.ownerId, threadId: upserted.id },
          client,
        );
        return upserted;
      });
      this.getCommentsByThreadIdLoader.clear(row.id);
      return row;
    } catch (error) {
      if (isTemplateFkViolation(error)) {
        throw new GraphQLError(`Report template "${thread.templateName}" not found`, {
          extensions: { code: 'NOT_FOUND' },
        });
      }
      throw error;
    }
  }

  /** Resolves to the edited row, or undefined when there is no such live message by this user. */
  public async updateCommentContent(params: IUpdateCommentContentParams) {
    const [row] = await updateCommentContent.run(params, this.db);
    if (row) {
      this.getCommentsByThreadIdLoader.clear(row.thread_id);
    }
    return row;
  }

  /** Resolves to the deleted row, or undefined when there is no such live message by this user. */
  public async softDeleteComment(params: ISoftDeleteCommentParams) {
    const [row] = await softDeleteComment.run(params, this.db);
    if (row) {
      this.getCommentsByThreadIdLoader.clear(row.thread_id);
    }
    return row;
  }

  /** Resolves to the thread row, or undefined when the thread does not exist. */
  public async setThreadResolved(params: ISetThreadResolvedParams) {
    const [row] = await setThreadResolved.run(params, this.db);
    return row;
  }

  public clearCache() {
    this.getCommentsByThreadIdLoader.clearAll();
  }
}
