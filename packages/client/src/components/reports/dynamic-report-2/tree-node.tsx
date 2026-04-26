import { useEffect, useRef, useState, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  GripVertical,
  MoreHorizontal,
  PanelTopClose,
  PanelTopOpen,
  User,
} from 'lucide-react';
import {
  attachInstruction,
  extractInstruction,
} from '@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item';
import type { Instruction } from '@atlaskit/pragmatic-drag-and-drop-hitbox/tree-item';
import {
  draggable,
  dropTargetForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { pointerOutsideOfPreview } from '@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview';
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.js';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip.js';
import { cn } from '@/lib/utils.js';
import { BusinessExtendedInfo } from '../../business-ledger/business-extended-info.js';
import type { DragPayload } from './cross-tree-drop.js';
import { DragOverlayContent } from './drag-overlay.js';
import {
  formatCurrency,
  isBranchNode,
  type CustomData,
  type FlatNode,
  type NodeStats,
} from './types.js';

interface TreeNodeProps {
  node: FlatNode<CustomData>;
  depth: number;
  treeId: 'bank' | 'report';
  nodeStats: NodeStats;
  editMode: boolean;
  onToggleExpand: (nodeId: string) => void;
  onRename?: (nodeId: string, currentName: string) => void;
  onDelete?: (nodeId: string) => void;
}

function instructionToIndicator(
  instruction: Instruction | null,
): 'top' | 'bottom' | 'child' | null {
  if (!instruction || instruction.type === 'instruction-blocked') return null;
  if (instruction.type === 'reorder-above') return 'top';
  if (instruction.type === 'reorder-below' || instruction.type === 'reparent') return 'bottom';
  if (instruction.type === 'make-child') return 'child';
  return null;
}

export function TreeNodeRow({
  node,
  depth,
  treeId,
  nodeStats,
  editMode,
  onToggleExpand,
  onRename,
  onDelete,
}: TreeNodeProps): ReactElement {
  const [isDragging, setIsDragging] = useState(false);
  const [dropIndicator, setDropIndicator] = useState<'top' | 'bottom' | 'child' | null>(null);

  const rowRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLButtonElement>(null);

  const isExpanded = node.data.isOpen;
  const isBranch = isBranchNode(node);

  // Attach draggable
  useEffect(() => {
    const el = rowRef.current;
    if (!el || !editMode) return undefined;
    return draggable({
      element: el,
      dragHandle: dragHandleRef.current ?? undefined,
      getInitialData: (): DragPayload => ({ nodeId: node.id, sourceTreeId: treeId }),
      onGenerateDragPreview({ nativeSetDragImage }) {
        setCustomNativeDragPreview({
          nativeSetDragImage,
          getOffset: pointerOutsideOfPreview({ x: '16px', y: '8px' }),
          render({ container }) {
            const root = createRoot(container);
            root.render(<DragOverlayContent node={node} />);
            return () => root.unmount();
          },
        });
      },
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false),
    });
  }, [editMode, node, treeId]);

  // Attach drop target
  useEffect(() => {
    const el = rowRef.current;
    if (!el || !editMode) return undefined;
    return dropTargetForElements({
      element: el,
      getData: ({ input, element: el }) =>
        attachInstruction(
          { nodeId: node.id, treeId },
          {
            input,
            element: el,
            currentLevel: depth,
            indentPerLevel: 24,
            mode: isExpanded ? 'expanded' : 'standard',
            block: node.droppable ? [] : ['make-child'],
          },
        ),
      onDragEnter: ({ self }) =>
        setDropIndicator(instructionToIndicator(extractInstruction(self.data))),
      onDrag: ({ self }) => setDropIndicator(instructionToIndicator(extractInstruction(self.data))),
      onDragLeave: () => setDropIndicator(null),
      onDrop: () => setDropIndicator(null),
    });
  }, [depth, editMode, isExpanded, node.droppable, node.id, treeId]);

  const indentPx = depth * 24;

  if (isBranch) {
    const sum = nodeStats.get(node.id)?.sum ?? 0;
    const leafCount = nodeStats.get(node.id)?.leafCount ?? 0;

    return (
      <div
        ref={rowRef}
        className={cn(
          'flex flex-col',
          isDragging && 'opacity-50',
          dropIndicator === 'top' && 'border-t-2 border-primary',
          dropIndicator === 'bottom' && 'border-b-2 border-primary',
          dropIndicator === 'child' && 'bg-accent/30',
        )}
      >
        <div
          className="flex items-center h-10 px-2 hover:bg-muted/50 border-b border-border/50 group"
          style={{ paddingInlineStart: `${indentPx + 8}px` }}
        >
          {editMode && (
            <button
              ref={dragHandleRef}
              className="cursor-grab p-1 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <GripVertical className="size-4" />
            </button>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="size-6 p-0"
            onClick={() => onToggleExpand(node.id)}
          >
            {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </Button>

          {isExpanded ? (
            <FolderOpen className="size-4 text-muted-foreground ml-1" />
          ) : (
            <Folder className="size-4 text-muted-foreground ml-1" />
          )}

          <span className="ml-2 font-medium truncate">{node.text}</span>

          {node.data.nodeType === 'sort-code-branch' && node.data.sortCode && (
            <Badge variant="outline" className="ml-2 text-xs">
              Sort Code {node.data.sortCode}
            </Badge>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="secondary"
                    className={cn(
                      'text-xs font-mono',
                      sum >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800',
                    )}
                  >
                    {formatCurrency(sum)}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Total of all descendants</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {!isExpanded && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-xs">
                      {leafCount}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>{leafCount} entities</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {editMode && node.data.nodeType === 'synthetic-branch' && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-6 p-0 opacity-0 group-hover:opacity-100"
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onRename?.(node.id, node.text)}>
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => onDelete?.(node.id)}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Financial entity leaf
  const value = node.data.value ?? 0;
  const entityType = node.data.entityType ?? 'business';

  return (
    <div
      ref={rowRef}
      className={cn(
        'flex flex-col',
        isDragging && 'opacity-50',
        dropIndicator === 'top' && 'border-t-2 border-primary',
        dropIndicator === 'bottom' && 'border-b-2 border-primary',
      )}
    >
      <div
        className="flex items-center h-10 px-2 hover:bg-muted/50 border-b border-border/50 group"
        style={{ paddingInlineStart: `${indentPx + 8}px` }}
      >
        {editMode && (
          <button
            ref={dragHandleRef}
            className="cursor-grab p-1 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <GripVertical className="size-4" />
          </button>
        )}

        <div className="size-6 flex items-center justify-center">
          {entityType === 'business' ? (
            <Building2 className="size-4 text-muted-foreground" />
          ) : (
            <User className="size-4 text-muted-foreground" />
          )}
        </div>

        <span className="ml-2 truncate">{node.text}</span>

        <div className="flex items-center gap-2 ml-auto">
          <Badge
            variant="secondary"
            className={cn(
              'text-xs font-mono',
              value >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800',
            )}
          >
            {formatCurrency(value)}
          </Badge>

          <Button
            variant="ghost"
            size="sm"
            className="size-6 p-0"
            onClick={() => onToggleExpand(node.id)}
          >
            {isExpanded ? (
              <PanelTopClose className="size-4" />
            ) : (
              <PanelTopOpen className="size-4" />
            )}
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div
          className="bg-muted/30 border-b border-border/50 py-2 overflow-x-auto"
          style={{ paddingInlineStart: `${indentPx + 32}px`, paddingInlineEnd: '8px' }}
        >
          <div className="min-w-max">
            <BusinessExtendedInfo businessID={node.id} />
          </div>
        </div>
      )}
    </div>
  );
}
