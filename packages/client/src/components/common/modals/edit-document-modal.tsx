import type { ReactElement } from 'react';
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
  if (!documentId) return null;
  return (
    <PopUpDrawer
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
      <EditDocument documentId={documentId} onDone={onDone} onChange={onChange} />
    </PopUpDrawer>
  );
};
