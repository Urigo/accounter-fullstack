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
import type { RowDiff } from './diff-markers.js';
import { TreeNodeRow } from './tree-node.js';
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
}

type RenderProps = Pick<TreePanelProps, 'editMode' | 'onToggleExpand' | 'onRename' | 'onDelete'> & {
  rowDiff: (nodeId: string) => RowDiff | undefined;
  ghostIds: Set<string>;
};

function renderSubtree(
  nodes: FlatNode<CustomData>[],
  parentId: string,
  depth: number,
  treeId: 'bank' | 'report',
  nodeStats: NodeStats,
  props: RenderProps,
): ReactElement[] {
  return nodes
    .filter(n => n.parent === parentId && !n.data.isHidden)
    .map(node => (
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
        />
        {node.droppable &&
          // A ghost branch is a record of a removed subtree, so it always shows what it contained.
          (node.data.isOpen || props.ghostIds.has(node.id)) &&
          renderSubtree(nodes, node.id, depth + 1, treeId, nodeStats, props)}
      </Fragment>
    ));
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

  const hasRootNodes = renderedNodes.some(n => n.parent === treeId && !n.data.isHidden);

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
            renderSubtree(renderedNodes, treeId, 0, treeId, nodeStats, {
              editMode,
              onToggleExpand,
              onRename,
              onDelete,
              rowDiff,
              ghostIds,
            })
          ) : (
            <div className="flex items-center justify-center h-[300px] w-full text-muted-foreground text-sm">
              {emptyMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
