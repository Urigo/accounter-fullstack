import { ReactElement } from 'react';
import { Copy } from 'tabler-icons-react';
import { ActionIcon } from '@mantine/core';
import { EditTransaction, PopUpDrawer, UnlinkTransactionButton } from '..';
import { writeToClipboard } from '../../../helpers';

interface Props {
  transactionID?: string;
  close: () => void;
  onChange: () => void;
}

export const EditTransactionModal = ({
  close,
  transactionID,
  onChange,
}: Props): ReactElement | null => {
  if (!transactionID) return null;
  return (
    <PopUpDrawer
      modalSize="fit-content"
      position="bottom"
      title={
        <div className="flex flex-row mx-3 pt-3 sm:text-1xl gap-10">
          <h1 className="sm:text-2xl font-small text-gray-900">Edit Transaction:</h1>
          <div className="flex flex-row gap-2">
            ID: {transactionID}
            <ActionIcon
              variant="default"
              onClick={(): void => writeToClipboard(transactionID)}
              size={30}
            >
              <Copy size={20} />
            </ActionIcon>
            <UnlinkTransactionButton transactionId={transactionID} />
          </div>
        </div>
      }
      opened={!!transactionID}
      onClose={close}
    >
      <EditTransaction transactionID={transactionID} onDone={close} onChange={onChange} />
    </PopUpDrawer>
  );
};
