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
import { TreeNodeRow } from './tree-node.js';
import { buildNodeStats, type CustomData, type FlatNode, type NodeStats } from './types.js';

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
}

function renderSubtree(
  nodes: FlatNode<CustomData>[],
  parentId: string,
  depth: number,
  treeId: 'bank' | 'report',
  nodeStats: NodeStats,
  props: Pick<TreePanelProps, 'editMode' | 'onToggleExpand' | 'onRename' | 'onDelete'>,
): ReactElement[] {
  return nodes
    .filter(n => n.parent === parentId)
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
        />
        {node.droppable &&
          node.data.isOpen &&
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

  const nodeStats = useMemo(() => buildNodeStats(nodes), [nodes]);
  const hasRootNodes = nodes.some(n => n.parent === treeId);

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
            renderSubtree(nodes, treeId, 0, treeId, nodeStats, {
              editMode,
              onToggleExpand,
              onRename,
              onDelete,
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
