import { Dispatch, SetStateAction, useState } from 'react';
import { FileUpload, PlaylistAdd, Search } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { Burger, Loader, Menu } from '@mantine/core';
import { FetchChargeDocument } from '../../gql/graphql';
import { DocumentsGallery } from './documents/documents-gallery';
import { LedgerRecordTable } from './ledger-records/ledger-record-table';
import { TransactionsTable } from './transactions/transactions-table';

/* GraphQL */ `
  query FetchCharge($chargeID: ID!) {
    chargeById(id: $chargeID) {
      id
      ledgerRecords {
        id
      }
      additionalDocuments {
        id
      }
      transactions {
        id
      }
      ...DocumentsGalleryFields
      ...TableLedgerRecordsFields
      ...TableTransactionsFields
    }
  }
`;

interface Props {
  chargeID: string;
  setInsertDocument: Dispatch<SetStateAction<string | undefined>>;
  setMatchDocuments: Dispatch<SetStateAction<string | undefined>>;
  setUploadDocument: Dispatch<SetStateAction<string | undefined>>;
}

export function ChargeExtendedInfo({
  chargeID,
  setInsertDocument,
  setMatchDocuments,
  setUploadDocument,
}: Props) {
  const [{ data, fetching }] = useQuery({
    query: FetchChargeDocument,
    variables: {
      chargeID,
    },
  });

  const charge = data?.chargeById;

  return (
    <div className="flex flex-col gap-5">
      {fetching && (
        <Loader className="flex self-center my-5" color="dark" size="xl" variant="dots" />
      )}
      {!fetching && charge && (
        <>
          <div className="flex flex-row gap-5">
            {(charge.transactions.length > 0 || charge.additionalDocuments.length > 0) && (
              <div className="flex flex-row justify-start w-full max-w-7/8">
                <TransactionsTable transactionsProps={charge} />
              </div>
            )}
            <div className={`flex flex-col w-${charge.ledgerRecords.length > 0 ? '1/6' : 'full'}`}>
              <div className="w-full flex flex-row justify-end">
                <ChargeExtendedInfoMenu
                  chargeId={charge.id}
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
          {charge.ledgerRecords.length > 0 && (
            <div className="flex flex-row justify-start w-full max-w-7/8">
              <LedgerRecordTable ledgerRecordsProps={charge} />
            </div>
          )}
        </>
      )}
      {!fetching && !charge && <p>Error fetching extended information for this charge</p>}
    </div>
  );
}

interface ChargeExtendedInfoMenuProps {
  chargeId: string;
  setInsertDocument: Dispatch<SetStateAction<string | undefined>>;
  setMatchDocuments: Dispatch<SetStateAction<string | undefined>>;
  setUploadDocument: Dispatch<SetStateAction<string | undefined>>;
}

export function ChargeExtendedInfoMenu({
  chargeId,
  setInsertDocument,
  setMatchDocuments,
  setUploadDocument,
}: ChargeExtendedInfoMenuProps) {
  const [opened, setOpened] = useState(false);

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
