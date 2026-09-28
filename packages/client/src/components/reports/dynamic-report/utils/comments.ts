import { rollup } from './rollup.js';
import type { CustomData, FlatNode } from './types.js';
import type { RowVisibility } from './visibility.js';

/**
 * One message of a thread, as the DynamicReportThreads query returns it. Declared structurally so
 * these helpers don't depend on codegen; the generated query type is assignable to it.
 */
export type CommentMessage = {
  id: string;
  /** Null once the message is deleted. */
  content?: string | null;
  createdAt: Date | string;
  editedAt?: Date | string | null;
  deletedAt?: Date | string | null;
  /** The author's display name; null when the user is gone. */
  author?: string | null;
  /** Whether the viewer wrote it, and so may edit or delete it. */
  isMine: boolean;
  /** The period and owner of the view the message was written in. */
  fromDate: string;
  toDate: string;
  scopeOwnerId: string;
};

/** A node's discussion, shared by every period the template is viewed for. */
export type CommentThread = {
  id: string;
  nodeId: string;
  nodeKind: string;
  /** The node's row text when the thread was last posted to. */
  nodeLabel: string;
  createdAt: Date | string;
  resolvedAt?: Date | string | null;
  resolvedBy?: string | null;
  /** Oldest first. */
  messages: readonly CommentMessage[];
};

/** What a row needs to know about its own thread. */
export type ThreadSummary = {
  threadId: string;
  /** Not resolved. */
  isOpen: boolean;
  /** Messages that are not deleted. */
  messageCount: number;
  /** When the newest message was posted, or null for a thread with no messages. */
  lastMessageAt: Date | null;
};

/** Thread summaries keyed by node id. */
export type ThreadIndex = Map<string, ThreadSummary>;

/** A node's comment rollup: its own thread, and how many open threads its subtree holds. */
export type CommentStats = { own?: ThreadSummary; openBelow: number };

/**
 * Why a thread has no row to sit on:
 * - `hidden-in-period`: its leaf is in the template but has no ledger activity in the period on
 *   screen, so the row is hidden;
 * - `not-in-report`: its node isn't in the report (dragged back to the bank, deleted, or an unsaved
 *   branch that was discarded). It may still show as a ghost row while the diff is on.
 */
export type DetachedReason = 'hidden-in-period' | 'not-in-report';

export type DetachedThread = {
  thread: CommentThread;
  reason: DetachedReason;
  /** The node left the report since the baseline, so it still renders as a read-only ghost row. */
  isGhost: boolean;
};

/** The period and owner on screen. */
export type CommentView = { fromDate: string; toDate: string; scopeOwnerId: string };

export const MAX_COMMENT_LENGTH = 10_000;

export const COMMENTS_NEED_TEMPLATE = 'Save the template to start a discussion';

/** Summarises each thread for its row, keyed by node id. */
export function indexThreads(threads: readonly CommentThread[]): ThreadIndex {
  const index: ThreadIndex = new Map();
  for (const thread of threads) {
    const last = thread.messages.at(-1);
    index.set(thread.nodeId, {
      threadId: thread.id,
      isOpen: !thread.resolvedAt,
      messageCount: thread.messages.filter(message => !message.deletedAt).length,
      lastMessageAt: last ? new Date(last.createdAt) : null,
    });
  }
  return index;
}

/**
 * Rolls threads up the report tree in one post-order pass: each node gets its own thread (if any)
 * and the number of open threads anywhere below it. Hidden leaves are skipped, so a thread on a
 * leaf with no activity in the period doesn't light up the branches above it; it is listed under
 * "Not in report" instead.
 */
export function buildCommentStats(
  nodes: readonly FlatNode<CustomData>[],
  index: ThreadIndex,
): Map<string, CommentStats> {
  return rollup<CommentStats>(
    nodes,
    node => (node.data.isHidden ? null : { own: index.get(node.id), openBelow: 0 }),
    (acc, child) => {
      acc.openBelow += child.openBelow + (child.own?.isOpen ? 1 : 0);
      return acc;
    },
    // A branch can have a thread of its own, which seeds the fold.
    branch => ({ own: index.get(branch.id), openBelow: 0 }),
  );
}

/**
 * The threads with no visible row in the report, in the order given. A thread whose node is in the
 * report tree and rendered is attached, and left out.
 *
 * @param tree the live report tree (ghosts excluded)
 * @param ghostIds nodes that left the report since the baseline and render as ghost rows
 */
