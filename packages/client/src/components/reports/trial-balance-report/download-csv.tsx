import type { ReactElement } from 'react';
import { TimelessDateString } from '../../../helpers/dates.js';
import { ExtendedSortCode } from './trial-balance-report-sort-code.js';
import { SortCodeGroup } from './trial-balance-table.js';

interface Props {
  data: Record<number, SortCodeGroup>;
  fromDate?: TimelessDateString;
  toDate?: TimelessDateString;
}

export const DownloadCSV = ({ data, fromDate, toDate }: Props): ReactElement => {
  const downloadCSV = (): void => {
    const csvData = new Blob([convertToCSV(data)], { type: 'text/csv;charset=utf-8' });
    const csvURL = URL.createObjectURL(csvData);
    const link = document.createElement('a');
    link.href = csvURL;
    link.download = `trial_balance_report${fromDate ? `_${fromDate}` : ''}${toDate ? `_${toDate}` : ''}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return <button onClick={downloadCSV}>Download CSV</button>;
};

const convertToCSV = (sortCodesGroups: Record<number, SortCodeGroup>): string => {
  let csvString = '';

  csvString += 'Sort Code,Account Name,Debit,Credit,Balance\r\n';

  for (const [group, groupData] of Object.entries(sortCodesGroups)) {
    const stringifiedGroup = handleGroupData(group, groupData);
    csvString += stringifiedGroup;
  }

  csvString += `Report total:,,${Object.values(sortCodesGroups).reduce(
    (totalDebit, row) => totalDebit + row.totalDebit,
    0,
  )},${Object.values(sortCodesGroups).reduce(
    (totalCredit, row) => totalCredit + row.totalCredit,
    0,
  )},${Object.values(sortCodesGroups).reduce((total, row) => total + row.sum, 0)}\r\n`;

  return csvString;
};

function handleGroupData(sortCode: string, groupData: SortCodeGroup): string {
  let groupString = '';

  Object.values(groupData.sortCodes)
    .sort((a, b) => a.id - b.id)
    .map(sortCode => {
      const sortCodeString = handleSortCode(sortCode);
      groupString += sortCodeString;
    });

  groupString += `${sortCode.replaceAll('0', '*')},Group Total:,${groupData.totalDebit ?? ''},${
    groupData.totalCredit ?? ''
  },${groupData.sum}\r\n`;
  return groupString;
}

function handleSortCode(sortCode: ExtendedSortCode): string {
  let sortCodeString = '';

  sortCodeString += `${sortCode.name}\r\n`;

  sortCode.records
    .sort((a, b) => a.business.name.localeCompare(b.business.name))
    .map(record => {
      const rowTotal = record?.total?.raw ?? 0;
      const rowDebit = record?.debit?.raw ?? 0;
      const rowCredit = record?.credit?.raw ?? 0;
      const recordString = `${sortCode.id},${record.business.name ? `"${sanitizeString(record.business.name)}"` : ''},${rowDebit ? record?.debit?.raw : undefined},${rowCredit ? record?.credit?.raw : undefined},${rowTotal > 0.001 || rowTotal < -0.001 ? (record?.total?.raw ?? '') : ''}\r\n`;
      sortCodeString += recordString;
    });
  const sortCodeSum = `${sortCode.id},Group total:,${sortCode.totalDebit ?? ''},${sortCode.totalCredit ?? ''},${sortCode.sum}\r\n`;
  sortCodeString += sortCodeSum;
  const sortCodeSumDebit = sortCode.debit ? `,,,Total Debit Balances:,${sortCode.debit}\r\n` : '';
  sortCodeString += sortCodeSumDebit;
  const sortCodeSumCredit = sortCode.credit
    ? `,,,Total Credit Balances:,${sortCode.credit}\r\n`
    : '';
  sortCodeString += sortCodeSumCredit;
  return sortCodeString;
}

function sanitizeString(desc: string): string {
  let itemDesc = '';
  itemDesc = desc.replace(/"/g, '""');
  return itemDesc;
}
