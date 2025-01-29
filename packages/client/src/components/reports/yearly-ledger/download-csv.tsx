import type { ReactElement } from 'react';
import { format } from 'date-fns';
import { LedgerCsvFieldsFragmentDoc, type LedgerCsvFieldsFragment } from '../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../gql/index.js';
import { DownloadCSVButton } from '../../common/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment LedgerCsvFields on LedgerRecord {
    id
    invoiceDate
    valueDate
    description
    reference
    debitAccount1 {
      id
      name
    }
    debitAmount1 {
      raw
      currency
    }
    localCurrencyDebitAmount1 {
      raw
      currency
    }
    debitAccount2 {
      id
      name
    }
    debitAmount2 {
      raw
    }
    localCurrencyDebitAmount2 {
      raw
    }
    creditAccount1 {
      id
      name
    }
    creditAmount1 {
      raw
    }
    localCurrencyCreditAmount1 {
      raw
    }
    creditAccount2 {
      id
      name
    }
    creditAmount2 {
      raw
    }
    localCurrencyCreditAmount2 {
      raw
    }
  }
`;

interface Props {
  data: FragmentType<typeof LedgerCsvFieldsFragmentDoc>[];
  year: number;
}

export const DownloadCSV = ({ data, year }: Props): ReactElement => {
  const ledgerRecords = data.map(rawRecord =>
    getFragmentData(LedgerCsvFieldsFragmentDoc, rawRecord),
  );

  const csvData = convertToCSV(ledgerRecords);
  const fileName = `${year}_ledger`;

  return <DownloadCSVButton data={csvData} fileName={fileName} />;
};

type DataStructure<T> = { key: string; valueFn: (record: T) => string | number }[];
const dataRow: DataStructure<LedgerCsvFieldsFragment> = [
  { key: 'Invoice Date', valueFn: record => format(record.invoiceDate, 'yyyy-MM-dd') },
  { key: 'Value Date', valueFn: record => format(record.valueDate, 'yyyy-MM-dd') },
  {
    key: 'Description',
    valueFn: record => (record.description ? `"${sanitizeString(record.description)}"` : ''),
  },
  {
    key: 'Reference',
    valueFn: record => (record.reference ? `"${sanitizeString(record.reference)}"` : ''),
  },
  {
    key: 'Currency',
    valueFn: record => record.debitAmount1?.currency ?? record.localCurrencyDebitAmount1.currency,
  },
  {
    key: 'Debit1 Account',
    valueFn: record =>
      record.debitAccount1?.name ? `"${sanitizeString(record.debitAccount1.name)}"` : '',
  },
  { key: 'Debit1 Amount', valueFn: record => record.debitAmount1?.raw ?? '' },
  { key: 'Debit1 Amount (ILS)', valueFn: record => record.localCurrencyDebitAmount1?.raw ?? '' },
  {
    key: 'Debit2 Account',
    valueFn: record =>
      record.debitAccount2?.name ? `"${sanitizeString(record.debitAccount2.name)}"` : '',
  },
  { key: 'Debit2 Amount', valueFn: record => record.debitAmount2?.raw ?? '' },
  { key: 'Debit2 Amount (ILS)', valueFn: record => record.localCurrencyDebitAmount2?.raw ?? '' },
  {
    key: 'Credit1 Account',
    valueFn: record =>
      record.creditAccount1?.name ? `"${sanitizeString(record.creditAccount1.name)}"` : '',
  },
  { key: 'Credit1 Amount', valueFn: record => record.creditAmount1?.raw ?? '' },
  { key: 'Credit1 Amount (ILS)', valueFn: record => record.localCurrencyCreditAmount1?.raw ?? '' },
  {
    key: 'Credit2 Account',
    valueFn: record =>
      record.creditAccount2?.name ? `"${sanitizeString(record.creditAccount2.name)}"` : '',
  },
  { key: 'Credit2 Amount', valueFn: record => record.creditAmount2?.raw ?? '' },
  { key: 'Credit2 Amount (ILS)', valueFn: record => record.localCurrencyCreditAmount2?.raw ?? '' },
];

const convertToCSV = (ledgerRecords: LedgerCsvFieldsFragment[]): string => {
  const rows = [
    dataRow.map(({ key }) => key).join(','),
    ...ledgerRecords.map(record => dataRow.map(({ valueFn }) => valueFn(record)).join(',')),
  ];
  return rows.join('\r\n');
};

function sanitizeString(desc: string): string {
  let itemDesc = '';
  itemDesc = desc.replace(/"/g, '""');
  return itemDesc;
}
