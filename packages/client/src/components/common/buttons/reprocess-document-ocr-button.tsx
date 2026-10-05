import type { Dispatch, ReactElement, SetStateAction } from 'react';
import { ScanText } from 'lucide-react';
import { useReprocessDocumentOcr } from '../../../hooks/use-reprocess-document-ocr.js';
import { Button } from '../../ui/button.js';
import { ConfirmationModal } from '../index.js';

interface Props {
  documentId: string;
  onChange: () => void;
  /**
   * Drive the confirmation from outside instead of from the built-in icon trigger. Hosts that
   * already have their own trigger (the documents table's actions menu, for instance) pass both
   * and no trigger button is rendered.
   */
  open?: boolean;
  setOpen?: Dispatch<SetStateAction<boolean>>;
}

/**
 * Re-runs OCR against a document's already-stored file. Confirmed rather than immediate: the call
 * costs an upstream OCR pass per press and runs for tens of seconds.
 */
export function ReprocessDocumentOcrButton({
  documentId,
  onChange,
  open,
  setOpen,
}: Props): ReactElement {
  const { reprocessDocumentOcr } = useReprocessDocumentOcr();

  function onReprocess(): void {
    reprocessDocumentOcr(documentId).then(result => {
      if (!result) {
        // failed: the hook already reported it
        return;
      }
      onChange();
    });
  }

  return (
    <ConfirmationModal
      onConfirm={onReprocess}
      title="Re-run OCR for this document?"
      open={open}
      setOpen={setOpen}
    >
      {setOpen ? undefined : (
        <Button variant="outline" size="icon" className="size-7.5">
          <ScanText className="size-5" />
        </Button>
      )}
    </ConfirmationModal>
  );
}
