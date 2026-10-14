import type { ReactElement } from 'react';
import { useSuspendDockedViewer } from '../../../hooks/use-document-viewer.js';
import {
  CopyToClipboardButton,
  DeleteDocumentButton,
  EditDocument,
  PopUpDrawer,
  Tooltip,
  UnlinkDocumentButton,
} from '../index.js';

interface Props {
  documentId?: string;
  onDone: () => void;
  onChange: () => void;
  /** Called when removing the document emptied its charge and the server deleted the charge too. */
  onChargeDeleted?: (chargeId: string) => void;
}

export const EditDocumentModal = ({
  onDone,
  onChange,
  onChargeDeleted,
  documentId,
}: Props): ReactElement | null => {
  // The sheet shows the scan in its own split, so the docked viewer hides while it is open. Called
  // before the early return, so the closed path runs it too and resumes the docked viewer.
  useSuspendDockedViewer(!!documentId);
  if (!documentId) return null;
  return (
    <PopUpDrawer
      size="tall"
      modalSize="fit-content"
      position="bottom"
      opened={!!documentId}
      onClose={onDone}
      title={
        <div className="flex flex-row mx-3 pt-3 sm:text-1xl gap-5">
          <h1 className="sm:text-2xl font-small text-gray-900">Edit Document</h1>
          <div className="flex flex-row gap-2">
            ID: {documentId}
            <Tooltip content="Copy ID">
              <CopyToClipboardButton content={documentId} />
            </Tooltip>
            <UnlinkDocumentButton
              documentId={documentId}
              onChange={onChange}
              onDone={onDone}
              onChargeDeleted={onChargeDeleted}
            />
            <DeleteDocumentButton
              documentId={documentId}
              onChange={onChange}
              onDone={onDone}
              onChargeDeleted={onChargeDeleted}
            />
          </div>
        </div>
      }
    >
      {/* Remounts per document, so the form never keeps another document's values. */}
      <EditDocument key={documentId} documentId={documentId} onDone={onDone} onChange={onChange} />
    </PopUpDrawer>
  );
};
