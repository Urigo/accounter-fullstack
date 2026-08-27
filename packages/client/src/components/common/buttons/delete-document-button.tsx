import type { Dispatch, ReactElement, SetStateAction } from 'react';
import { Trash } from 'lucide-react';
import { useDeleteDocument } from '../../../hooks/use-delete-document.js';
import { Button } from '../../ui/button.js';
import { ConfirmationModal } from '../index.js';

interface Props {
  documentId: string;
  onChange: () => void;
  onDone?: () => void;
  /**
   * Called when deleting the document left its charge empty, so the server deleted the charge too.
   * The consumer should drop the charge instead of refetching it — `Query.charge` throws for a
   * deleted id, which would leave a stale "shadow charge" on screen.
   */
  onChargeDeleted?: (chargeId: string) => void;
  /**
   * Drive the confirmation from outside instead of from the built-in icon trigger. Hosts that
   * already have their own trigger (the documents table's actions menu, for instance) pass both
   * and no trigger button is rendered.
   */
  open?: boolean;
  setOpen?: Dispatch<SetStateAction<boolean>>;
}

export function DeleteDocumentButton({
  documentId,
  onChange,
  onDone,
  onChargeDeleted,
  open,
  setOpen,
}: Props): ReactElement {
  const { deleteDocument } = useDeleteDocument();

  function onDelete(): void {
    deleteDocument({
      documentId,
    }).then(result => {
      if (!result) {
        // failed: the hook already reported it, keep the modal open
        return;
      }
      if (result.deletedChargeId && onChargeDeleted) {
        onChargeDeleted(result.deletedChargeId);
      } else {
        // no charge was deleted, or the consumer refreshes from a list that isn't charge-scoped
        onChange();
      }
      onDone?.();
    });
  }

  return (
    <ConfirmationModal
      onConfirm={onDelete}
      title="Are you sure you want to delete this document?"
      open={open}
      setOpen={setOpen}
    >
      {setOpen ? undefined : (
        <Button variant="ghost" size="icon" className="size-7.5 text-red-500">
          <Trash className="size-5" />
        </Button>
      )}
    </ConfirmationModal>
  );
}
