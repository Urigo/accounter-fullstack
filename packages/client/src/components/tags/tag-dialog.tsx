import { useEffect, useMemo, useState } from 'react';
import { useQuery } from 'urql';
import { Button } from '@/components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field.js';
import { Input } from '@/components/ui/input.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { Spinner } from '@/components/ui/spinner.js';
import { AllTagsScreenDocument, type AllTagsScreenQuery } from '@/gql/graphql.js';
import { isRTL } from '@/lib/utils.js';

type Tag = AllTagsScreenQuery['allTags'][number];

interface TagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag: Tag | null;
  onSave: (name: string, parentId: string | null) => Promise<void>;
  isSaving: boolean;
}

export function TagDialog({ open, onOpenChange, tag, onSave, isSaving }: TagDialogProps) {
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [{ data, fetching }, fetch] = useQuery({
    query: AllTagsScreenDocument,
    pause: true, // Don't fetch on mount
  });

  useEffect(() => {
    if (open) {
      fetch();
    }
  }, [open, fetch]);

  const allTags = useMemo(() => data?.allTags ?? [], [data]);

  useEffect(() => {
    if (open) {
      if (tag) {
        setName(tag.name);
        setParentId(tag.parent?.id ?? null);
      } else {
        setName('');
        setParentId(null);
      }
    }
  }, [tag, open]);

  const handleSave = async () => {
    if (name.trim() && !isSaving) {
      await onSave(name.trim(), parentId);
      onOpenChange(false);
    }
  };

  // Filter out the current tag and its children to prevent circular references
  const availableParents = useMemo(() => {
    if (!tag) {
      return allTags;
    }

    const descendantIds = new Set<string>();
    const queue: string[] = [tag.id];

    // Pre-build a map of children for efficient traversal
    const childrenMap = allTags.reduce((map, t) => {
      if (t.parent?.id) {
        const children = map.get(t.parent.id) ?? [];
        children.push(t.id);
        map.set(t.parent.id, children);
      }
      return map;
    }, new Map<string, string[]>());

    // BFS to find all descendants
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (!descendantIds.has(currentId)) {
        descendantIds.add(currentId);
        const children = childrenMap.get(currentId) ?? [];
        queue.push(...children);
      }
    }

    return allTags.filter(t => !descendantIds.has(t.id));
  }, [allTags, tag]);

  const inputIsRTL = isRTL(name);

  return (
    <Dialog open={open} onOpenChange={isSaving ? undefined : onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
        {fetching && allTags.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Spinner className="size-8" />
            <p className="text-muted-foreground text-sm">Loading tags...</p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{tag ? 'Edit Tag' : 'Create Tag'}</DialogTitle>
              <DialogDescription>
                {tag
                  ? 'Update the tag name and parent category.'
                  : 'Add a new tag to organize your finances.'}
              </DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="tag-name">Name</FieldLabel>
                <Input
                  id="tag-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Enter tag name"
                  dir={inputIsRTL ? 'rtl' : 'ltr'}
                  disabled={isSaving}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      handleSave();
                    }
                  }}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="tag-parent">Parent Tag (optional)</FieldLabel>
                <Select
                  value={parentId ?? 'none'}
                  onValueChange={value => setParentId(value === 'none' ? null : value)}
                  disabled={isSaving}
                >
                  <SelectTrigger id="tag-parent">
                    <SelectValue placeholder="Select parent tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Parent</SelectItem>
                    {availableParents.map(t => {
                      const fullPath =
                        t.namePath && t.namePath.length > 0
                          ? `${t.namePath.join(' / ')} / ${t.name}`
                          : t.name;
                      return (
                        <SelectItem key={t.id} value={t.id} dir={isRTL(t.name) ? 'rtl' : 'ltr'}>
                          {fullPath}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto"
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!name.trim() || isSaving}
                className="w-full sm:w-auto"
              >
                {isSaving ? (
                  <>
                    <Spinner className="size-4 me-2" />
                    Saving...
                  </>
                ) : tag ? (
                  'Save Changes'
                ) : (
                  'Create Tag'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
