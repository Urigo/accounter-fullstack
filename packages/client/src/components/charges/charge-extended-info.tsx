import { useCallback, useContext, useEffect, useMemo, useState, type ReactElement } from 'react';
import { Image } from 'lucide-react';
import { useQuery } from 'urql';
import { Box, Collapse, Loader } from '@mantine/core';
import {
  ChargeExpansionFieldsFragmentDoc,
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
  type ChargeExpansionFieldsFragment,
} from '../../gql/graphql.js';
import { getFragmentData, isFragmentReady, type FragmentType } from '../../gql/index.js';
import { useStableValue } from '../../hooks/use-stable-value.js';
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
import { ChargeErrors } from './charge-errors.js';
import { ChargeTransactionsTable } from './charge-transactions-table.js';
import { BatchChargesExtendedInfoContext } from './charges-extended-info-loader.js';
import { ChargeBankDeposit } from './extended-info/bank-deposit.js';
import { ChargeMatches } from './extended-info/charge-matches.js';
import { ConversionInfo } from './extended-info/conversion-info.js';
import { CreditcardTransactionsInfo } from './extended-info/creditcard-transactions-info.js';
import { ExchangeRates } from './extended-info/exchange-rates.js';
import { ChargeMiscExpensesTable } from './extended-info/misc-expenses.js';
import { SalariesTable } from './extended-info/salaries-info.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query FetchCharge($chargeId: UUID!) {
    charge(chargeId: $chargeId) {
      id
      ...ChargeExpansionFields
    }
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ChargeExpansionFields on Charge {
    id
    __typename
    metadata {
      transactionsCount
      documentsCount
      receiptsCount
      invoicesCount
      ledgerCount
      miscExpensesCount
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
        ...BusinessTripReportFields
      }
    }
    ...ChargesTableErrorsFields @defer
    ...TableMiscExpensesFields @defer
    ...ExchangeRatesInfo @defer
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
  const [opened, setOpened] = useState(false);
  const [chargeState, setChargeState] = useState<ChargeExpansionFieldsFragment | undefined>(
    undefined,
  );

  // When the table is in batch-open mode, a single `chargesByIDs` query (the batch loader) hydrates
  // every expanded row. Consume that shared result instead of firing this component's own
  // `FetchCharge` query — which is paused while the loader is active.
  const batch = useContext(BatchChargesExtendedInfoContext);
  const [{ data, fetching: singleFetching }, refetchExtensionInfo] = useQuery({
    query: FetchChargeDocument,
    variables: {
      chargeId,
    },
    pause: batch.active,
  });

  const incomingCharge = getFragmentData(
    ChargeExpansionFieldsFragmentDoc,
    batch.active ? batch.getCharge(chargeID) : data?.charge,
  );
  const fetching = batch.active ? batch.fetching : singleFetching;

  // Keep a deeply-equal-stable reference so descendants only re-render when the
  // charge actually changed (urql yields a fresh object on every refetch).
  const charge = useStableValue(chargeState);

  const onExtendedChange = useCallback(() => {
    if (batch.active) {
      // A batched charge was mutated: refetch the whole batch so every row stays consistent.
      batch.refetch();
    } else {
      refetchExtensionInfo({ requestPolicy: 'network-only' });
    }
    onChange();
  }, [batch, refetchExtensionInfo, onChange]);

  useEffect(() => {
    const incoming = incomingCharge;
    if (!incoming) {
      return;
    }
    setChargeState(prev => {
      // Different charge (or first load): take the incoming data as-is.
      if (!prev || prev.id !== incoming.id) {
        return incoming;
      }
      // Same charge being refetched: a re-executed `@defer` query delivers its
      // non-deferred fields first and streams the deferred fragments in later
      // patches. Merging the incoming payload over the previous charge keeps the
      // already-loaded sections (`isFragmentReady` checks `field in data`)
      // rendering their last data until each fresh patch arrives — instead of
      // every section collapsing to empty and re-expanding ("blinking").
      // A not-yet-arrived deferred field is absent from the payload, so iterating
      // the present keys naturally retains the previous value; the `undefined`
      // guard is just belt-and-suspenders. Present values (including a legitimate
      // `null`) are applied as they arrive.
      const merged: Record<string, unknown> = { ...prev };
      for (const [key, value] of Object.entries(incoming)) {
        if (value !== undefined) {
          merged[key] = value;
        }
      }
      return merged as ChargeExpansionFieldsFragment;
    });
  }, [incomingCharge]);

  useEffect(() => {
    // The batch loader owns refetching while it's active; only nudge the single-charge query here.
    if (parentFetching && !batch.active) {
      refetchExtensionInfo();
    }
  }, [parentFetching, refetchExtensionInfo, batch.active]);

  // Switching to a different charge: sync the query variable and clear the
  // previous charge so the loader shows (instead of leaking stale details
  // through the `fetching && !charge` gate) until the new charge's data arrives.
  // Done during render — React's supported "adjust state on prop change" pattern
  // — to avoid a painted frame of stale data; urql re-executes the query
  // automatically when the `chargeId` variable changes.
  if (chargeID !== chargeId) {
    setChargeId(chargeID);
    setChargeState(undefined);
  }

  const chargeType = charge?.__typename;

  const hasLedgerRecords = !!charge?.metadata?.ledgerCount;
  const hasTransactions = !!charge?.metadata?.transactionsCount;
  const hasDocs = !!charge?.metadata?.documentsCount;
  const hasReceipts = !!charge?.metadata?.receiptsCount;
  const hasInvoices = !!charge?.metadata?.invoicesCount;
  const isSalaryCharge = chargeType === 'SalaryCharge';
  const hasMiscExpenses = !!charge?.metadata?.miscExpensesCount;
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
    ChargeExpansionFieldsFragmentDoc,
    DocumentsGalleryFieldsFragmentDoc,
    charge,
  );

  const docsAreReady = isFragmentReady(
    ChargeExpansionFieldsFragmentDoc,
    TableDocumentsFieldsFragmentDoc,
    charge,
  );

  const ledgerRecordsAreReady = isFragmentReady(
    ChargeExpansionFieldsFragmentDoc,
    ChargeLedgerRecordsTableFieldsFragmentDoc,
    charge,
  );

  const transactionsAreReady = isFragmentReady(
    ChargeExpansionFieldsFragmentDoc,
    ChargeTableTransactionsFieldsFragmentDoc,
    charge,
  );

  const miscExpensesAreReady = isFragmentReady(
    ChargeExpansionFieldsFragmentDoc,
    TableMiscExpensesFieldsFragmentDoc,
    charge,
  );

  const conversionIsReady = useMemo(() => {
    return (
      chargeType === 'ConversionCharge' &&
      isFragmentReady(ChargeExpansionFieldsFragmentDoc, ConversionChargeInfoFragmentDoc, charge)
    );
  }, [charge, chargeType]);

  const exchangeRatesAreReady = useMemo(() => {
    return (
      chargeType === 'FinancialCharge' &&
      isFragmentReady(ChargeExpansionFieldsFragmentDoc, ExchangeRatesInfoFragmentDoc, charge)
    );
  }, [charge, chargeType]);

  const salariesAreReady =
    chargeType === 'SalaryCharge' &&
    isFragmentReady(ChargeExpansionFieldsFragmentDoc, TableSalariesFieldsFragmentDoc, charge);

  const creditcardTransactionsAreReady = useMemo(
    () =>
      chargeType === 'CreditcardBankCharge' &&
      isFragmentReady(
        ChargeExpansionFieldsFragmentDoc,
        CreditcardBankChargeInfoFragmentDoc,
        charge,
      ),
    [charge, chargeType],
  );

  return (
    <div className="flex flex-col gap-5">
      {isFragmentReady(
        ChargeExpansionFieldsFragmentDoc,
        ChargesTableErrorsFieldsFragmentDoc,
        charge,
      ) && <ChargeErrors data={charge} />}
      {charge ? (
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
                              setOpened(value => !value);
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
      ) : fetching ? (
        <Loader className="flex self-center my-5" color="dark" size="xl" variant="dots" />
      ) : (
        <p>Error fetching extended information for this charge</p>
      )}
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
