import { ReactElement } from 'react';
import {
  CopyToClipboardButton,
  EditTransaction,
  PopUpDrawer,
  UnlinkTransactionButton,
} from '../index.js';

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
            <CopyToClipboardButton content={transactionID} />
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
