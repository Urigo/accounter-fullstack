import { useState } from 'react';
import { FileUpload, Photo, PlaylistAdd, Plus, Search } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { Accordion, ActionIcon, Box, Burger, Collapse, Loader, Menu, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { FetchChargeDocument } from '../../gql/graphql';
import { DocumentsGallery } from './documents/documents-gallery';
import { DocumentsTable } from './documents/documents-table';
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
        documentsCount
      }
      ...DocumentsGalleryFields
      ...TableDocumentsFields
      ...TableLedgerRecordsFields
      ...TableTransactionsFields
    }
  }
`;

interface Props {
  chargeID: string;
}

export function ChargeExtendedInfo({ chargeID }: Props) {
  const [opened, { toggle }] = useDisclosure(false);
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
  const hasDocs = !!charge?.metadata?.documentsCount;

  const defaultAccordionValue = () => {
    const tabs = [];
    if (hasTransactions) {
      tabs.push('transactions');
    }
    if (hasDocs) {
      tabs.push('documents');
    }
    if (hasLedgerRecords) {
      tabs.push('ledger');
    }
    return tabs;
  };

  return (
    <div className="flex flex-col gap-5">
      {fetching && (
        <Loader className="flex self-center my-5" color="dark" size="xl" variant="dots" />
      )}
      {!fetching && charge && (
        <div className="flex flex-row gap-5">
          <Accordion
            className="w-full"
            multiple
            defaultValue={defaultAccordionValue()}
            chevron={<Plus size="1rem" />}
            styles={{
              chevron: {
                '&[data-rotate]': {
                  transform: 'rotate(45deg)',
                },
              },
            }}
          >
            <Accordion.Item value="transactions">
              <Accordion.Control disabled={!hasTransactions}>Transactions</Accordion.Control>
              <Accordion.Panel>
                <TransactionsTable transactionsProps={charge} />
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="documents">
              <Accordion.Control disabled={!hasDocs}>
                <div className="flex flex-row justify-between w-full">
                  <p>Documents</p>
                  {hasDocs && (
                    <Tooltip label="Documents Gallery">
                      <ActionIcon onClick={toggle}>
                        <Photo size={20} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </div>
              </Accordion.Control>
              <Accordion.Panel>
                <DocumentsTable documentsProps={charge} />
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="ledger">
              <Accordion.Control disabled={!hasLedgerRecords}>Ledger Records</Accordion.Control>
              <Accordion.Panel>
                <LedgerRecordTable ledgerRecordsProps={charge} />
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
          <Box maw="1/6">
            <Collapse in={opened} transitionDuration={500} transitionTimingFunction="linear">
              <DocumentsGallery chargeProps={charge} />
            </Collapse>
          </Box>
        </div>
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
