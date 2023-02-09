import { InsertLedgerRecord, PopUpDrawer } from '..';

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
          <a href="/#" className="pt-1">
            Charge ID: {insertLedger}
          </a>
        </div>
      }
      opened={!!(insertLedger)}
      onClose={() => setInsertLedger(undefined)}
    >
      <InsertLedgerRecord chargeId={insertLedger} closeModal={() => setInsertLedger(undefined)} />
    </PopUpDrawer>
  );
};
