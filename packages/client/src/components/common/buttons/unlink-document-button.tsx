import { type ReactElement } from 'react';
import { Unlink } from 'lucide-react';
import { EMPTY_UUID } from '../../../helpers/index.js';
import { useUpdateDocument } from '../../../hooks/use-update-document.js';
import { Button } from '../../ui/button.js';
import { ConfirmationModal } from '../index.js';

interface Props {
  documentId: string;
  onChange: () => void;
  onDone?: () => void;
  /**
   * Called when unlinking left the former charge empty, so the server deleted it. The consumer
   * should drop that charge instead of refetching it — `Query.charge` throws for a deleted id,
   * which would leave a stale "shadow charge" on screen.
   */
  onChargeDeleted?: (chargeId: string) => void;
}

export function UnlinkDocumentButton({
  documentId,
  onChange,
  onDone,
  onChargeDeleted,
}: Props): ReactElement {
  const { updateDocument } = useUpdateDocument();

  function onUnlink(): void {
    updateDocument({
      documentId,
      fields: { chargeId: EMPTY_UUID },
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
      onConfirm={onUnlink}
      title="Are you sure you want to unlink this document from the charge?"
    >
      <Button variant="ghost" size="icon" className="size-7.5">
        <Unlink className="size-5" />
      </Button>
    </ConfirmationModal>
  );
}
