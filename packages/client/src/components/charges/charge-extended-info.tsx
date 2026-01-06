import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { Image } from 'lucide-react';
import { useQuery } from 'urql';
import { Box, Collapse, Loader } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  ChargeLedgerRecordsTableFieldsFragmentDoc,
  ChargesTableErrorsFieldsFragmentDoc,
  ChargeTableTransactionsFieldsFragmentDoc,
  ConversionChargeInfoFragmentDoc,
  CreditcardBankChargeInfoFragmentDoc,
  DocumentsGalleryFieldsFragmentDoc,
  ExchangeRatesInfoFragmentDoc,
  FetchChargeDocument,
  TableDocumentsFieldsFragmentDoc,
  TableMiscExpensesFieldsFragmentDoc,
  TableSalariesFieldsFragmentDoc,
  type FetchChargeQuery,
} from '../../gql/graphql.js';
import { getFragmentData, isFragmentReady, type FragmentType } from '../../gql/index.js';
import {
  BusinessTripSummarizedReport,
  PreviewDocumentModal,
  RegenerateLedgerRecordsButton,
  Tooltip,
} from '../common/index.js';
import { DocumentsGallery } from '../documents-table/documents-gallery.js';
import { DocumentsTable } from '../documents-table/index.js';
import { LedgerTable } from '../ledger-table/index.js';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion.js';
import { Button } from '../ui/button.js';
import { ChargeErrors } from './charge-errors.jsx';
import { ChargeTransactionsTable } from './charge-transactions-table.jsx';
import { ChargeBankDeposit } from './extended-info/bank-deposit.js';
import { ChargeMatches } from './extended-info/charge-matches.js';
import { ConversionInfo } from './extended-info/conversion-info.jsx';
import { CreditcardTransactionsInfo } from './extended-info/creditcard-transactions-info.jsx';
import { ExchangeRates } from './extended-info/exchange-rates.js';
import { ChargeMiscExpensesTable } from './extended-info/misc-expenses.jsx';
import { SalariesTable } from './extended-info/salaries-info.jsx';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query FetchCharge($chargeId: UUID!) {
    charge(chargeId: $chargeId) {
      __typename
      id
      metadata {
        transactionsCount
        documentsCount
        receiptsCount
        invoicesCount
        ledgerCount
        isLedgerLocked
        openDocuments
      }
      totalAmount {
        raw
      }
      ...DocumentsGalleryFields @defer
      ...TableDocumentsFields @defer
      ...ChargeLedgerRecordsTableFields @defer
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

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment TableDocumentsFields on Charge {
    id
    additionalDocuments {
      id
      ...TableDocumentsRowFields
    }
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ChargeLedgerRecordsTableFields on Charge {
    id
    ledger {
      __typename
      records {
        id
        ...LedgerRecordsTableFields
      }
      ... on Ledger @defer {
        validate {
          ... on LedgerValidation @defer {
            matches
            differences {
              id
              ...LedgerRecordsTableFields
            }
          }
        }
      }
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
  const [charge, setCharge] = useState<FetchChargeQuery['charge'] | undefined>(undefined);
  const [{ data, fetching }, refetchExtensionInfo] = useQuery({
    query: FetchChargeDocument,
    variables: {
      chargeId,
    },
  });

  const onExtendedChange = useCallback(() => {
    refetchExtensionInfo();
    onChange();
  }, [refetchExtensionInfo, onChange]);

  useEffect(() => {
    if (data?.charge) {
      setCharge(data.charge);
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

  const chargeType = charge?.__typename;

  const hasLedgerRecords = !!charge?.metadata?.ledgerCount;
  const hasTransactions = !!charge?.metadata?.transactionsCount;
  const hasDocs = !!charge?.metadata?.documentsCount;
  const hasReceipts = !!charge?.metadata?.receiptsCount;
  const hasInvoices = !!charge?.metadata?.invoicesCount;
  const isSalaryCharge = chargeType === 'SalaryCharge';
  const hasMiscExpenses = !!charge?.miscExpenses?.length;
  const hasOpenDocuments = charge?.metadata?.openDocuments;
  const isIncomeNoDocsCharge = (charge?.totalAmount?.raw ?? 0) > 0 && !hasReceipts;
  const hasAccountingDocs = hasInvoices || hasReceipts;
  const missingMatches = !hasAccountingDocs || !hasTransactions;

  useEffect(() => {
    if (hasTransactions) {
      setAccordionItems(items =>
        items.includes('transactions') ? items : [...items, 'transactions'],
      );
    }
  }, [hasTransactions]);

  useEffect(() => {
    if (hasDocs) {
      setAccordionItems(items => (items.includes('documents') ? items : [...items, 'documents']));
    }
  }, [hasDocs]);

  useEffect(() => {
    if (hasLedgerRecords) {
      setAccordionItems(items => (items.includes('ledger') ? items : [...items, 'ledger']));
    }
  }, [hasLedgerRecords]);

  useEffect(() => {
    if (isSalaryCharge) {
      setAccordionItems(items => (items.includes('salaries') ? items : [...items, 'salaries']));
    }
  }, [isSalaryCharge]);

  useEffect(() => {
    if (hasMiscExpenses) {
      setAccordionItems(items =>
        items.includes('miscExpenses') ? items : [...items, 'miscExpenses'],
      );
    }
  }, [hasMiscExpenses]);

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
    ChargeLedgerRecordsTableFieldsFragmentDoc,
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
            type="multiple"
            value={accordionItems}
            onValueChange={setAccordionItems}
          >
            {chargeType === 'ConversionCharge' && (
              <AccordionItem value="conversion">
                <AccordionTrigger disabled={!hasTransactions}>Conversion Info</AccordionTrigger>
                <AccordionContent>
                  {conversionIsReady && (
                    <ConversionInfo
                      chargeProps={charge as FragmentType<typeof ConversionChargeInfoFragmentDoc>}
                    />
                  )}
                </AccordionContent>
              </AccordionItem>
            )}
            {chargeType === 'FinancialCharge' && (
              <AccordionItem value="exchangeRates">
                <AccordionTrigger disabled={!exchangeRatesAreReady}>
                  Exchange Rates
                </AccordionTrigger>
                <AccordionContent>
                  {exchangeRatesAreReady && (
                    <ExchangeRates
                      chargeProps={charge as FragmentType<typeof ExchangeRatesInfoFragmentDoc>}
                    />
                  )}
                </AccordionContent>
              </AccordionItem>
            )}
            {hasTransactions && (
              <AccordionItem value="transactions">
                <AccordionTrigger disabled={!hasTransactions}>
                  <div className="flex flex-row items-center gap-2 justify-between w-full">
                    Transactions
                    {isIncomeNoDocsCharge && <PreviewDocumentModal chargeId={charge!.id} />}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {transactionsAreReady && (
                    <ChargeTransactionsTable
                      transactionsProps={charge}
                      onChange={onExtendedChange}
                    />
                  )}
                </AccordionContent>
              </AccordionItem>
            )}
            {hasMiscExpenses && (
              <AccordionItem value="miscExpenses">
                <AccordionTrigger disabled={!hasMiscExpenses}>Misc Expenses</AccordionTrigger>
                <AccordionContent>
                  {miscExpensesAreReady && (
                    <ChargeMiscExpensesTable
                      miscExpensesData={charge}
                      onChange={onExtendedChange}
                    />
                  )}
                </AccordionContent>
              </AccordionItem>
            )}
            {hasDocs && (
              <AccordionItem value="documents">
                <AccordionTrigger disabled={!hasDocs}>
                  <div className="flex flex-row items-center gap-2 justify-between w-full">
                    <div className="flex flex-row items-center gap-2 justify-start">
                      {hasDocs && (
                        <Tooltip content="Documents Gallery">
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
                    {hasOpenDocuments && <PreviewDocumentModal chargeId={charge.id} />}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {docsAreReady && (
                    <DocumentsTable
                      documentsProps={
                        getFragmentData(TableDocumentsFieldsFragmentDoc, charge)
                          ?.additionalDocuments
                      }
                      onChange={onExtendedChange}
                    />
                  )}
                </AccordionContent>
              </AccordionItem>
            )}
            {chargeType === 'SalaryCharge' && (
              <AccordionItem value="salaries">
                <AccordionTrigger disabled={!isSalaryCharge}>Salaries</AccordionTrigger>
                <AccordionContent>
                  {salariesAreReady && <SalariesTable salaryRecordsProps={charge} />}
                </AccordionContent>
              </AccordionItem>
            )}
            {charge.__typename === 'BusinessTripCharge' && (
              <AccordionItem value="businessTrip">
                <AccordionTrigger>Business Trip</AccordionTrigger>
                <AccordionContent>
                  <BusinessTripSummarizedReport data={charge.businessTrip!} />
                </AccordionContent>
              </AccordionItem>
            )}
            {chargeType === 'CreditcardBankCharge' && (
              <AccordionItem value="creditcard">
                <AccordionTrigger>CreditCard Transactions</AccordionTrigger>
                <AccordionContent>
                  {creditcardTransactionsAreReady && (
                    <CreditcardTransactionsInfo
                      chargeProps={
                        charge as FragmentType<typeof CreditcardBankChargeInfoFragmentDoc>
                      }
                    />
                  )}
                </AccordionContent>
              </AccordionItem>
            )}

            {hasLedgerRecords && (
              <AccordionItem value="ledger">
                <AccordionTrigger
                  disabled={!hasLedgerRecords}
                  onClick={event => {
                    event.stopPropagation();
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
                </AccordionTrigger>
                <AccordionContent>
                  {ledgerRecordsAreReady && <ChargeLedgerTable data={charge} />}
                </AccordionContent>
              </AccordionItem>
            )}

            {chargeType === 'BankDepositCharge' && (
              <AccordionItem value="bankDeposit">
                <AccordionTrigger>Bank Deposit</AccordionTrigger>
                <AccordionContent>
                  <ChargeBankDeposit chargeId={charge.id} />
                </AccordionContent>
              </AccordionItem>
            )}

            {missingMatches && (
              <ChargeMatches
                chargeId={charge.id}
                onChange={onExtendedChange}
                isOpened={accordionItems.includes('charges-matches')}
              />
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

type ChargeLedgerTableProps = {
  data: FragmentType<typeof ChargeLedgerRecordsTableFieldsFragmentDoc>;
};

export const ChargeLedgerTable = ({ data }: ChargeLedgerTableProps): ReactElement => {
  const { ledger } = getFragmentData(ChargeLedgerRecordsTableFieldsFragmentDoc, data);

  return (
    <LedgerTable
      ledgerRecordsData={ledger.records}
      ledgerDiffData={ledger.validate?.differences}
      matches={ledger.validate?.matches}
    />
  );
};
