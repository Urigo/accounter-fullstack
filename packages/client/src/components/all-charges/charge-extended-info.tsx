import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { FileUpload, Photo, PlaylistAdd, Plus, Search, Trash } from 'tabler-icons-react';
import { useQuery } from 'urql';
import {
  Accordion,
  ActionIcon,
  Box,
  Burger,
  Collapse,
  Loader,
  Menu,
  Modal,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  AllChargesErrorsFieldsFragmentDoc,
  ChargeTableTransactionsFieldsFragmentDoc,
  ConversionChargeInfoFragmentDoc,
  CreditcardBankChargeInfoFragmentDoc,
  DocumentsGalleryFieldsFragmentDoc,
  FetchChargeDocument,
  FetchChargeQuery,
  TableDocumentsFieldsFragmentDoc,
  TableLedgerRecordsFieldsFragmentDoc,
  TableMiscExpensesFieldsFragmentDoc,
  TableSalariesFieldsFragmentDoc,
} from '../../gql/graphql.js';
import { FragmentType, isFragmentReady } from '../../gql/index.js';
import { useDeleteCharge } from '../../hooks/use-delete-charge.js';
import { Deprecation } from '../common/deprecation/index.js';
import {
  BusinessTripSummarizedReport,
  ConfirmationModal,
  RegenerateLedgerRecordsButton,
} from '../common/index.js';
import { ChargeErrors } from './charge-errors.js';
import { ChargeTransactionsTable } from './charge-transactions-table.js';
import { DocumentsGallery } from './documents/documents-gallery.js';
import { DocumentsTable } from './documents/documents-table.js';
import { ConversionInfo } from './extended-info/conversion-info.js';
import { CreditcardTransactionsInfo } from './extended-info/creditcard-transactions-info.js';
import { ChargeMiscExpensesTable } from './extended-info/misc-expenses.js';
import { SalariesTable } from './extended-info/salaries-info.js';
import { LedgerRecordTable } from './ledger-records/ledger-record-table.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query FetchCharge($chargeIDs: [UUID!]!) {
    chargesByIDs(chargeIDs: $chargeIDs) {
      __typename
      id
      metadata {
        transactionsCount
        documentsCount
        ledgerCount
      }
      ...DocumentsGalleryFields @defer
      ...TableDocumentsFields @defer
      ...TableLedgerRecordsFields @defer
      ...ChargeTableTransactionsFields @defer
      ...ConversionChargeInfo @defer
      ...CreditcardBankChargeInfo @defer
      ...TableSalariesFields @defer
      ... on BusinessTripCharge {
        businessTrip {
          id
          ... on BusinessTrip @defer {
            ...BusinessTripReportFields
          }
        }
      }
      ...AllChargesErrorsFields @defer
      miscExpenses {
        transactionId
      }
      ...TableMiscExpensesFields @defer
    }
  }
