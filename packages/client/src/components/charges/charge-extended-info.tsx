import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Plus } from 'lucide-react';
import { useQuery } from 'urql';
import { Accordion, Box, Collapse, Loader, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  ChargesTableErrorsFieldsFragmentDoc,
  ChargeTableTransactionsFieldsFragmentDoc,
  ConversionChargeInfoFragmentDoc,
  CreditcardBankChargeInfoFragmentDoc,
  DocumentsGalleryFieldsFragmentDoc,
  ExchangeRatesInfoFragmentDoc,
  FetchChargeDocument,
  FetchChargeQuery,
  TableDocumentsFieldsFragmentDoc,
  TableLedgerRecordsFieldsFragmentDoc,
  TableMiscExpensesFieldsFragmentDoc,
  TableSalariesFieldsFragmentDoc,
} from '../../gql/graphql.js';
import { FragmentType, isFragmentReady } from '../../gql/index.js';
import { BusinessTripSummarizedReport, RegenerateLedgerRecordsButton } from '../common/index.js';
import { DocumentsGallery } from '../documents-table/documents-gallery.js';
import { DocumentsTable } from '../documents-table/index.js';
import { LedgerTable } from '../ledger-table/index.js';
import { Button } from '../ui/button.js';
import { ChargeErrors } from './charge-errors.jsx';
import { ChargeTransactionsTable } from './charge-transactions-table.jsx';
import { ConversionInfo } from './extended-info/conversion-info.jsx';
import { CreditcardTransactionsInfo } from './extended-info/creditcard-transactions-info.jsx';
import { ExchangeRates } from './extended-info/exchange-rates.js';
import { ChargeMiscExpensesTable } from './extended-info/misc-expenses.jsx';
import { SalariesTable } from './extended-info/salaries-info.jsx';

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
        isLedgerLocked
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
      ...ChargesTableErrorsFields @defer
      miscExpenses {
        id
      }
      ...TableMiscExpensesFields @defer
      ...ExchangeRatesInfo @defer
    }
  }
`;

interface Props {
  chargeID: string;
  onChange?: () => void;
  fetching: boolean;
}

export function ChargeExtendedInfo({
  chargeID,
  onChange = (): void => void 0,
  fetching: parentFetching,
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
    if (parentFetching) {
      refetchExtensionInfo();
    }
  }, [parentFetching, refetchExtensionInfo]);

  useEffect(() => {
    if (chargeID !== chargeId) {
      setChargeId(chargeID);
      refetchExtensionInfo();
    }
  }, [chargeID, chargeId, refetchExtensionInfo]);

  const chargeType = useMemo(() => charge?.__typename, [charge]);

  const hasLedgerRecords = !!charge?.metadata?.ledgerCount;
  const hasTransactions = !!charge?.metadata?.transactionsCount;
  const hasDocs = !!charge?.metadata?.documentsCount;
  const isSalaryCharge = chargeType === 'SalaryCharge';
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
      chargeType === 'ConversionCharge' &&
      isFragmentReady(FetchChargeDocument, ConversionChargeInfoFragmentDoc, charge)
    );
  }, [charge, chargeType]);

  const exchangeRatesAreReady = useMemo(() => {
    return (
      chargeType === 'FinancialCharge' &&
      isFragmentReady(FetchChargeDocument, ExchangeRatesInfoFragmentDoc, charge)
    );
  }, [charge, chargeType]);

  const salariesAreReady =
    chargeType === 'SalaryCharge' &&
    isFragmentReady(FetchChargeDocument, TableSalariesFieldsFragmentDoc, charge);

  const creditcardTransactionsAreReady = useMemo(
    () =>
      chargeType === 'CreditcardBankCharge' &&
      isFragmentReady(FetchChargeDocument, CreditcardBankChargeInfoFragmentDoc, charge),
    [charge, chargeType],
  );

  return (
    <div className="flex flex-col gap-5">
      {fetching && (
        <Loader className="flex self-center my-5" color="dark" size="xl" variant="dots" />
      )}
      {isFragmentReady(FetchChargeDocument, ChargesTableErrorsFieldsFragmentDoc, charge) && (
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
            {chargeType === 'ConversionCharge' && (
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

            {chargeType === 'FinancialCharge' && (
              <Accordion.Item value="exchangeRates">
                <Accordion.Control
                  disabled={!exchangeRatesAreReady}
                  onClick={() => toggleAccordionItem('exchangeRates')}
                >
                  Exchange Rates
                </Accordion.Control>
                <Accordion.Panel>
                  {exchangeRatesAreReady && (
                    <ExchangeRates
                      chargeProps={charge as FragmentType<typeof ExchangeRatesInfoFragmentDoc>}
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
                        <Button
                          onClick={event => {
                            event.stopPropagation();
                            toggle();
                          }}
                          variant="outline"
                          disabled={!galleryIsReady}
                          size="icon"
                          className="size-7.5 text-gray-500"
                        >
                          <Image className="size-5" />
                        </Button>
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

            {chargeType === 'SalaryCharge' && (
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

            {chargeType === 'CreditcardBankCharge' && (
              <Accordion.Item value="creditcard">
                <Accordion.Control onClick={() => toggleAccordionItem('creditcard')}>
                  CreditCard Transactions
                </Accordion.Control>
                <Accordion.Panel>
                  {creditcardTransactionsAreReady && (
                    <CreditcardTransactionsInfo
                      chargeProps={
                        charge as FragmentType<typeof CreditcardBankChargeInfoFragmentDoc>
                      }
                    />
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
                    {!charge.metadata?.isLedgerLocked && (
                      <RegenerateLedgerRecordsButton
                        chargeId={charge.id}
                        onChange={onExtendedChange}
                        variant="outline"
                      />
                    )}
                    Ledger Records
                  </div>
                </Accordion.Control>
                <Accordion.Panel>
                  {ledgerRecordsAreReady && <LedgerTable ledgerFragment={charge} />}
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
