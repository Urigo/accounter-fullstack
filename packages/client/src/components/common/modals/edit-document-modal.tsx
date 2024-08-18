import { ReactElement } from 'react';
import { Tooltip } from '@mantine/core';
import {
  CopyToClipboardButton,
  DeleteDocumentButton,
  EditDocument,
  PopUpDrawer,
  UnlinkDocumentButton,
} from '../index.js';

interface Props {
  documentId?: string;
  onDone: () => void;
  onChange: () => void;
}

export const EditDocumentModal = ({ onDone, onChange, documentId }: Props): ReactElement | null => {
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
            <Tooltip label="Copy ID">
              <CopyToClipboardButton content={documentId} />
            </Tooltip>
            <UnlinkDocumentButton documentId={documentId} />
            <DeleteDocumentButton documentId={documentId} />
          </div>
        </div>
      }
    >
      <EditDocument documentId={documentId} onDone={onDone} onChange={onChange} />
    </PopUpDrawer>
  );
};
