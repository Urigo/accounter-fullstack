import { GraphQLError } from 'graphql';
import { z } from 'zod';
import type { DynamicReportNodeKind } from '../../../__generated__/types.js';
import { TIMELESS_DATE_REGEX, UUID_REGEX } from '../../../shared/constants.js';
import type { TimelessDateString } from '../../../shared/types/index.js';

/** Upper bound on a message, in UTF-16 code units after trimming. Mirrored by a DB CHECK. */
export const MAX_COMMENT_LENGTH = 10_000;

/** Upper bound on a node id. Mirrored by a DB CHECK. */
export const MAX_NODE_ID_LENGTH = 200;

/**
 * Longest row text a thread keeps as its label. The label only helps name a thread whose node has
 * left the report, so a longer one is cut rather than failing the post.
 */
export const MAX_NODE_LABEL_LENGTH = 500;

/** Same shape-only uuid check as `dynamicReportSnapshotInput`: see the note there. */
const uuidShaped = z.string().regex(UUID_REGEX, 'Invalid UUID');

const timelessDate = z
  .string()
  .regex(TIMELESS_DATE_REGEX, 'Date must be in format yyyy-mm-dd')
  .transform(date => date as TimelessDateString);

const commentContent = z
  .string()
  .trim()
  .min(1, 'Comment must not be empty')
  .max(MAX_COMMENT_LENGTH, `Comment must be at most ${MAX_COMMENT_LENGTH} characters`);

/** Cuts by code point, so a surrogate pair is never split in half. */
function capLabel(label: string): string {
  const codePoints = Array.from(label);
  return codePoints.length > MAX_NODE_LABEL_LENGTH
    ? codePoints.slice(0, MAX_NODE_LABEL_LENGTH).join('')
    : label;
}

export const addDynamicReportCommentInput = z
  .object({
    templateName: z.string().min(1, 'Template name must not be empty'),
    nodeId: z
      .string()
      .min(1, 'Node id must not be empty')
      .max(MAX_NODE_ID_LENGTH, `Node id must be at most ${MAX_NODE_ID_LENGTH} characters`),
    nodeKind: z.enum(['LEAF', 'BRANCH']),
    nodeLabel: z.string().trim().transform(capLabel),
    content: commentContent,
    fromDate: timelessDate,
    toDate: timelessDate,
    scopeOwnerId: uuidShaped,
  })
  .strict()
  .refine(({ fromDate, toDate }) => fromDate <= toDate, {
    message: 'fromDate must not be after toDate',
  });

export type AddDynamicReportCommentInputType = z.infer<typeof addDynamicReportCommentInput>;

function invalidInput(subject: string, error: z.ZodError): GraphQLError {
  return new GraphQLError(
    `Invalid ${subject}: ${error.issues.map(issue => issue.message).join('; ')}`,
    { extensions: { code: 'BAD_USER_INPUT' } },
  );
}

export function validateAddCommentInput(raw: unknown): AddDynamicReportCommentInputType {
  const validated = addDynamicReportCommentInput.safeParse(raw);
  if (!validated.success) {
    throw invalidInput('comment', validated.error);
  }
  return validated.data;
}

/** Trims and bounds edited content with the same rules a new message follows. */
export function validateCommentContent(raw: unknown): string {
  const validated = commentContent.safeParse(raw);
  if (!validated.success) {
    throw invalidInput('comment', validated.error);
  }
  return validated.data;
}

// ── Row mapping ────────────────────────────────────────────────────────────────

export type DbNodeKind = 'leaf' | 'branch';

export function nodeKindToDb(kind: DynamicReportNodeKind): DbNodeKind {
  return kind === 'LEAF' ? 'leaf' : 'branch';
}

export function nodeKindFromDb(kind: string): DynamicReportNodeKind {
  switch (kind) {
    case 'leaf':
      return 'LEAF';
    case 'branch':
      return 'BRANCH';
    default:
      // The column has a CHECK constraint, so only a schema change can land here.
      throw new Error(`Unknown dynamic report node kind "${kind}"`);
  }
}

type CommentVisibility = { content: string; deleted_at: Date | null };

/** A deleted message keeps its text in the database, but the API no longer returns it. */
export function visibleCommentContent(comment: CommentVisibility): string | null {
  return comment.deleted_at ? null : comment.content;
}

/** Whether the acting user wrote the message. A caller with no user id owns nothing. */
export function isCommentByUser(comment: { author_id: string }, userId: string | null): boolean {
  return userId !== null && comment.author_id === userId;
}
