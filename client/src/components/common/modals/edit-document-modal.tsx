import { Copy } from 'tabler-icons-react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { DeleteDocumentButton, EditDocument, PopUpDrawer, UnlinkDocumentButton } from '..';
import { writeToClipboard } from '../../../helpers';

interface Props {
  documentId?: string;
  onDone: () => void;
}

export const EditDocumentModal = ({ onDone, documentId }: Props) => {
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
              <ActionIcon variant="default" onClick={() => writeToClipboard(documentId)} size={30}>
                <Copy size={20} />
              </ActionIcon>
            </Tooltip>
            <UnlinkDocumentButton documentId={documentId} />
            <DeleteDocumentButton documentId={documentId} />
          </div>
        </div>
      }
    >
      <EditDocument documentId={documentId} onDone={onDone} />
    </PopUpDrawer>
  );
};
