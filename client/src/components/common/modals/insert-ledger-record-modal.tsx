import { Copy } from 'tabler-icons-react';
import { ActionIcon } from '@mantine/core';
import { InsertLedgerRecord, PopUpDrawer } from '..';
import { writeToClipboard } from '../../../helpers';

interface Props {
  insertLedger: string;
  setInsertLedger: React.Dispatch<React.SetStateAction<string | undefined>>;
}

export const InsertLedgerRecordModal = ({ insertLedger, setInsertLedger }: Props) => {
  return (
    <PopUpDrawer
      modalSize="40%"
      position="bottom"
      title={
        <div className="flex flex-row mx-3 pt-3 sm:text-1xl gap-10">
          <h1 className="sm:text-2xl font-small text-gray-900">Insert Ledger:</h1>
          <div className="flex flex-row gap-2">
            Charge ID: {insertLedger}
            <ActionIcon variant="default" onClick={() => writeToClipboard(insertLedger)} size={30}>
              <Copy size={20} />
            </ActionIcon>
          </div>
        </div>
      }
      opened={!!insertLedger}
      onClose={() => setInsertLedger(undefined)}
    >
      <InsertLedgerRecord chargeId={insertLedger} closeModal={() => setInsertLedger(undefined)} />
    </PopUpDrawer>
  );
};
