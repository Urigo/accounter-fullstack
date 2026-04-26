import { Fragment, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { FolderPlus } from 'lucide-react';
import { dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { Button } from '@/components/ui/button.js';
import { ScrollArea } from '@/components/ui/scroll-area.js';
import { cn } from '@/lib/utils.js';
import { TreeNodeRow } from './tree-node.js';
import { buildNodeStats, type CustomData, type FlatNode, type NodeStats } from './types.js';

interface TreePanelProps {
  treeId: 'bank' | 'report';
  title: string;
  nodes: FlatNode<CustomData>[];
  editMode: boolean;
  emptyMessage: string;
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

  return (
    <div className="flex flex-col h-full border rounded-lg bg-background overflow-scroll">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <h2 className="font-semibold text-lg">{title}</h2>
        {editMode && (
          <Button variant="outline" size="sm" onClick={onAddBranch}>
            <FolderPlus className="size-4 mr-2" />
            Add Branch
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div
          ref={panelRef}
          className={cn('min-h-[300px] transition-colors', isOver && 'bg-accent/50')}
        >
          {hasRootNodes ? (
            renderSubtree(nodes, treeId, 0, treeId, nodeStats, {
              editMode,
              onToggleExpand,
              onRename,
              onDelete,
            })
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
              {emptyMessage}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
