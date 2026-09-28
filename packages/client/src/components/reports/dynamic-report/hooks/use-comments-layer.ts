import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, type CombinedError } from 'urql';
import {
  DynamicReportNodeKind,
  DynamicReportThreadsDocument,
  type DynamicReportThreadsQuery,
} from '../../../../gql/graphql.js';
import type { TimelessDateString } from '../../../../helpers/dates.js';
import { useAddDynamicReportComment } from '../../../../hooks/use-add-dynamic-report-comment.js';
import { useDeleteDynamicReportComment } from '../../../../hooks/use-delete-dynamic-report-comment.js';
import { useEditDynamicReportComment } from '../../../../hooks/use-edit-dynamic-report-comment.js';
import { useSetDynamicReportThreadResolved } from '../../../../hooks/use-set-dynamic-report-thread-resolved.js';
import type { RowComments } from '../comment-indicator.js';
import {
  buildCommentStats,
  commentsDisabledReason,
  detachedThreads,
  groupDiscussions,
  indexThreads,
  isSendable,
  nodePath,
  revealVisibility,
  type CommentStats,
  type CommentThread,
  type CommentView,
  type DetachedReason,
  type DetachedThread,
  type DiscussionGroups,
} from '../utils/comments.js';
import type { CustomData, FlatNode, Owner } from '../utils/types.js';
import { mergeVisibility, type RowVisibility } from '../utils/visibility.js';

export type ThreadData = DynamicReportThreadsQuery['dynamicReportThreads'][number];

export type CommentsLayerInput = {
  /** The saved template on screen, or null when none is loaded. Threads hang off it. */
  templateName: string | null;
  /** The live report tree (ghosts excluded). */
  reportTree: FlatNode<CustomData>[];
  /** Rows that left the report since the baseline, from the diff. */
  ghosts?: readonly FlatNode<CustomData>[];
  /** The period and owner on screen: what a new message records, and what period chips compare to. */
  fromDate: string;
  toDate: string;
  scopeOwnerId: string;
  /** For naming another owner in a period chip. */
  owners?: readonly Owner[];
  /** The Needs review overlay, which a reveal is merged into. */
  reviewVisibility: RowVisibility | null;
};

/** What the side sheet shows: one node's thread, or every discussion of the template. */
export type SheetState = { mode: 'node'; nodeId: string } | { mode: 'all' };

/** The node whose thread the sheet shows. */
export type ActiveThreadNode = {
  nodeId: string;
  /** The row text, or the thread's last known label for a node no longer in the report. */
  label: string;
  /** Row texts from the top of the tree down to the node's parent. */
  path: string[];
  thread: CommentThread | null;
  /** Set when the node has no visible row. */
  detachedReason: DetachedReason | null;
  /** Set when nothing can be posted: the node isn't in the report. */
  readOnlyReason: string | null;
};

