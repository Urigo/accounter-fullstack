import { ReactElement, useEffect, useState } from 'react';
import { FileUpload, Photo, PlaylistAdd, Plus, Search, Trash } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { Accordion, ActionIcon, Box, Burger, Collapse, Loader, Menu, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { FetchChargeDocument } from '../../gql/graphql.js';
import { useDeleteCharge } from '../../hooks/use-delete-charge.js';
import {
  BusinessTripReport,
  ConfirmationModal,
  RegenerateLedgerRecordsButton,
} from '../common/index.js';
import { DocumentsGallery } from './documents/documents-gallery.js';
import { DocumentsTable } from './documents/documents-table.js';
import { ConversionInfo } from './extended-info/conversion-info.js';
import { SalariesTable } from './extended-info/salaries-info.js';
import { LedgerRecordTable } from './ledger-records/ledger-record-table.js';
import { TransactionsTable } from './transactions/transactions-table.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query FetchCharge($chargeIDs: [UUID!]!) {
    chargesByIDs(chargeIDs: $chargeIDs) {
      __typename
      id
      ... on Charge @defer {
        ledger {
          records {
            id
          }
          balance {
            isBalanced
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
      ... on SalaryCharge {
        ...TableSalariesFields
      }
      ... on BusinessTripCharge {
        businessTrip {
          id
          ...BusinessTripReportFields
        }
      }
    }
  }
`;

interface Props {
  chargeID: string;
}

export function ChargeExtendedInfo({ chargeID }: Props): ReactElement {
  const [accordionItems, setAccordionItems] = useState<string[]>([]);
  const [opened, { toggle }] = useDisclosure(false);
  const [{ data, fetching }] = useQuery({
    query: FetchChargeDocument,
    variables: {
      chargeIDs: [chargeID],
    },
  });

  const charge = data?.chargesByIDs?.[0];

  const hasLedgerRecords = !!(charge?.ledger?.records && charge.ledger.records.length > 0);
  const hasTransactions = !!charge?.metadata?.transactionsCount;
  const hasDocs = !!charge?.metadata?.documentsCount;
  const isSalaryCharge = (charge?.tags?.map(tag => tag.name) ?? []).includes('salary');

  useEffect(() => {
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
    setAccordionItems(tabs);
  }, [hasTransactions, hasDocs, hasLedgerRecords, isSalaryCharge]);

  function toggleAccordionItem(item: string): void {
    if (accordionItems.includes(item)) {
      setAccordionItems(current => current.filter(currItem => currItem !== item));
    } else {
      setAccordionItems(current => [...current, item]);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {fetching && (
        <Loader className="flex self-center my-5" color="dark" size="xl" variant="dots" />
      )}
      {!fetching && charge && (
        <div className="flex flex-row">
          <Accordion
            className="w-full"
            multiple
            value={accordionItems}
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
                <Accordion.Control
                  disabled={!hasTransactions}
                  onClick={() => toggleAccordionItem('conversion')}
                >
                  Conversion Info
                </Accordion.Control>
                <Accordion.Panel>
                  <ConversionInfo chargeProps={charge} />
                </Accordion.Panel>
              </Accordion.Item>
            )}

            <Accordion.Item value="transactions">
              <Accordion.Control
                disabled={!hasTransactions}
                onClick={() => toggleAccordionItem('transactions')}
              >
                Transactions
              </Accordion.Control>
              <Accordion.Panel>
                <TransactionsTable transactionsProps={charge} />
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="documents">
              <Accordion.Control
                disabled={!hasDocs}
                onClick={() => toggleAccordionItem('documents')}
              >
                <div className="flex flex-row items-center gap-2 justify-start w-full">
                  {hasDocs && (
                    <Tooltip label="Documents Gallery">
                      <ActionIcon
                        onClick={event => {
                          event.stopPropagation();
                          toggle();
                        }}
                        variant="outline"
                      >
                        <Photo size={20} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                  Documents
                </div>
              </Accordion.Control>
              <Accordion.Panel>
                <DocumentsTable documentsProps={charge} />
              </Accordion.Panel>
            </Accordion.Item>

            {charge.__typename === 'SalaryCharge' && (
              <Accordion.Item value="salaries">
                <Accordion.Control
                  disabled={!isSalaryCharge}
                  onClick={() => toggleAccordionItem('salaries')}
                >
                  Salaries
                </Accordion.Control>
                <Accordion.Panel>
                  <SalariesTable salaryRecordsProps={charge} />
                </Accordion.Panel>
              </Accordion.Item>
            )}

            {charge.__typename === 'BusinessTripCharge' && (
              <Accordion.Item value="businessTrip">
                <Accordion.Control onClick={() => toggleAccordionItem('businessTrip')}>
                  Business Trip
                </Accordion.Control>
                <Accordion.Panel>
                  <BusinessTripReport data={charge.businessTrip!} />
                </Accordion.Panel>
              </Accordion.Item>
            )}

            <Accordion.Item value="ledger">
              <Accordion.Control
                disabled={!hasLedgerRecords}
                onClick={event => {
                  event.stopPropagation();
                  toggleAccordionItem('ledger');
                }}
              >
                <div className="flex flex-row items-center gap-2 justify-start w-full">
                  <RegenerateLedgerRecordsButton chargeId={charge.id} variant="outline" />
                  Ledger Records
                </div>
              </Accordion.Control>
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
          <Burger
            opened={opened}
            onClick={(event): void => {
              event.stopPropagation();
              setOpened(o => !o);
            }}
          />
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
