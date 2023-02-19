import { Copy } from 'tabler-icons-react';
import { ActionIcon } from '@mantine/core';
import { PopUpDrawer, UploadDocument } from '..';
import { writeToClipboard } from '../../../helpers';

interface Props {
  uploadDocument: string;
  setUploadDocument: React.Dispatch<React.SetStateAction<string | undefined>>;
}

export const UploadDocumentModal = ({ uploadDocument, setUploadDocument }: Props) => {
  return (
    <PopUpDrawer
      modalSize="40%"
      position="bottom"
      title={
        <div className="flex flex-row mx-3 pt-3 sm:text-1xl gap-10">
          <h1 className="sm:text-2xl font-small text-gray-900">Upload Document:</h1>
          <div className="flex flex-row gap-2">
            Charge ID: {uploadDocument}
            <ActionIcon
              variant="default"
              onClick={() => writeToClipboard(uploadDocument)}
              size={30}
            >
              <Copy size={20} />
            </ActionIcon>
          </div>
        </div>
      }
      opened={!!uploadDocument}
      onClose={() => setUploadDocument(undefined)}
    >
      <UploadDocument chargeId={uploadDocument} closeModal={() => setUploadDocument(undefined)} />
    </PopUpDrawer>
  );
};