export type CommentsLayer = {
  threads: readonly CommentThread[];
  threadsFetching: boolean;
  threadsError: CombinedError | undefined;
  /** Unresolved threads, attached or not. */
  openCount: number;
  /** Why comments are unavailable, or null. Only a missing saved template disables them. */
  disabledReason: string | null;
  commentStats: Map<string, CommentStats>;
  detached: DetachedThread[];
  groups: DiscussionGroups;
  /**
   * A report row's comments annotation: set on every row while comments are available, so each
   * reserves the slot, and undefined on every row while they are not.
   */
  rowComments: (node: FlatNode<CustomData>, isGhost: boolean) => RowComments | undefined;
  /** The Needs review overlay merged with the current reveal; pass it to the report TreePanel. */
  visibility: RowVisibility | null;
  /** The node last revealed from the Discussions list, if any. */
  revealNodeId: string | null;
  /**
   * The branches Needs review forces open, whose expand toggle stays locked; pass it to the report
   * TreePanel. A branch forced open only by the reveal keeps a working toggle.
   */
  lockedOpenIds: ReadonlySet<string>;
  /** Drops the reveal, so every branch it opened returns to its saved isOpen. */
  clearReveal: () => void;
  /**
   * Wraps the report tree's expand toggle. A click on a branch the reveal alone holds open means
   * "collapse": it ends the reveal, and flips the branch's saved isOpen only if that is open too.
   * Every other click goes straight to `toggle`.
   */
  toggleExpand: (nodeId: string, toggle: (nodeId: string) => void) => void;
  sheet: SheetState | null;
  activeNode: ActiveThreadNode | null;
  openThread: (nodeId: string) => void;
  openDiscussions: () => void;
  closeSheet: () => void;
  /** From the Discussions list: reveals the node's row (when it has one) and opens its thread. */
  selectThread: (nodeId: string) => void;
  /** The composer draft of the node in the sheet. */
  draft: string;
  setDraft: (content: string) => void;
  isSending: boolean;
  /** Set when the last post of the node in the sheet failed; the draft is kept. */
  sendError: string | null;
  isResolving: boolean;
  /** Each resolves to whether the change went through. */
  postComment: () => Promise<boolean>;
  editComment: (commentId: string, content: string) => Promise<boolean>;
  deleteComment: (commentId: string) => Promise<boolean>;
  setResolved: (resolved: boolean) => Promise<boolean>;
  view: CommentView;
  ownerName: (ownerId: string) => string | undefined;
  /** A thread's node as the report shows it now: its row text, or its last known label. */
  threadLabel: (thread: CommentThread) => string;
  /** Row texts above a thread's node, or none for a node no longer in the report. */
  threadPath: (thread: CommentThread) => string[];
};

const NO_THREADS: readonly ThreadData[] = [];
const NO_GHOSTS: readonly FlatNode<CustomData>[] = [];
const SHOW_EVERY_ROW: RowVisibility = { visibleIds: null, forceOpenIds: new Set() };
const NO_IDS: ReadonlySet<string> = new Set();

const REMOVED_SINCE_SAVE =
  'This row was removed from the report since the last save. Add it back to continue the discussion.';
const NOT_IN_REPORT =
  'This row is no longer in the report. Add it back to continue the discussion.';
const SEND_FAILED = 'Your message wasn’t sent. It is kept here so you can try again.';

/** Finds a report row by node id; ids may hold characters a CSS selector would need escaped. */
function findReportRow(nodeId: string): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>('[data-tree-id="report"][data-node-id]')].find(
    element => element.dataset['nodeId'] === nodeId,
  );
}

/**
 * The comment-threads layer: its own threads query (never the template's, so posting can't rebuild
 * the trees), the per-row rollup, detached threads, the side sheet's state, the reveal overlay, the
 * composer drafts, and the mutations. Comments are live writes: nothing here touches the dirty
 * flag, staged statuses or the scope guard.
 *
 * Sheet state, the reveal and drafts all belong to the template they were made on, and are
 * dropped on a template switch (a rename counts as one too, since threads are fetched by name).
 */
