import { Copy } from 'tabler-icons-react';
import { ActionIcon } from '@mantine/core';
import { EditCharge, PopUpDrawer } from '..';
import { writeToClipboard } from '../../../helpers';

interface Props {
  chargeId?: string;
  onDone: () => void;
}

export const EditChargeModal = ({ chargeId, onDone }: Props) => {
  if (!chargeId) {
    return null;
  }

  return (
    <PopUpDrawer
      modalSize="fit-content"
      position="bottom"
      title={
        <div className="flex flex-row mx-3 pt-3 sm:text-1xl gap-10">
          <h1 className="sm:text-2xl font-small text-gray-900">Edit Charge:</h1>
          <div className="flex flex-row gap-2">
            ID: {chargeId}
            <ActionIcon variant="default" onClick={() => writeToClipboard(chargeId)} size={30}>
              <Copy size={20} />
            </ActionIcon>
          </div>
        </div>
      }
      opened={!!chargeId}
      onClose={onDone}
    >
      <EditCharge chargeId={chargeId} onDone={onDone} />
    </PopUpDrawer>
  );
};
