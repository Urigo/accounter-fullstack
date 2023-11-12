import { ReactElement, useState } from 'react';
import { FileUpload, Photo, PlaylistAdd, Plus, Search, Trash } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { Accordion, ActionIcon, Box, Burger, Collapse, Loader, Menu, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { FetchChargeDocument } from '../../gql/graphql.js';
import { useDeleteCharge } from '../../hooks/use-delete-charge.js';
import { ConfirmationModal } from '../common/index.js';
import { DocumentsGallery } from './documents/documents-gallery';
import { DocumentsTable } from './documents/documents-table';
import { ConversionInfo } from './extended-info/conversion-info.js';
import { SalariesTable } from './extended-info/salaries-info.js';
import { LedgerRecordTable } from './ledger-records/ledger-record-table';
import { TransactionsTable } from './transactions/transactions-table';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query FetchCharge($chargeIDs: [ID!]!) {
    chargesByIDs(chargeIDs: $chargeIDs) {
      __typename
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
      tags {
        name
      }
      ...DocumentsGalleryFields
      ...TableDocumentsFields
      ...TableLedgerRecordsFields
      ...TableTransactionsFields
      ... on ConversionCharge {
        ...ConversionChargeInfo
      }
      ...TableSalariesFields
    }
  }
`;

interface Props {
  chargeID: string;
}

export function ChargeExtendedInfo({ chargeID }: Props): ReactElement {
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
  const isSalaryCharge = (charge?.tags?.map(tag => tag.name) ?? []).includes('salary');

  const defaultAccordionValue = (): string[] => {
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
    if (isSalaryCharge) {
      tabs.push('salaries');
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
            {charge.__typename === 'ConversionCharge' && (
              <Accordion.Item value="conversion">
                <Accordion.Control disabled={!hasTransactions}>Conversion Info</Accordion.Control>
                <Accordion.Panel>
                  <ConversionInfo chargeProps={charge} />
                </Accordion.Panel>
              </Accordion.Item>
            )}

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

            {isSalaryCharge && (
              <Accordion.Item value="salaries">
                <Accordion.Control disabled={!isSalaryCharge}>Salaries</Accordion.Control>
                <Accordion.Panel>
                  <SalariesTable salaryRecordsProps={charge} />
                </Accordion.Panel>
              </Accordion.Item>
            )}

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
  chargeId: string;
  setInsertDocument: () => void;
  setMatchDocuments: () => void;
  setUploadDocument: () => void;
}

export function ChargeExtendedInfoMenu({
  chargeId,
  setInsertDocument,
  setMatchDocuments,
  setUploadDocument,
}: ChargeExtendedInfoMenuProps): ReactElement {
  const { deleteCharge } = useDeleteCharge();
  const [opened, setOpened] = useState(false);
  const [modalOpened, setModalOpened] = useState(false);

  function onDelete(): void {
    deleteCharge({
      chargeId,
    });
    setModalOpened(false);
  }

  function closeMenu(): void {
    setOpened(false);
  }

  return (
    <>
      <ConfirmationModal
        opened={modalOpened}
        onClose={(): void => setModalOpened(false)}
        onConfirm={onDelete}
        title="Are you sure you want to delete this charge?"
      />
      <Menu shadow="md" width={200} opened={opened}>
        <Menu.Target>
          <Burger opened={opened} onClick={(): void => setOpened(o => !o)} />
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label>Charge</Menu.Label>
          <Menu.Item
            icon={<Trash size={14} />}
            onClick={(): void => {
              setModalOpened(true);
              closeMenu();
            }}
          >
            Delete Charge
          </Menu.Item>
          <Menu.Divider />
          <Menu.Label>Documents</Menu.Label>
          <Menu.Item
            icon={<PlaylistAdd size={14} />}
            onClick={(): void => {
              setInsertDocument();
              closeMenu();
            }}
          >
            Insert Document
          </Menu.Item>
          <Menu.Item
            icon={<FileUpload size={14} />}
            onClick={(): void => {
              setUploadDocument();
              closeMenu();
            }}
          >
            Upload Document
          </Menu.Item>
          <Menu.Item
            icon={<Search size={14} />}
            onClick={(): void => {
              setMatchDocuments();
              closeMenu();
            }}
          >
            Match Document
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </>
  );
}
