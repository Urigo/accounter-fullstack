import { ChevronRight, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.js';
import type { AllTagsScreenQuery } from '@/gql/graphql';
import { cn, isRTL } from '@/lib/utils.js';

type Tag = AllTagsScreenQuery['allTags'][number];

interface TagRowProps {
  tag: Tag;
  depth: number;
  hasChildren: boolean;
  isCollapsed: boolean;
  onToggleCollapse: (tagId: string) => void;
  onEdit: (tag: Tag) => void;
  onDelete: (tag: Tag) => void;
}

export function TagRow({
  tag,
  depth,
  hasChildren,
  isCollapsed,
  onToggleCollapse,
  onEdit,
  onDelete,
}: TagRowProps) {
  const tagNameIsRTL = isRTL(tag.name);

  return (
    <div
      className={cn(
        'group flex items-center justify-between gap-2 px-3 py-3 border-b border-border',
        'hover:bg-secondary/50 transition-colors',
        'sm:px-4',
      )}
    >
      <div
        className="flex items-center gap-2 min-w-0 flex-1"
        style={{ paddingInlineStart: `${depth * 20}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggleCollapse(tag.id)}
            className="p-0.5 rounded hover:bg-secondary transition-colors shrink-0"
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
          >
            <ChevronRight
              className={cn(
                'size-4 text-muted-foreground transition-transform rtl:rotate-180',
                !isCollapsed && 'rotate-90 rtl:rotate-90',
              )}
            />
          </button>
        ) : depth > 0 ? (
          <span className="size-4 shrink-0" aria-hidden="true" />
        ) : null}
        <span
          className={cn('text-foreground font-medium truncate', tagNameIsRTL && 'text-right')}
          dir={tagNameIsRTL ? 'rtl' : 'ltr'}
        >
          {tag.name}
        </span>
        {tag.namePath && tag.namePath.length > 0 && (
          <span className="text-muted-foreground text-sm hidden sm:inline truncate shrink-0">
            ({tag.namePath.join(' / ')})
          </span>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0"
          >
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(tag)}>
            <Pencil className="size-4 me-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onDelete(tag)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="size-4 me-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
