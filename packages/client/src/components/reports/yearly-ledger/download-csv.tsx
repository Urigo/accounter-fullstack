import type { ReactElement } from 'react';
import { format } from 'date-fns';
import { LedgerCsvFieldsFragmentDoc, type LedgerCsvFieldsFragment } from '../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../gql/index.js';
import { DownloadCSVButton } from '../../common/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment LedgerCsvFields on YearlyLedgerReport {
    id
    year
    financialEntitiesInfo {
      entity {
        id
        name
        sortCode {
          id
        }
      }
      openingBalance {
        raw
      }
      totalCredit {
        raw
      }
      totalDebit {
        raw
      }
      closingBalance {
        raw
      }
      records {
        id
        amount {
          raw
          formatted
        }
        invoiceDate
        valueDate
        description
        reference
        counterParty {
          id
          name
        }
        balance
      }
    }
  }
`;

interface Props {
  data?: FragmentType<typeof LedgerCsvFieldsFragmentDoc>;
  year: number;
}

export const DownloadCSV = ({ data, year }: Props): ReactElement => {
  if (!data) {
    return <div />;
  }
  const report = getFragmentData(LedgerCsvFieldsFragmentDoc, data);

  const csvData = convertToCSV(report);
  const fileName = `${year}_ledger`;

  return <DownloadCSVButton data={csvData} fileName={fileName} />;
};

type DataStructure<T> = { key: string; valueFn: (record: T) => string | number }[];
const dataRow: DataStructure<
  LedgerCsvFieldsFragment['financialEntitiesInfo'][number]['records'][number]
> = [
  { key: '', valueFn: () => '' },
  { key: '', valueFn: () => '' },
  {
    key: 'Counterparty',
    valueFn: record => sanitizeString(record.counterParty?.name ?? ''),
  },
  { key: 'Invoice Date', valueFn: record => format(record.invoiceDate, 'yyyy-MM-dd') },
  { key: 'Value Date', valueFn: record => format(record.valueDate, 'yyyy-MM-dd') },
  {
    key: 'Reference',
    valueFn: record => (record.reference ? `"${sanitizeString(record.reference)}"` : ''),
  },
  {
    key: 'Description',
    valueFn: record => (record.description ? `"${sanitizeString(record.description)}"` : ''),
  },
  {
    key: 'Debit Amount',
    valueFn: record => (record.amount.raw < 0 ? Math.abs(record.amount.raw).toFixed(2) : ''),
  },
  {
    key: 'Credit Amount',
    valueFn: record => (record.amount.raw >= 0 ? record.amount.raw.toFixed(2) : ''),
  },
  {
    key: 'Balance',
    valueFn: record => record.balance.toFixed(2),
  },
];

const convertToCSV = (ledgerRecords: LedgerCsvFieldsFragment): string => {
  const rows = [dataRow.map(({ key }) => key).join(',')];
  ledgerRecords.financialEntitiesInfo.map(financialEntityInfo => {
    const openingRow1 = `${sanitizeString(financialEntityInfo.entity.name)},${financialEntityInfo.entity.sortCode?.id}`;
    const openingRow2 = `,Opening Balance,,,,,,,,${financialEntityInfo.openingBalance.raw.toFixed(2)}`;
    const closingRow1 = `Total,${sanitizeString(financialEntityInfo.entity.name)},,,,,,,${Math.abs(financialEntityInfo.totalDebit.raw).toFixed(2)} Debit,`;
    const closingRow2 = `,,,,,,,,${financialEntityInfo.totalCredit.raw.toFixed(2)} Credit,${financialEntityInfo.closingBalance.raw.toFixed(2)}`;
    const closingRow3 = `,,,,,,,,${(financialEntityInfo.totalCredit.raw - financialEntityInfo.totalDebit.raw).toFixed(2)} Diff,`;

    rows.push(
      openingRow1,
      openingRow2,
      ...financialEntityInfo.records.map(record =>
        dataRow.map(({ valueFn }) => valueFn(record)).join(','),
      ),
      closingRow1,
      closingRow2,
      closingRow3,
    );
  });
  return rows.join('\r\n');
};

function sanitizeString(desc: string): string {
  const itemDesc = desc.replace(/"/g, '""').replace(/,/g, '.');
  return itemDesc;
}
