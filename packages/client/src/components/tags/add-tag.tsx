import { useCallback, useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { useAddTag } from '@/hooks/use-add-tag.js';
import { TagDialog } from './tag-dialog.js';

type Props = {
  onDone: () => Promise<void>;
  children?: ReactNode;
};

export function AddTag({ onDone, children }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { addTag } = useAddTag();

  const handleSave = useCallback(
    async (name: string, parentId: string | null) => {
      setIsSaving(true);
      try {
        await addTag({ tagName: name, parentTag: parentId });
        await onDone();
      } finally {
        setIsSaving(false);
      }
    },
    [addTag, onDone],
  );

  return (
    <>
      {children ? (
        <Button asChild onClick={() => setIsOpen(true)}>
          {children}
        </Button>
      ) : (
        <Button onClick={() => setIsOpen(true)} className="w-full sm:w-auto">
          <Plus className="size-4 me-2" />
          Create Tag
        </Button>
      )}

      <TagDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        tag={null}
        onSave={handleSave}
        isSaving={isSaving}
      />
    </>
  );
}
