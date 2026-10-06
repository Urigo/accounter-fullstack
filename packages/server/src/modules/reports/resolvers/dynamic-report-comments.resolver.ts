import { GraphQLError } from 'graphql';
import type { Injector } from 'graphql-modules';
import { errorSimplifier } from '../../../shared/errors.js';
import { AdminContextProvider } from '../../admin-context/providers/admin-context.provider.js';
import { getActingUserId } from '../../auth/helpers/acting-user.helper.js';
import { BusinessUsersProvider } from '../../auth/providers/business-users.provider.js';
import {
  isCommentByUser,
  nodeKindFromDb,
  nodeKindToDb,
  validateAddCommentInput,
  validateCommentContent,
  visibleCommentContent,
} from '../helpers/dynamic-report-comments.helper.js';
import { DynamicReportCommentsProvider } from '../providers/dynamic-report-comments.provider.js';
import type { ReportsModule } from '../types.js';

/**
 * Every write records who made it, so it needs a user row behind the caller. An API key has none
 * (`getActingUserId` resolves it to null), and is refused rather than writing an anonymous message.
 */
async function requireActingUserId(injector: Injector): Promise<string> {
  const userId = await getActingUserId(injector);
  if (!userId) {
    throw new GraphQLError('Comments need a signed-in user', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
  return userId;
}

function commentNotFound(id: string): GraphQLError {
  // Deliberately one message for "missing", "already deleted" and "someone else's": the caller
  // learns nothing about messages it may not change.
  return new GraphQLError(`Comment "${id}" not found, or it is not yours to change`, {
    extensions: { code: 'NOT_FOUND' },
  });
}

/** Display name of a member of the thread's owner business; null for a user who has left it. */
async function displayName(injector: Injector, userId: string | null, businessId: string) {
  if (!userId) {
    return null;
  }
  return injector.get(BusinessUsersProvider).getUserDisplayNamesLoader.load({ userId, businessId });
}

export const dynamicReportCommentsResolver: ReportsModule.Resolvers = {
  Query: {
    dynamicReportThreads: async (_, { templateName }, { injector }) => {
      try {
        const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();

        return injector
          .get(DynamicReportCommentsProvider)
          .getThreadsByTemplate({ ownerId, templateName });
      } catch (error) {
        throw errorSimplifier(`Failed to get threads of dynamic report "${templateName}"`, error);
      }
    },
  },
  Mutation: {
    addDynamicReportComment: async (_, { input }, { injector }) => {
      try {
        const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
        const userId = await requireActingUserId(injector);
        const validated = validateAddCommentInput(input);

        // Deliberately no lock check: commenting is review activity, like Save review, and never
        // writes the template row.
        return await injector.get(DynamicReportCommentsProvider).addComment({
          thread: {
            ownerId,
            templateName: validated.templateName,
            nodeId: validated.nodeId,
            nodeKind: nodeKindToDb(validated.nodeKind),
            nodeLabel: validated.nodeLabel,
          },
          comment: {
            authorId: userId,
            content: validated.content,
            fromDate: validated.fromDate,
            toDate: validated.toDate,
            scopeOwnerId: validated.scopeOwnerId,
          },
        });
      } catch (error) {
        throw errorSimplifier(
          `Failed to add a comment to dynamic report "${input.templateName}"`,
          error,
        );
      }
    },
    editDynamicReportComment: async (_, { id, content }, { injector }) => {
      try {
        const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
        const userId = await requireActingUserId(injector);
        const validatedContent = validateCommentContent(content);

        const row = await injector
          .get(DynamicReportCommentsProvider)
          .updateCommentContent({ id, ownerId, userId, content: validatedContent });
        if (!row) {
          throw commentNotFound(id);
        }
        return row;
      } catch (error) {
        throw errorSimplifier(`Failed to edit dynamic report comment "${id}"`, error);
      }
    },
    deleteDynamicReportComment: async (_, { id }, { injector }) => {
      try {
        const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
        const userId = await requireActingUserId(injector);

        const row = await injector
          .get(DynamicReportCommentsProvider)
          .softDeleteComment({ id, ownerId, userId });
        if (!row) {
          throw commentNotFound(id);
        }
        return row;
      } catch (error) {
        throw errorSimplifier(`Failed to delete dynamic report comment "${id}"`, error);
      }
    },
    setDynamicReportThreadResolved: async (_, { threadId, resolved }, { injector }) => {
      try {
        const { ownerId } = await injector.get(AdminContextProvider).getVerifiedAdminContext();
        const userId = await requireActingUserId(injector);

        const row = await injector
          .get(DynamicReportCommentsProvider)
          .setThreadResolved({ threadId, ownerId, userId, resolved });
        if (!row) {
          throw new GraphQLError(`Thread "${threadId}" not found`, {
            extensions: { code: 'NOT_FOUND' },
          });
        }
        return row;
      } catch (error) {
        throw errorSimplifier(`Failed to update dynamic report thread "${threadId}"`, error);
      }
    },
  },
  DynamicReportThread: {
    id: thread => thread.id,
    nodeId: thread => thread.node_id,
    nodeKind: thread => nodeKindFromDb(thread.node_kind),
    nodeLabel: thread => thread.node_label,
    createdAt: thread => thread.created_at,
    resolvedAt: thread => thread.resolved_at,
    resolvedBy: (thread, _args, { injector }) =>
      thread.resolved_at ? displayName(injector, thread.resolved_by, thread.owner_id) : null,
    messages: (thread, _args, { injector }) =>
      injector.get(DynamicReportCommentsProvider).getCommentsByThreadIdLoader.load(thread.id),
  },
  DynamicReportComment: {
    id: comment => comment.id,
    content: comment => visibleCommentContent(comment),
    createdAt: comment => comment.created_at,
    editedAt: comment => comment.edited_at,
    deletedAt: comment => comment.deleted_at,
    author: (comment, _args, { injector }) =>
      displayName(injector, comment.author_id, comment.owner_id),
    isMine: async (comment, _args, { injector }) =>
      isCommentByUser(comment, await getActingUserId(injector)),
    fromDate: comment => comment.from_date,
    toDate: comment => comment.to_date,
    scopeOwnerId: comment => comment.scope_owner_id,
  },
};
