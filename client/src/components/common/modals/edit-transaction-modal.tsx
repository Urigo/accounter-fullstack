import { Copy } from 'tabler-icons-react';
import { ActionIcon } from '@mantine/core';
import { EditTransaction, PopUpDrawer } from '..';
import { writeToClipboard } from '../../../helpers';

interface Props {
  transactionID?: string;
  setEditTransaction: React.Dispatch<React.SetStateAction<string | undefined>>;
}

export const EditTransactionModal = ({ setEditTransaction, transactionID }: Props) => {
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
            <ActionIcon variant="default" onClick={() => writeToClipboard(transactionID)} size={30}>
              <Copy size={20} />
            </ActionIcon>
          </div>
        </div>
      }
      opened={!!transactionID}
      onClose={() => setEditTransaction(undefined)}
    >
      <EditTransaction transactionID={transactionID} onDone={() => setEditTransaction(undefined)} />
    </PopUpDrawer>
  );
};