`;

interface Props {
  chargeID: string;
  onChange?: () => void;
}

export function ChargeExtendedInfo({
  chargeID,
  onChange = (): void => void 0,
}: Props): ReactElement {
  const [accordionItems, setAccordionItems] = useState<string[]>([]);
  const [chargeId, setChargeId] = useState<string>(chargeID);
  const [opened, { toggle }] = useDisclosure(false);
  const [charge, setCharge] = useState<FetchChargeQuery['chargesByIDs'][number] | undefined>(
    undefined,
  );
  const [{ data, fetching }, refetchExtensionInfo] = useQuery({
    query: FetchChargeDocument,
    variables: {
      chargeIDs: [chargeId],
    },
  });

  const onExtendedChange = useCallback(() => {
    refetchExtensionInfo();
    onChange();
  }, [refetchExtensionInfo, onChange]);

  useEffect(() => {
    if (data?.chargesByIDs?.[0]) {
      setCharge(data?.chargesByIDs?.[0]);
    }
  }, [data]);

  useEffect(() => {
    refetchExtensionInfo();
  }, [chargeId, refetchExtensionInfo]);

  useEffect(() => {
    if (chargeID !== chargeId) {
      setChargeId(chargeID);
    }
  }, [chargeID, chargeId]);

  const hasLedgerRecords = !!charge?.metadata?.ledgerCount;
  const hasTransactions = !!charge?.metadata?.transactionsCount;
  const hasDocs = !!charge?.metadata?.documentsCount;
  const isSalaryCharge = charge?.__typename === 'SalaryCharge';
  const hasMiscExpenses = !!charge?.miscExpenses?.length;

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
    if (hasMiscExpenses) {
      tabs.push('miscExpenses');
    }
    setAccordionItems(tabs);
  }, [hasTransactions, hasDocs, hasLedgerRecords, isSalaryCharge, hasMiscExpenses]);

  function toggleAccordionItem(item: string): void {
    if (accordionItems.includes(item)) {
      setAccordionItems(current => current.filter(currItem => currItem !== item));
    } else {
      setAccordionItems(current => [...current, item]);
    }
  }

  const galleryIsReady = isFragmentReady(
    FetchChargeDocument,
    DocumentsGalleryFieldsFragmentDoc,
    charge,
  );

  const docsAreReady = isFragmentReady(
    FetchChargeDocument,
    TableDocumentsFieldsFragmentDoc,
    charge,
  );

  const ledgerRecordsAreReady = isFragmentReady(
    FetchChargeDocument,
    TableLedgerRecordsFieldsFragmentDoc,
    charge,
  );

  const transactionsAreReady = isFragmentReady(
    FetchChargeDocument,
    ChargeTableTransactionsFieldsFragmentDoc,
    charge,
  );

  const miscExpensesAreReady = isFragmentReady(
    FetchChargeDocument,
    TableMiscExpensesFieldsFragmentDoc,
    charge,
  );

  const conversionIsReady = useMemo(() => {
    return (
      charge?.__typename === 'ConversionCharge' &&
      isFragmentReady(FetchChargeDocument, ConversionChargeInfoFragmentDoc, charge)
    );
  }, [charge]);

  const salariesAreReady =
    charge?.__typename === 'SalaryCharge' &&
    isFragmentReady(FetchChargeDocument, TableSalariesFieldsFragmentDoc, charge);

  const creditcardTransactionsAreReady =
    charge?.__typename === 'CreditcardBankCharge' &&
    isFragmentReady(FetchChargeDocument, CreditcardBankChargeInfoFragmentDoc, charge);

  return (
    <div className="flex flex-col gap-5">
      {fetching && (
        <Loader className="flex self-center my-5" color="dark" size="xl" variant="dots" />
      )}
      {isFragmentReady(FetchChargeDocument, AllChargesErrorsFieldsFragmentDoc, charge) && (
        <ChargeErrors data={charge} />
      )}
      {charge && (
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
                  {conversionIsReady && (
                    <ConversionInfo
                      chargeProps={charge as FragmentType<typeof ConversionChargeInfoFragmentDoc>}
                    />
                  )}
                </Accordion.Panel>
              </Accordion.Item>
            )}

            {hasTransactions && (
              <Accordion.Item value="transactions">
                <Accordion.Control
                  disabled={!hasTransactions}
                  onClick={() => toggleAccordionItem('transactions')}
                >
                  Transactions
                </Accordion.Control>
                <Accordion.Panel>
                  {transactionsAreReady && (
                    <ChargeTransactionsTable
                      transactionsProps={charge}
                      onChange={onExtendedChange}
                    />
                  )}
                </Accordion.Panel>
              </Accordion.Item>
            )}

            {hasMiscExpenses && (
              <Accordion.Item value="miscExpenses">
                <Accordion.Control
                  disabled={!hasMiscExpenses}
                  onClick={() => toggleAccordionItem('miscExpenses')}
                >
                  Misc Expenses
                </Accordion.Control>
                <Accordion.Panel>
                  {miscExpensesAreReady && (
                    <ChargeMiscExpensesTable
                      miscExpensesData={charge}
                      onChange={onExtendedChange}
                    />
                  )}
                </Accordion.Panel>
              </Accordion.Item>
            )}

            {hasDocs && (
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
                          loading={!galleryIsReady}
                        >
                          <Photo size={20} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                    Documents
                  </div>
                </Accordion.Control>
                <Accordion.Panel>
                  {docsAreReady && (
                    <DocumentsTable documentsProps={charge} onChange={onExtendedChange} />
                  )}
                </Accordion.Panel>
              </Accordion.Item>
            )}

            {charge.__typename === 'SalaryCharge' && (
              <Accordion.Item value="salaries">
                <Accordion.Control
                  disabled={!isSalaryCharge}
                  onClick={() => toggleAccordionItem('salaries')}
                >
                  Salaries
                </Accordion.Control>
                <Accordion.Panel>
                  {salariesAreReady && <SalariesTable salaryRecordsProps={charge} />}
                </Accordion.Panel>
              </Accordion.Item>
            )}

            {charge.__typename === 'BusinessTripCharge' && (
              <Accordion.Item value="businessTrip">
                <Accordion.Control onClick={() => toggleAccordionItem('businessTrip')}>
                  Business Trip
                </Accordion.Control>
                <Accordion.Panel>
                  <BusinessTripSummarizedReport data={charge.businessTrip!} />
                </Accordion.Panel>
              </Accordion.Item>
            )}

            {charge.__typename === 'CreditcardBankCharge' && (
              <Accordion.Item value="creditcard">
                <Accordion.Control onClick={() => toggleAccordionItem('creditcard')}>
                  CreditCard Transactions
                </Accordion.Control>
                <Accordion.Panel>
                  {creditcardTransactionsAreReady && (
                    <CreditcardTransactionsInfo chargeProps={charge} />
                  )}
                </Accordion.Panel>
              </Accordion.Item>
            )}

            {hasLedgerRecords && (
              <Accordion.Item value="ledger">
                <Accordion.Control
                  disabled={!hasLedgerRecords}
                  onClick={event => {
                    event.stopPropagation();
                    toggleAccordionItem('ledger');
                  }}
                >
                  <div className="flex flex-row items-center gap-2 justify-start w-full">
                    <RegenerateLedgerRecordsButton
                      chargeId={charge.id}
                      onChange={onExtendedChange}
                      variant="outline"
                    />
                    Ledger Records
                  </div>
                </Accordion.Control>
                <Accordion.Panel>
                  {ledgerRecordsAreReady && <LedgerRecordTable ledgerRecordsProps={charge} />}
                </Accordion.Panel>
              </Accordion.Item>
            )}
          </Accordion>
          {galleryIsReady && (
            <Box maw="1/6">
              <Collapse in={opened} transitionDuration={500} transitionTimingFunction="linear">
                <DocumentsGallery chargeProps={charge} onChange={onExtendedChange} />
              </Collapse>
            </Box>
          )}
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
  const [deprecationOpened, { open: openDeprecation, close: closeDeprecation }] =
    useDisclosure(false);

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
          <Menu.Label>Deprecation</Menu.Label>
          <Menu.Item
            icon={<Trash size={14} />}
            onClick={(): void => {
              openDeprecation();
              closeMenu();
            }}
          >
            Deprecation
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <Modal
        withinPortal
        size="xl"
        centered
        opened={deprecationOpened}
        onClose={closeDeprecation}
        title="Deprecation"
        onClick={event => event.stopPropagation()}
      >
        <Deprecation chargeId={chargeId} onChange={closeDeprecation} />
      </Modal>
    </>
  );
}
