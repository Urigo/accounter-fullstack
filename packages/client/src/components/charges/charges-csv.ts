import { format } from 'date-fns';
import {
  MissingChargeInfo,
  TableDocumentsRowFieldsFragmentDoc,
  TransactionForTransactionsTableFieldsFragmentDoc,
  type ChargeForCsvExportFieldsFragment,
  type TableDocumentsRowFieldsFragment,
  type TransactionForTransactionsTableFieldsFragment,
} from '../../gql/graphql.js';
import { getFragmentData } from '../../gql/index.js';

// Pure CSV-building logic for the charges export, kept free of React/urql/barrel imports so it can
// be unit-tested in isolation (the component barrel drags heavy deps like pdfjs into the test env).

type ColumnDef = { key: string; valueFn: (charge: ChargeForCsvExportFieldsFragment) => string };

const columns: ColumnDef[] = [
  { key: 'Charge ID', valueFn: charge => charge.id },
  { key: 'Type', valueFn: charge => charge.__typename ?? '' },
  {
    key: 'Date',
    valueFn: charge =>
      formatDate(charge.minDebitDate ?? charge.minEventDate ?? charge.minDocumentsDate),
  },
  { key: 'Event Date', valueFn: charge => formatDate(charge.minEventDate) },
  { key: 'Documents Date', valueFn: charge => formatDate(charge.minDocumentsDate) },
  { key: 'Counterparty', valueFn: charge => charge.counterparty?.name ?? '' },
  { key: 'Description', valueFn: charge => charge.userDescription?.trim() ?? '' },
  { key: 'Tags', valueFn: charge => (charge.tags ?? []).map(tag => tag.name).join('; ') },
  { key: 'Tax Category', valueFn: charge => charge.taxCategory?.name ?? '' },
  {
    key: 'Business Trip',
    valueFn: charge =>
      'businessTrip' in charge && charge.businessTrip ? charge.businessTrip.name : '',
  },
  { key: 'Accountant Approval', valueFn: charge => charge.accountantApproval ?? '' },
  { key: 'Amount', valueFn: charge => formatNumber(charge.totalAmount?.raw) },
  { key: 'Currency', valueFn: charge => charge.totalAmount?.currency ?? '' },
  { key: 'VAT', valueFn: charge => formatNumber(charge.vat?.raw) },
  { key: 'Is Valid', valueFn: charge => formatBoolean(charge.validationData?.isValid) },
  ...missingInfoColumns(),
  {
    key: 'Valid Credit Card Amount',
    valueFn: charge =>
      'validCreditCardAmount' in charge ? formatBoolean(charge.validCreditCardAmount) : '',
  },
  { key: 'Ledger Status', valueFn: charge => charge.metadata?.invalidLedger ?? '' },
  { key: 'Ledger Balanced', valueFn: charge => formatBoolean(charge.ledger?.balance?.isBalanced) },
  { key: 'Ledger Errors', valueFn: charge => (charge.ledger?.validate?.errors ?? []).join('; ') },
  { key: 'Transactions Count', valueFn: charge => formatCount(charge.metadata?.transactionsCount) },
  { key: 'Documents Count', valueFn: charge => formatCount(charge.metadata?.documentsCount) },
  { key: 'Invoices Count', valueFn: charge => formatCount(charge.metadata?.invoicesCount) },
  { key: 'Receipts Count', valueFn: charge => formatCount(charge.metadata?.receiptsCount) },
  { key: 'Ledger Count', valueFn: charge => formatCount(charge.metadata?.ledgerCount) },
  {
    key: 'Misc Expenses Count',
    valueFn: charge => formatCount(charge.metadata?.miscExpensesCount),
  },
  { key: 'Has Open Documents', valueFn: charge => formatBoolean(charge.metadata?.openDocuments) },
  {
    key: 'Suggested Description',
    valueFn: charge => charge.missingInfoSuggestions?.description?.trim() ?? '',
  },
  {
    key: 'Suggested Tags',
    valueFn: charge => (charge.missingInfoSuggestions?.tags ?? []).map(tag => tag.name).join('; '),
  },
  { key: 'Transactions Detail', valueFn: charge => transactionsDetail(charge) },
  { key: 'Documents Detail', valueFn: charge => documentsDetail(charge) },
];

