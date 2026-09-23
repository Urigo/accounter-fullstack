import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog.js';

type Props = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Asks before a period, owner or baseline change discards staged review statuses. Controlled: the
 * parent holds the pending change and decides what confirm and cancel do.
 */
export function DiscardApprovalsConfirmation({ open, onConfirm, onCancel }: Props) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={next => {
        if (!next) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard unsaved review statuses?</AlertDialogTitle>
          <AlertDialogDescription>
            The review statuses you have not saved belong to the current period, owner and baseline.
            Changing them will discard those statuses. Other unsaved changes are kept.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Discard and continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
