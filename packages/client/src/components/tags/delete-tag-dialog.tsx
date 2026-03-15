import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog.js';
import { Button } from '@/components/ui/button.js';
import { Spinner } from '@/components/ui/spinner.js';
import type { AllTagsScreenQuery } from '@/gql/graphql';
import { isRTL } from '@/lib/utils.js';

interface DeleteTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag: AllTagsScreenQuery['allTags'][number] | null;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
}

export function DeleteTagDialog({
  open,
  onOpenChange,
  tag,
  onConfirm,
  isDeleting,
}: DeleteTagDialogProps) {
  if (!tag) return null;

  const tagNameIsRTL = isRTL(tag.name);

  return (
    <AlertDialog open={open} onOpenChange={isDeleting ? undefined : onOpenChange}>
      <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Tag</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the tag{' '}
            <span className="font-semibold text-foreground" dir={tagNameIsRTL ? 'rtl' : 'ltr'}>
              &quot;{tag.name}&quot;
            </span>
            ? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
          <AlertDialogCancel className="w-full sm:w-auto" disabled={isDeleting}>
            Cancel
          </AlertDialogCancel>
          <Button
            onClick={onConfirm}
            disabled={isDeleting}
            variant="destructive"
            className="w-full sm:w-auto"
          >
            {isDeleting ? (
              <>
                <Spinner className="size-4 me-2" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
