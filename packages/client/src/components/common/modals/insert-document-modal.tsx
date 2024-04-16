import { ReactElement } from 'react';
import { Copy } from 'tabler-icons-react';
import { ActionIcon } from '@mantine/core';
import { InsertDocument, PopUpDrawer } from '..';
import { writeToClipboard } from '../../../helpers';

interface Props {
  chargeId: string;
  close: () => void;
  onChange?: () => void;
}

export const InsertDocumentModal = ({ chargeId, close, onChange }: Props): ReactElement => {
  return (
    <PopUpDrawer
      modalSize="40%"
      position="bottom"
      title={
        <div className="flex flex-row mx-3 pt-3 sm:text-1xl gap-10">
          <h1 className="sm:text-2xl font-small text-gray-900">Insert Document:</h1>
          <div className="flex flex-row gap-2">
            Charge ID: {chargeId}
            <ActionIcon
              variant="default"
              onClick={(): void => writeToClipboard(chargeId)}
              size={30}
            >
              <Copy size={20} />
            </ActionIcon>
          </div>
        </div>
      }
      opened={!!chargeId}
      onClose={close}
    >
      <InsertDocument chargeId={chargeId} closeModal={close} onChange={onChange} />
    </PopUpDrawer>
  );
};