// One boolean column per missing-info type so a reviewer can filter/scan each dimension.
function missingInfoColumns(): ColumnDef[] {
  const entries: Array<[string, MissingChargeInfo]> = [
    ['Missing Counterparty', MissingChargeInfo.Counterparty],
    ['Missing Description', MissingChargeInfo.Description],
    ['Missing Documents', MissingChargeInfo.Documents],
    ['Missing Tags', MissingChargeInfo.Tags],
    ['Missing Transactions', MissingChargeInfo.Transactions],
    ['Missing VAT', MissingChargeInfo.Vat],
    ['Missing Tax Category', MissingChargeInfo.TaxCategory],
  ];
  return entries.map(([key, info]) => ({
    key,
    valueFn: charge =>
      charge.validationData ? formatBoolean(charge.validationData.missingInfo.includes(info)) : '',
  }));
}

function transactionsDetail(charge: ChargeForCsvExportFieldsFragment): string {
  return (charge.transactions ?? [])
    .map(rawTransaction => {
      const transaction: TransactionForTransactionsTableFieldsFragment = getFragmentData(
        TransactionForTransactionsTableFieldsFragmentDoc,
        rawTransaction,
      );
      return [
        formatDate(transaction.eventDate),
        transaction.amount.formatted ?? formatNumber(transaction.amount.raw),
        transaction.account?.name ?? '',
        transaction.sourceDescription ?? '',
        transaction.referenceKey ?? '',
        transaction.counterparty?.name ?? '',
      ].join(' | ');
    })
    .join('\n');
}

function documentsDetail(charge: ChargeForCsvExportFieldsFragment): string {
  return (charge.additionalDocuments ?? [])
    .map(rawDocument => {
      const document: TableDocumentsRowFieldsFragment = getFragmentData(
        TableDocumentsRowFieldsFragmentDoc,
        rawDocument,
      );
      const isFinancial = 'amount' in document;
      return [
        document.documentType ?? '',
        isFinancial ? formatDate(document.date) : '',
        isFinancial
          ? `${document.amount?.formatted ?? formatNumber(document.amount?.raw)} ${document.amount?.currency ?? ''}`.trim()
          : '',
        isFinancial ? (document.vat?.formatted ?? formatNumber(document.vat?.raw)) : '',
        isFinancial ? (document.serialNumber ?? '') : '',
        isFinancial ? `${document.creditor?.name ?? ''} → ${document.debtor?.name ?? ''}` : '',
      ].join(' | ');
    })
    .join('\n');
}

export function convertChargesToCsv(charges: ChargeForCsvExportFieldsFragment[]): string {
  const header = columns.map(column => escapeCsvField(column.key)).join(',');
  const rows = charges.map(charge =>
    columns.map(column => escapeCsvField(column.valueFn(charge))).join(','),
  );
  return [header, ...rows].join('\r\n');
}

export function escapeCsvField(value: string): string {
  if (value === '') {
    return '';
  }
  // RFC-4180 quoting: wrap in quotes and double any internal quotes when the field carries a
  // comma, quote, or newline (the flattened transactions/documents cells are multiline).
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDate(date?: string | Date | null): string {
  return date ? format(new Date(date), 'yyyy-MM-dd') : '';
}

function formatNumber(value?: number | null): string {
  return value == null ? '' : value.toFixed(2);
}

function formatCount(value?: number | null): string {
  return value == null ? '' : String(value);
}

function formatBoolean(value?: boolean | null): string {
  return value == null ? '' : value ? 'Yes' : 'No';
}
