import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, TagIcon } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty.js';
import { type AllTagsScreenQuery } from '@/gql/graphql.js';
import { useAddTag } from '@/hooks/use-add-tag.js';
import { useDeleteTag } from '@/hooks/use-delete-tag.js';
import { useUpdateTag } from '@/hooks/use-update-tag.js';
import { AddTag } from './add-tag.js';
import { DeleteTagDialog } from './delete-tag-dialog.js';
import { TagDialog } from './tag-dialog.js';
import { TagRow } from './tag-row.js';

type Tag = AllTagsScreenQuery['allTags'][number];

// Build a hierarchical tree from flat tags array
interface TagNode {
  tag: Tag;
  children: TagNode[];
}

function buildTagTree(tags: Tag[]): TagNode[] {
  const tagMap = new Map<string, TagNode>();
  const roots: TagNode[] = [];

  // Create nodes for all tags
  tags.map(tag => {
    tagMap.set(tag.id, { tag, children: [] });
  });

  // Build tree structure
  tags.map(tag => {
    const node = tagMap.get(tag.id)!;
    if (tag.parent) {
      const parentNode = tagMap.get(tag.parent.id);
      if (parentNode) {
        parentNode.children.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  // Sort children alphabetically
  const sortNodes = (nodes: TagNode[]): TagNode[] => {
    return nodes
      .sort((a, b) => a.tag.name.localeCompare(b.tag.name))
      .map(node => ({
        ...node,
        children: sortNodes(node.children),
      }));
  };

  return sortNodes(roots);
}

// Flatten tree back to array with depth info, respecting collapsed state
function flattenTree(
  nodes: TagNode[],
  collapsedIds: Set<string>,
  depth = 0,
): Array<{ tag: Tag; depth: number; hasChildren: boolean }> {
  const result: Array<{ tag: Tag; depth: number; hasChildren: boolean }> = [];
  nodes.map(node => {
    const hasChildren = node.children.length > 0;
    result.push({ tag: node.tag, depth, hasChildren });
    // Only include children if this node is not collapsed
    if (hasChildren && !collapsedIds.has(node.tag.id)) {
      result.push(...flattenTree(node.children, collapsedIds, depth + 1));
    }
  });
  return result;
}

type Props = {
  allTags: Tag[];
  search: string;
  onChange: () => Promise<void>;
};

export function TagsList({ search, allTags, onChange }: Props) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { addTag } = useAddTag();
  const { deleteTag } = useDeleteTag();
  const { updateTag } = useUpdateTag();

  const filteredTags = useMemo(() => {
    if (!search.trim()) return allTags;
    const searchLower = search.toLowerCase();
    return allTags.filter(
      tag =>
        tag.name.toLowerCase().includes(searchLower) ||
        tag.namePath?.some(p => p.toLowerCase().includes(searchLower)),
    );
  }, [allTags, search]);

  const hierarchicalTags = useMemo(() => {
    const tree = buildTagTree(filteredTags);
    return flattenTree(tree, collapsedIds);
  }, [filteredTags, collapsedIds]);

  // Reset collapsed state when search changes (expand all when searching)
  useEffect(() => {
    if (search.trim()) {
      setCollapsedIds(new Set());
    }
  }, [search]);

  const handleToggleCollapse = useCallback((tagId: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  }, []);

  const handleEdit = useCallback((tag: Tag) => {
    setSelectedTag(tag);
    setEditDialogOpen(true);
  }, []);

  const handleDelete = useCallback((tag: Tag) => {
    setSelectedTag(tag);
    setDeleteDialogOpen(true);
  }, []);

  const handleSave = useCallback(
    async (name: string, parentId: string | null) => {
      setIsSaving(true);
      try {
        if (selectedTag) {
          // Edit existing tag
          await updateTag({ tagId: selectedTag.id, fields: { name, parentId } });
        } else {
          // Create new tag
          await addTag({ tagName: name, parentTag: parentId });
        }
        await onChange();
        setSelectedTag(null);
      } finally {
        setIsSaving(false);
      }
    },
    [addTag, selectedTag, onChange, updateTag],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (selectedTag) {
      setIsDeleting(true);
      try {
        await deleteTag({ tagId: selectedTag.id, name: selectedTag.name });
        await onChange();
        setSelectedTag(null);
        setDeleteDialogOpen(false);
      } finally {
        setIsDeleting(false);
      }
    }
  }, [deleteTag, selectedTag, onChange]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        {/* Tags List */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {hierarchicalTags.length > 0 ? (
            hierarchicalTags.map(({ tag, depth, hasChildren }) => (
              <TagRow
                key={tag.id}
                tag={tag}
                depth={depth}
                hasChildren={hasChildren}
                isCollapsed={collapsedIds.has(tag.id)}
                onToggleCollapse={handleToggleCollapse}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))
          ) : (
            <Empty className="py-8 sm:py-12">
              <EmptyMedia>
                <TagIcon className="size-8 sm:size-10 text-muted-foreground" />
              </EmptyMedia>
              <EmptyTitle>{search ? 'No tags found' : 'No tags yet'}</EmptyTitle>
              <EmptyDescription>
                {search
                  ? 'Try adjusting your search query.'
                  : 'Create your first tag to start organizing your finances.'}
              </EmptyDescription>
              {!search && (
                <EmptyContent>
                  <AddTag onDone={onChange}>
                    <Button>
                      <Plus className="size-4 me-2" />
                      Create Tag
                    </Button>
                  </AddTag>
                </EmptyContent>
              )}
            </Empty>
          )}
        </div>

        {/* Tag count */}
        {allTags.length > 0 && (
          <p className="text-muted-foreground text-sm mt-4 text-center">
            {filteredTags.length} of {allTags.length} tag
            {allTags.length === 1 ? '' : 's'}
          </p>
        )}
      </div>

      {/* Dialogs */}
      <TagDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        tag={selectedTag}
        onSave={handleSave}
        isSaving={isSaving}
      />
      <DeleteTagDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        tag={selectedTag}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}
