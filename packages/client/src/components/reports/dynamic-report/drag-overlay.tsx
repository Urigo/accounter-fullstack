import { type ReactElement } from 'react';
import { Building2, Folder, User } from 'lucide-react';
import { isBranchNode, type CustomData, type FlatNode } from './utils/types.js';

interface DragOverlayContentProps {
  node: FlatNode<CustomData>;
}

export function DragOverlayContent({ node }: DragOverlayContentProps): ReactElement {
  const entityType = node.data.entityType ?? 'business';
  return (
    <div className="flex items-center gap-2 bg-background border rounded-md px-3 py-2 shadow-lg">
      {isBranchNode(node) ? (
        <Folder className="size-4 text-muted-foreground" />
      ) : entityType === 'business' ? (
        <Building2 className="size-4 text-muted-foreground" />
      ) : (
        <User className="size-4 text-muted-foreground" />
      )}
      <span className="font-medium text-sm">{node.text}</span>
      <span className="text-xs text-muted-foreground capitalize">
        ({isBranchNode(node) ? 'branch' : 'entity'})
      </span>
    </div>
  );
}