export function detachedThreads(
  threads: readonly CommentThread[],
  tree: readonly FlatNode<CustomData>[],
  ghostIds: ReadonlySet<string>,
): DetachedThread[] {
  const nodeById = new Map(tree.map(node => [node.id, node]));
  const detached: DetachedThread[] = [];
  for (const thread of threads) {
    const node = nodeById.get(thread.nodeId);
    if (node && !node.data.isHidden) continue;
    detached.push({
      thread,
      reason: node ? 'hidden-in-period' : 'not-in-report',
      isGhost: !node && ghostIds.has(thread.nodeId),
    });
  }
  return detached;
}

/**
 * The ids of a node's ancestors, nearest first, up to (not including) the tree root. Empty for a
 * top-level node or an id that isn't in `nodes`.
 */
export function ancestorIds(nodes: readonly FlatNode<CustomData>[], nodeId: string): string[] {
  const nodeById = new Map(nodes.map(node => [node.id, node]));
  const ancestors: string[] = [];
  const seen = new Set<string>([nodeId]);
  let parent = nodeById.get(nodeById.get(nodeId)?.parent ?? '');
  // `seen` guards against a malformed tree whose parent links loop.
  while (parent && !seen.has(parent.id)) {
    ancestors.push(parent.id);
    seen.add(parent.id);
    parent = nodeById.get(parent.parent);
  }
  return ancestors;
}

/** The row texts from the top of the tree down to the node's parent, for the thread header. */
export function nodePath(nodes: readonly FlatNode<CustomData>[], nodeId: string): string[] {
  const textById = new Map(nodes.map(node => [node.id, node.text]));
  return ancestorIds(nodes, nodeId)
    .reverse()
    .map(id => textById.get(id) ?? id);
}

/**
 * The overlay that reveals a node: the node and its ancestors are shown, and the ancestors open,
 * without touching any node's saved isOpen. Null for a node that isn't in `nodes`.
 */
export function revealVisibility(
  nodes: readonly FlatNode<CustomData>[],
  nodeId: string,
): RowVisibility | null {
  if (!nodes.some(node => node.id === nodeId)) return null;
  const ancestors = ancestorIds(nodes, nodeId);
  return { visibleIds: new Set([nodeId, ...ancestors]), forceOpenIds: new Set(ancestors) };
}

/**
 * The chip a message shows when it was written for another view than the one on screen: its period
 * when that differs, and its owner when that differs. Null when both match.
 *
 * @param ownerName resolves an owner id to a display name; unknown owners read "another owner"
 */
export function messagePeriodChip(
  message: Pick<CommentMessage, 'fromDate' | 'toDate' | 'scopeOwnerId'>,
  view: CommentView,
  ownerName?: (ownerId: string) => string | undefined,
): string | null {
  const periodDiffers = message.fromDate !== view.fromDate || message.toDate !== view.toDate;
  const ownerDiffers = message.scopeOwnerId !== view.scopeOwnerId;
  if (!periodDiffers && !ownerDiffers) return null;
  const parts: string[] = [];
  if (periodDiffers) parts.push(`${message.fromDate} – ${message.toDate}`);
  if (ownerDiffers) parts.push(ownerName?.(message.scopeOwnerId) ?? 'another owner');
  return parts.join(' · ');
}

/**
 * Why comments can't be used right now, or null when they can. Threads hang off a saved template,
 * so that is the only gate: not the Edit switch, the lock, a pinned baseline or loading.
 */
export function commentsDisabledReason({ hasTemplate }: { hasTemplate: boolean }): string | null {
  return hasTemplate ? null : COMMENTS_NEED_TEMPLATE;
}

export type DiscussionGroups = {
  /** Unresolved threads on a visible row. */
  open: CommentThread[];
  /** Resolved threads on a visible row. */
  resolved: CommentThread[];
  /** Threads without a visible row, open or resolved. */
  detached: DetachedThread[];
};

/** Splits threads into the Discussions list's groups, keeping their order within each. */
export function groupDiscussions(
  threads: readonly CommentThread[],
  detached: readonly DetachedThread[],
): DiscussionGroups {
  const detachedIds = new Set(detached.map(entry => entry.thread.id));
  const open: CommentThread[] = [];
  const resolved: CommentThread[] = [];
  for (const thread of threads) {
    if (detachedIds.has(thread.id)) continue;
    (thread.resolvedAt ? resolved : open).push(thread);
  }
  return { open, resolved, detached: [...detached] };
}

/** "3 open threads inside", for a branch's dot. */
export function openBelowLabel(count: number): string {
  return `${count} open ${count === 1 ? 'thread' : 'threads'} inside`;
}

/** Whether a draft can be sent: something besides whitespace, within the length limit. */
export function isSendable(content: string): boolean {
  const trimmed = content.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_COMMENT_LENGTH;
}
