import { Fragment, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  FolderPlus,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { Button } from '@/components/ui/button.js';
import { cn } from '@/lib/utils.js';
import type { AccountantStatus } from '../../../gql/graphql.js';
import type { RowApproval } from './approval-status.js';
import type { RowDiff } from './diff-markers.js';
import { TreeNodeRow } from './tree-node.js';
import type { ApprovalStats, EffectiveApproval, ReviewVisibility } from './utils/approvals.js';
import type { ReportDiff } from './utils/diff.js';
import { buildNodeStats, type CustomData, type FlatNode, type NodeStats } from './utils/types.js';

interface TreePanelProps {
  treeId: 'bank' | 'report';
  title: string;
  nodes: FlatNode<CustomData>[];
  editMode: boolean;
  emptyMessage: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onAddBranch: () => void;
  onToggleExpand: (nodeId: string) => void;
  onRename?: (nodeId: string, currentName: string) => void;
  onDelete?: (nodeId: string) => void;
  /** Differences from the last saved baseline; absent while the diff is suspended. */
  diff?: ReportDiff | null;
  /** Entity ids with ledger activity that the baseline had never seen. */
  newEntityIds?: Set<string>;
  /** Each counted leaf's status, keyed by entity id. Report tree only. */
  leafStatuses?: Map<string, EffectiveApproval>;
  /** Approval counts per node, for branch statuses. Report tree only. */
  approvalStats?: ApprovalStats;
  /** Stages a leaf's status. Without it, leaf statuses are read-only. Report tree only. */
  onLeafApprovalChange?: (entityId: string, status: AccountantStatus) => void;
  /**
   * Stages a status for every counted leaf under a branch. Without it, branch statuses are
   * read-only. Report tree only.
   */
  onBranchApprovalChange?: (branchId: string, status: AccountantStatus) => void;
  /** Why statuses can't be changed right now; all statuses are read-only while it is set. */
  approvalsDisabledReason?: string | null;
  /**
   * Set while the Needs review filter is on: only these rows render, and the listed ancestors are
   * shown open without touching their saved isOpen. Report tree only.
   */
  reviewVisibility?: ReviewVisibility | null;
}

type RenderProps = Pick<TreePanelProps, 'editMode' | 'onToggleExpand' | 'onRename' | 'onDelete'> & {
  rowDiff: (nodeId: string) => RowDiff | undefined;
  rowApproval: (node: FlatNode<CustomData>) => RowApproval | undefined;
  ghostIds: Set<string>;
  reviewVisibility: ReviewVisibility | null;
};

/**
 * Whether a row renders under its (already rendered) parent. With the Needs review filter on, only
 * the rows it lists render, plus ghost rows under a rendered parent: a ghost is a record of what
 * left a branch, so it stays with that branch but has no place of its own at the root.
 */
function isShown(node: FlatNode<CustomData>, treeId: string, props: RenderProps): boolean {
  if (node.data.isHidden) return false;
  const { reviewVisibility, ghostIds } = props;
  if (!reviewVisibility) return true;
  if (reviewVisibility.visibleIds.has(node.id)) return true;
  return ghostIds.has(node.id) && node.parent !== treeId;
}

function renderSubtree(
  nodes: FlatNode<CustomData>[],
  parentId: string,
  depth: number,
  treeId: 'bank' | 'report',
  nodeStats: NodeStats,
  props: RenderProps,
): ReactElement[] {
  return nodes
    .filter(n => n.parent === parentId && isShown(n, treeId, props))
    .map(node => {
      const isForcedOpen = !!props.reviewVisibility?.forceOpenIds.has(node.id);
      return (
        <Fragment key={node.id}>
          <TreeNodeRow
            node={node}
            depth={depth}
            treeId={treeId}
            nodeStats={nodeStats}
            editMode={props.editMode}
            onToggleExpand={props.onToggleExpand}
            onRename={props.onRename}
            onDelete={props.onDelete}
            diff={props.rowDiff(node.id)}
            approval={props.rowApproval(node)}
            isForcedOpen={isForcedOpen}
          />
          {node.droppable &&
            // A ghost branch is a record of a removed subtree, so it always shows what it contained.
            // The Needs review filter opens a row on screen only; the saved isOpen stays as it is.
            (node.data.isOpen || isForcedOpen || props.ghostIds.has(node.id)) &&
            // Sums come from the unfiltered nodeStats, so a branch shows its full total.
            renderSubtree(nodes, node.id, depth + 1, treeId, nodeStats, props)}
        </Fragment>
      );
    });
}

export function TreePanel({
  treeId,
  title,
  nodes,
  editMode,
  emptyMessage,
  isCollapsed = false,
  onToggleCollapse,
  onAddBranch,
  onToggleExpand,
  onRename,
  onDelete,
  diff = null,
  newEntityIds,
  leafStatuses,
  approvalStats,
  onLeafApprovalChange,
  onBranchApprovalChange,
  approvalsDisabledReason = null,
  reviewVisibility = null,
}: TreePanelProps): ReactElement {
  const panelRef = useRef<HTMLDivElement>(null);
  const [isOver, setIsOver] = useState(false);

  useEffect(() => {
    const el = panelRef.current;
    if (!el || !editMode) return undefined;
    return dropTargetForElements({
      element: el,
      getData: () => ({ nodeId: treeId, treeId }),
      onDragEnter: () => setIsOver(true),
      onDragLeave: () => setIsOver(false),
      onDrop: () => setIsOver(false),
    });
  }, [editMode, treeId]);

  // Ghosts are kept out of the live stats — they no longer contribute to any total — but they need
  // their own sums to show what they used to be worth, so they get a separate pass.
  const nodeStats = useMemo(() => {
    const live = buildNodeStats(nodes);
    if (!diff?.ghosts.length) return live;
    for (const [id, stats] of buildNodeStats(diff.ghosts)) {
      live.set(id, stats);
    }
    return live;
  }, [nodes, diff]);

  const renderedNodes = useMemo(
    () => (diff?.ghosts.length ? [...nodes, ...diff.ghosts] : nodes),
    [nodes, diff],
  );

  const ghostIds = useMemo(() => new Set((diff?.ghosts ?? []).map(node => node.id)), [diff]);

  const rowDiff = useMemo(() => {
    return (nodeId: string): RowDiff | undefined => {
      if (newEntityIds?.has(nodeId)) {
        return { changes: [{ kind: 'added' }] };
      }
      const changes = diff?.byNodeId.get(nodeId);
      if (!changes) return undefined;
      return {
        changes,
        subtreeDelta: diff?.subtreeDelta.get(nodeId),
        isGhost: ghostIds.has(nodeId),
      };
    };
  }, [diff, ghostIds, newEntityIds]);

  const rowApproval = useMemo(() => {
    return (node: FlatNode<CustomData>): RowApproval | undefined => {
      // Ghost rows are records of what left the report, so they have nothing to review.
      if (treeId !== 'report' || ghostIds.has(node.id)) return undefined;
      if (node.droppable) {
        const counts = approvalStats?.get(node.id);
        if (!counts) return undefined;
        return {
          kind: 'branch',
          counts,
          onChange: onBranchApprovalChange
            ? (status: AccountantStatus) => onBranchApprovalChange(node.id, status)
            : undefined,
          disabledReason: approvalsDisabledReason,
        };
      }
      const approval = leafStatuses?.get(node.id);
      if (!approval) return undefined;
      return {
        kind: 'leaf',
        approval,
        onChange: onLeafApprovalChange
          ? (status: AccountantStatus) => onLeafApprovalChange(node.id, status)
          : undefined,
        disabledReason: approvalsDisabledReason,
      };
    };
  }, [
    treeId,
    ghostIds,
    approvalStats,
    leafStatuses,
    onLeafApprovalChange,
    onBranchApprovalChange,
    approvalsDisabledReason,
  ]);

  const renderProps: RenderProps = {
    editMode,
    onToggleExpand,
    onRename,
    onDelete,
    rowDiff,
    rowApproval,
    ghostIds,
    reviewVisibility: treeId === 'report' ? reviewVisibility : null,
  };

  const hasRootNodes = renderedNodes.some(
    n => n.parent === treeId && isShown(n, treeId, renderProps),
  );
  const hasUnfilteredRootNodes = renderedNodes.some(n => n.parent === treeId && !n.data.isHidden);
  const emptyText =
    renderProps.reviewVisibility && hasUnfilteredRootNodes ? 'Nothing needs review' : emptyMessage;

  const CollapseIcon =
    treeId === 'bank'
      ? isCollapsed
        ? PanelLeftOpen
        : PanelLeftClose
      : isCollapsed
        ? PanelRightOpen
        : PanelRightClose;

  if (isCollapsed) {
    return (
      <div className="flex flex-col h-full w-10 shrink-0 border rounded-lg bg-background overflow-hidden">
        <button
          className="flex-1 flex flex-col items-center justify-center gap-3 hover:bg-muted/50 transition-colors w-full"
          onClick={onToggleCollapse}
          title={`Expand ${title}`}
        >
          <CollapseIcon className="size-4 text-muted-foreground" />
          <span className="[writing-mode:vertical-rl] rotate-180 text-sm font-semibold text-muted-foreground select-none">
            {title}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-w-0 flex-1 border rounded-lg bg-background overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-2">
          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="sm"
              className="size-7 p-0 text-muted-foreground"
              onClick={onToggleCollapse}
              title={`Collapse ${title}`}
            >
              <CollapseIcon className="size-4" />
            </Button>
          )}
          <h2 className="font-semibold text-lg">{title}</h2>
        </div>
        {editMode && (
          <Button variant="outline" size="sm" onClick={onAddBranch}>
            <FolderPlus className="size-4 mr-2" />
            Add Branch
          </Button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <div
          ref={panelRef}
          className={cn('min-h-[300px] min-w-max transition-colors', isOver && 'bg-accent/50')}
        >
          {hasRootNodes ? (
            renderSubtree(renderedNodes, treeId, 0, treeId, nodeStats, renderProps)
          ) : (
            <div className="flex items-center justify-center h-[300px] w-full text-muted-foreground text-sm">
              {emptyText}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
