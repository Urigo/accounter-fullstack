import { Dispatch, SetStateAction, useState } from 'react';
import { CodePlus, FileUpload, PlaylistAdd, Search } from 'tabler-icons-react';
import { Burger, Menu } from '@mantine/core';
import { FragmentType, getFragmentData } from '../../gql';
import { ChargeExtendedInfoFieldsFragmentDoc } from '../../gql/graphql';
import { useGenerateLedgerRecords } from '../../hooks/use-generate-ledger-records';
import { DocumentsGallery } from './documents/documents-gallery';
import { LedgerRecordTable } from './ledger-records/ledger-record-table';

/* GraphQL */ `
  fragment ChargeExtendedInfoFields on Charge {
    id
    ledgerRecords {
      id
    }
    additionalDocuments {
      id
    }
    ...DocumentsGalleryFields
    ...TableLedgerRecordsFields
  }
`;

interface Props {
  chargeProps: FragmentType<typeof ChargeExtendedInfoFieldsFragmentDoc>;
  setInsertLedger: Dispatch<SetStateAction<string | undefined>>;
  setInsertDocument: Dispatch<SetStateAction<string | undefined>>;
  setMatchDocuments: Dispatch<SetStateAction<string | undefined>>;
  setUploadDocument: Dispatch<SetStateAction<string | undefined>>;
}

export function ChargeExtendedInfo({
  chargeProps,
  setInsertLedger,
  setInsertDocument,
  setMatchDocuments,
  setUploadDocument,
}: Props) {
  const charge = getFragmentData(ChargeExtendedInfoFieldsFragmentDoc, chargeProps);
  return (
    <div className="flex flex-row gap-5">
      {(charge.ledgerRecords.length > 0 || charge.additionalDocuments.length > 0) && (
        <div className="flex flex-row justify-start w-full max-w-7/8">
          <LedgerRecordTable ledgerRecordsProps={charge} />
        </div>
      )}
      <div className={`flex flex-col w-${charge.ledgerRecords.length > 0 ? '1/6' : 'full'}`}>
        <div className="w-full flex flex-row justify-end">
          <ChargeExtendedInfoMenu
            chargeId={charge.id}
            setInsertLedger={setInsertLedger}
            setInsertDocument={setInsertDocument}
            setMatchDocuments={setMatchDocuments}
            setUploadDocument={setUploadDocument}
          />
        </div>
        {(charge.ledgerRecords.length > 0 || charge.additionalDocuments.length > 0) && (
          <div className="flex flex-row justify-start">
            <DocumentsGallery chargeProps={charge} />
          </div>
        )}
      </div>
    </div>
  );
}

interface ChargeExtendedInfoMenuProps {
  chargeId: string;
  setInsertLedger: Dispatch<SetStateAction<string | undefined>>;
  setInsertDocument: Dispatch<SetStateAction<string | undefined>>;
  setMatchDocuments: Dispatch<SetStateAction<string | undefined>>;
  setUploadDocument: Dispatch<SetStateAction<string | undefined>>;
}

export function ChargeExtendedInfoMenu({
  chargeId,
  setInsertLedger,
  setInsertDocument,
  setMatchDocuments,
  setUploadDocument,
}: ChargeExtendedInfoMenuProps) {
  const [opened, setOpened] = useState(false);
  const { generateLedger, fetching: generationRunning } = useGenerateLedgerRecords();

  function closeMenu() {
    setOpened(false);
  }

  return (
    <Menu shadow="md" width={200} opened={opened}>
      <Menu.Target>
        <Burger opened={opened} onClick={() => setOpened(o => !o)} />
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Ledger Records</Menu.Label>
        <Menu.Item
          icon={<CodePlus size={14} />}
          onClick={() => {
            generateLedger({ chargeId });
            closeMenu();
          }}
          disabled={generationRunning}
        >
          Generate Ledger
        </Menu.Item>
        <Menu.Item
          icon={<PlaylistAdd size={14} />}
          onClick={() => {
            setInsertLedger(chargeId);
            closeMenu();
          }}
        >
          Insert Ledger
        </Menu.Item>

        <Menu.Divider />
        <Menu.Label>Documents</Menu.Label>
        <Menu.Item
          icon={<PlaylistAdd size={14} />}
          onClick={() => {
            setInsertDocument(chargeId);
            closeMenu();
          }}
        >
          Insert Document
        </Menu.Item>
        <Menu.Item
          icon={<FileUpload size={14} />}
          onClick={() => {
            setUploadDocument(chargeId);
            closeMenu();
          }}
        >
          Upload Document
        </Menu.Item>
        <Menu.Item
          icon={<Search size={14} />}
          onClick={() => {
            setMatchDocuments(chargeId);
            closeMenu();
          }}
        >
          Match Document
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
