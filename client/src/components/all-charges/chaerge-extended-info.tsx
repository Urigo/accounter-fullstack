import { Dispatch, SetStateAction } from 'react';

import { AllChargesQuery } from '../../__generated__/types';
import { useGenerateLedgerRecords } from '../../hooks/use-generate-ledger-records';
import { AccounterButton } from '../common/button';
import { DocumentsGallery } from './documents/documents-gallery';
import { LedgerRecordTable } from './ledger-record-table';

interface Props {
  charge: AllChargesQuery['financialEntity']['charges'][0];
  setInsertLedger: Dispatch<SetStateAction<string | undefined>>;
  setInsertDocument: Dispatch<SetStateAction<string | undefined>>;
}

export function ChargeExtendedInfo({ charge, setInsertLedger, setInsertDocument }: Props) {
  const { mutate: generateLedger, isLoading: generationRunning } = useGenerateLedgerRecords();

  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: 10 }}>
      <div className="flex flex-col gap-2 items-center">
        <AccounterButton
          title="Generate Ledger"
          disabled={generationRunning}
          onClick={() => generateLedger({ chargeId: charge.id })}
        />
        <AccounterButton title="Insert Ledger" onClick={() => setInsertLedger(charge.id)} />
        <AccounterButton title="Insert Document" onClick={() => setInsertDocument(charge.id)} />
      </div>
      {(charge.ledgerRecords.length > 0 || charge.additionalDocuments.length > 0) && (
        <>
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'flex-start',
            }}
          >
            <LedgerRecordTable ledgerRecords={charge.ledgerRecords} />
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              width: '50%',
              justifyContent: 'flex-start',
            }}
          >
            <DocumentsGallery additionalDocumentsData={charge.additionalDocuments} />
          </div>
        </>
      )}
    </div>
  );
}