export function useCommentsLayer({
  templateName,
  reportTree,
  ghosts = NO_GHOSTS,
  fromDate,
  toDate,
  scopeOwnerId,
  owners,
  reviewVisibility,
}: CommentsLayerInput): CommentsLayer {
  const [threadsResult, refetchThreads] = useQuery({
    query: DynamicReportThreadsDocument,
    variables: { templateName: templateName ?? '' },
    pause: !templateName,
  });

  // A result for another template (or one left over from before a pause) is not this template's.
  const resultTemplate = threadsResult.operation?.variables.templateName;
  const threadsData = threadsResult.data;
  const threads = useMemo(
    () =>
      templateName && resultTemplate === templateName
        ? (threadsData?.dynamicReportThreads ?? NO_THREADS)
        : NO_THREADS,
    [templateName, resultTemplate, threadsData],
  );

  const refresh = useCallback(
    () => refetchThreads({ requestPolicy: 'network-only' }),
    [refetchThreads],
  );

  const disabledReason = commentsDisabledReason({ hasTemplate: !!templateName });

  const index = useMemo(() => indexThreads(threads), [threads]);
  const commentStats = useMemo(() => buildCommentStats(reportTree, index), [reportTree, index]);
  const ghostIds = useMemo(() => new Set(ghosts.map(node => node.id)), [ghosts]);
  const detached = useMemo(
    () => detachedThreads(threads, reportTree, ghostIds),
    [threads, reportTree, ghostIds],
  );
  const groups = useMemo(() => groupDiscussions(threads, detached), [threads, detached]);
  const openCount = useMemo(() => threads.filter(thread => !thread.resolvedAt).length, [threads]);

  const reportNodeById = useMemo(
    () => new Map(reportTree.map(node => [node.id, node])),
    [reportTree],
  );
  const ghostById = useMemo(() => new Map(ghosts.map(node => [node.id, node])), [ghosts]);
  const renderedNodes = useMemo(
    () => (ghosts.length ? [...reportTree, ...ghosts] : reportTree),
    [reportTree, ghosts],
  );

  // ── Sheet, reveal and drafts ────────────────────────────────────────────────────────────
  const [sheet, setSheet] = useState<SheetState | null>(null);
  // A fresh object per reveal, so re-selecting the same thread scrolls to it again.
  const [reveal, setReveal] = useState<{ nodeId: string } | null>(null);
  const [drafts, setDrafts] = useState<ReadonlyMap<string, string>>(() => new Map());
  const [sendErrorNodeId, setSendErrorNodeId] = useState<string | null>(null);

  // All of it belongs to the template it was made on, so a template switch drops it — during
  // render, so nothing from the previous template is ever committed alongside the new one.
  const [stateTemplate, setStateTemplate] = useState(templateName);
  if (stateTemplate !== templateName) {
    setStateTemplate(templateName);
    setSheet(null);
    setReveal(null);
    setDrafts(new Map());
    setSendErrorNodeId(null);
  }

  const writeDraft = useCallback(
    (nodeId: string, content: string) =>
      setDrafts(prev => {
        const next = new Map(prev);
        if (content) next.set(nodeId, content);
        else next.delete(nodeId);
        return next;
      }),
    [],
  );

  const openThread = useCallback((nodeId: string) => setSheet({ mode: 'node', nodeId }), []);
  const openDiscussions = useCallback(() => setSheet({ mode: 'all' }), []);
  // The reveal outlives the sheet on purpose: closing it leaves the revealed row on screen.
  const closeSheet = useCallback(() => setSheet(null), []);

  const selectThread = useCallback(
    (nodeId: string) => {
      const live = reportNodeById.get(nodeId);
      // A hidden leaf and a node gone from the report have no row to reveal; a ghost row does.
      if ((live && !live.data.isHidden) || ghostById.has(nodeId)) {
        setReveal({ nodeId });
      }
      openThread(nodeId);
    },
    [reportNodeById, ghostById, openThread],
  );

  useEffect(() => {
    if (!reveal) return;
    // The overlay has rendered the row (and opened its ancestors) by the time effects run.
    findReportRow(reveal.nodeId)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [reveal]);

  const revealOverlay = useMemo(
    () => (reveal ? revealVisibility(renderedNodes, reveal.nodeId) : null),
    [reveal, renderedNodes],
  );
  // With Needs review off every row stays shown and only the ancestors open; with it on, the
  // revealed row is added to what it shows.
  const visibility = useMemo(
    () =>
      revealOverlay
        ? mergeVisibility(reviewVisibility ?? SHOW_EVERY_ROW, revealOverlay)
        : reviewVisibility,
    [revealOverlay, reviewVisibility],
  );

  const lockedOpenIds = reviewVisibility?.forceOpenIds ?? NO_IDS;
  const clearReveal = useCallback(() => setReveal(null), []);
  const toggleExpand = useCallback(
    (nodeId: string, toggle: (nodeId: string) => void) => {
      if (revealOverlay?.forceOpenIds.has(nodeId) && !lockedOpenIds.has(nodeId)) {
        // The other ancestors just stop being forced open; their saved isOpen is never written.
        setReveal(null);
        if (reportNodeById.get(nodeId)?.data.isOpen) toggle(nodeId);
        return;
      }
      toggle(nodeId);
    },
    [revealOverlay, lockedOpenIds, reportNodeById],
  );

  // ── The node in the sheet ─────────────────────────────────────────────────────────────────
  const activeNodeId = sheet?.mode === 'node' ? sheet.nodeId : null;
  const threadByNodeId = useMemo(
    () => new Map(threads.map(thread => [thread.nodeId, thread])),
    [threads],
  );

  const activeNode = useMemo((): ActiveThreadNode | null => {
    if (!activeNodeId) return null;
    const thread = threadByNodeId.get(activeNodeId) ?? null;
    const live = reportNodeById.get(activeNodeId);
    const ghost = ghostById.get(activeNodeId);
    const node = live ?? ghost;
    let detachedReason: DetachedReason | null = null;
    if (!live) detachedReason = 'not-in-report';
    else if (live.data.isHidden) detachedReason = 'hidden-in-period';
    return {
      nodeId: activeNodeId,
      label: node?.text ?? thread?.nodeLabel ?? activeNodeId,
      path: node ? nodePath(renderedNodes, activeNodeId) : [],
      thread,
      detachedReason,
      readOnlyReason: live ? null : ghost ? REMOVED_SINCE_SAVE : NOT_IN_REPORT,
    };
  }, [activeNodeId, threadByNodeId, reportNodeById, ghostById, renderedNodes]);

  const draft = (activeNodeId && drafts.get(activeNodeId)) || '';
  const setDraft = useCallback(
    (content: string) => {
      if (activeNodeId) writeDraft(activeNodeId, content);
    },
    [activeNodeId, writeDraft],
  );

  // ── Rows ──────────────────────────────────────────────────────────────────────────────────
  const rowComments = useMemo(() => {
    return (node: FlatNode<CustomData>, isGhost: boolean): RowComments | undefined => {
      if (disabledReason) return undefined;
      const isActive = activeNodeId === node.id;
      const onOpen = () => openThread(node.id);
      if (isGhost) {
        // A ghost is a record of what left the report: it shows its thread, but can't start one.
        // Without a thread it still gets an (empty) annotation, so its slot is reserved.
        const own = index.get(node.id);
        return { own, openBelow: 0, isActive, readOnly: true, label: node.text, onOpen };
      }
      const stats = commentStats.get(node.id);
      return {
        own: stats?.own,
        openBelow: stats?.openBelow ?? 0,
        isActive,
        label: node.text,
        onOpen,
      };
    };
  }, [disabledReason, activeNodeId, openThread, index, commentStats]);

  // ── Mutations ─────────────────────────────────────────────────────────────────────────────
  const { addDynamicReportComment } = useAddDynamicReportComment();
  const { editDynamicReportComment } = useEditDynamicReportComment();
  const { deleteDynamicReportComment } = useDeleteDynamicReportComment();
  const { setDynamicReportThreadResolved } = useSetDynamicReportThreadResolved();

  // The ref blocks a second send within one render (a double Cmd+Enter); the state disables the
  // composer.
  const sendingRef = useRef(false);
  const [isSending, setIsSending] = useState(false);
  const sendError =
    sendErrorNodeId !== null && sendErrorNodeId === activeNodeId ? SEND_FAILED : null;

  const postComment = useCallback(async (): Promise<boolean> => {
    if (!templateName || !activeNodeId || sendingRef.current) return false;
    const node = reportNodeById.get(activeNodeId);
    // Only a node in the report can be posted to; the rest are read-only.
    if (!node) return false;
    const content = drafts.get(activeNodeId) ?? '';
    if (!isSendable(content)) return false;

    sendingRef.current = true;
    setIsSending(true);
    setSendErrorNodeId(null);
    try {
      const result = await addDynamicReportComment({
        input: {
          templateName,
          nodeId: node.id,
          nodeKind: node.droppable ? DynamicReportNodeKind.Branch : DynamicReportNodeKind.Leaf,
          nodeLabel: node.text,
          content: content.trim(),
          // The view on screen, so the message's period chip means something later.
          fromDate: fromDate as TimelessDateString,
          toDate: toDate as TimelessDateString,
          scopeOwnerId,
        },
      });
      if (!result) {
        setSendErrorNodeId(node.id);
        return false;
      }
      writeDraft(node.id, '');
      refresh();
      return true;
    } finally {
      sendingRef.current = false;
      setIsSending(false);
    }
  }, [
    templateName,
    activeNodeId,
    reportNodeById,
    drafts,
    addDynamicReportComment,
    fromDate,
    toDate,
    scopeOwnerId,
    writeDraft,
    refresh,
  ]);

  const editComment = useCallback(
    async (commentId: string, content: string): Promise<boolean> => {
      if (!isSendable(content)) return false;
      const result = await editDynamicReportComment({ id: commentId, content: content.trim() });
      if (!result) return false;
      refresh();
      return true;
    },
    [editDynamicReportComment, refresh],
  );

  const deleteComment = useCallback(
    async (commentId: string): Promise<boolean> => {
      const result = await deleteDynamicReportComment({ id: commentId });
      if (!result) return false;
      refresh();
      return true;
    },
    [deleteDynamicReportComment, refresh],
  );

  const [isResolving, setIsResolving] = useState(false);
  const activeThreadId = activeNode?.thread?.id;
  const setResolved = useCallback(
    async (resolved: boolean): Promise<boolean> => {
      if (!activeThreadId) return false;
      setIsResolving(true);
      try {
        const result = await setDynamicReportThreadResolved({
          threadId: activeThreadId,
          resolved,
        });
        if (!result) return false;
        refresh();
        return true;
      } finally {
        setIsResolving(false);
      }
    },
    [activeThreadId, setDynamicReportThreadResolved, refresh],
  );

  const view = useMemo(
    () => ({ fromDate, toDate, scopeOwnerId }),
    [fromDate, toDate, scopeOwnerId],
  );
  const ownerNames = useMemo(
    () => new Map((owners ?? []).map(owner => [owner.id, owner.name])),
    [owners],
  );
  const ownerName = useCallback((ownerId: string) => ownerNames.get(ownerId), [ownerNames]);

  const threadLabel = useCallback(
    (thread: CommentThread) =>
      (reportNodeById.get(thread.nodeId) ?? ghostById.get(thread.nodeId))?.text ?? thread.nodeLabel,
    [reportNodeById, ghostById],
  );
  const threadPath = useCallback(
    (thread: CommentThread) =>
      reportNodeById.has(thread.nodeId) || ghostById.has(thread.nodeId)
        ? nodePath(renderedNodes, thread.nodeId)
        : [],
    [reportNodeById, ghostById, renderedNodes],
  );

  return {
    threads,
    threadsFetching: threadsResult.fetching,
    threadsError: threadsResult.error,
    openCount,
    disabledReason,
    commentStats,
    detached,
    groups,
    rowComments,
    visibility,
    revealNodeId: reveal?.nodeId ?? null,
    lockedOpenIds,
    clearReveal,
    toggleExpand,
    sheet,
    activeNode,
    openThread,
    openDiscussions,
    closeSheet,
    selectThread,
    draft,
    setDraft,
    isSending,
    sendError,
    isResolving,
    postComment,
    editComment,
    deleteComment,
    setResolved,
    view,
    ownerName,
    threadLabel,
    threadPath,
  };
}
