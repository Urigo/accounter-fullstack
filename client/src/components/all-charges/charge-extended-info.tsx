import { Dispatch, SetStateAction, useState } from 'react';
import { FileUpload, PlaylistAdd, Search } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { Burger, Loader, Menu } from '@mantine/core';
import { FetchChargeDocument } from '../../gql/graphql';
import { DocumentsGallery } from './documents/documents-gallery';
import { LedgerRecordTable } from './ledger-records/ledger-record-table';
import { TransactionsTable } from './transactions/transactions-table';

/* GraphQL */ `
  query FetchCharge($chargeIDs: [ID!]!) {
    chargesByIDs(chargeIDs: $chargeIDs) {
      id
      owner {
        id
      }
      ledgerRecords {
        ... on LedgerRecords {
          records {
            id
          }
        }
      }
      metadata {
        transactionsCount
        invoicesCount
        receiptsCount
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
  setMatchDocuments: Dispatch<SetStateAction<{ id: string; ownerId: string } | undefined>>;
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
      chargeIDs: [chargeID],
    },
  });

  const charge = data?.chargesByIDs?.[0];

  const hasLedgerRecords = !!(
    charge?.ledgerRecords &&
    'records' in charge.ledgerRecords &&
    charge.ledgerRecords.records.length > 0
  );
  const hasTransactions = !!charge?.metadata?.transactionsCount;
  const hasDocs = !!(charge?.metadata?.invoicesCount || charge?.metadata?.receiptsCount);
  return (
    <div className="flex flex-col gap-5">
      {fetching && (
        <Loader className="flex self-center my-5" color="dark" size="xl" variant="dots" />
      )}
      {!fetching && charge && (
        <>
          <div className="flex flex-row gap-5">
            {(hasTransactions || hasDocs) && (
              <div className="flex flex-col justify-start items-center w-full max-w-7/8">
                <h1 className="text-base font-semibold">Transactions</h1>
                <div className="p-2 flex flex-row w-full">
                  <TransactionsTable transactionsProps={charge} />
                </div>
              </div>
            )}
            <div className={`flex flex-col w-${hasTransactions ? '1/6' : 'full'}`}>
              <div className="w-full flex flex-row justify-end">
                <ChargeExtendedInfoMenu
                  setInsertDocument={() => setInsertDocument(charge.id)}
                  setMatchDocuments={() =>
                    setMatchDocuments({ id: charge.id, ownerId: charge.owner.id })
                  }
                  setUploadDocument={() => setUploadDocument(charge.id)}
                />
              </div>
              {(hasTransactions || hasDocs) && (
                <div className="flex flex-col justify-start items-center">
                  <h1 className="text-base font-semibold">Documents</h1>
                  <DocumentsGallery chargeProps={charge} />
                </div>
              )}
            </div>
          </div>
          {hasLedgerRecords && (
            <div className="flex flex-col justify-start items-center w-full">
              <h1 className="text-base font-semibold">Ledger Records</h1>
              <div className="p-2 flex flex-row w-full">
                <LedgerRecordTable ledgerRecordsProps={charge} />
              </div>
            </div>
          )}
        </>
      )}
      {!fetching && !charge && <p>Error fetching extended information for this charge</p>}
    </div>
  );
}

interface ChargeExtendedInfoMenuProps {
  setInsertDocument: () => void;
  setMatchDocuments: () => void;
  setUploadDocument: () => void;
}

export function ChargeExtendedInfoMenu({
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
            setInsertDocument();
            closeMenu();
          }}
        >
          Insert Document
        </Menu.Item>
        <Menu.Item
          icon={<FileUpload size={14} />}
          onClick={() => {
            setUploadDocument();
            closeMenu();
          }}
        >
          Upload Document
        </Menu.Item>
        <Menu.Item
          icon={<Search size={14} />}
          onClick={() => {
            setMatchDocuments();
            closeMenu();
          }}
        >
          Match Document
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
