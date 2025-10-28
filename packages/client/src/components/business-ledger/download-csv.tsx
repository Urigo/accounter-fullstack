import { useCallback, type ReactElement } from 'react';
import { format } from 'date-fns';
import { Currency } from '../../gql/graphql.js';
import { currencyCodeToSymbol, type TimelessDateString } from '../../helpers/index.js';
import { DownloadCSVButton } from '../common/index.js';
import type { ExtendedLedger } from './business-extended-info.js';

interface Props {
  ledgerRecords: Array<ExtendedLedger>;
  businessName: string;
  fromDate?: TimelessDateString;
  toDate?: TimelessDateString;
}

export const DownloadCSV = ({
  ledgerRecords,
  businessName,
  fromDate,
  toDate,
}: Props): ReactElement => {
  const createFileVariables = useCallback(async () => {
    const csvData = convertToCSV(ledgerRecords);
    const fileName = `business_${businessName}_ledger_records${fromDate ? `_${fromDate}` : ''}${toDate ? `_${toDate}` : ''}`;
    return {
      fileName,
      fileContent: csvData,
    };
  }, [ledgerRecords, businessName, fromDate, toDate]);

  return <DownloadCSVButton createFileVariables={createFileVariables} />;
};

const convertToCSV = (ledgerRecords: Array<ExtendedLedger>): string => {
  let csvString = '';

  const currencies = Array.from(
    new Set(
      ledgerRecords.filter(t => t.foreignAmount?.currency).map(t => t.foreignAmount!.currency),
    ),
  );

  csvString += `Sorting Date,Date,Amount,Amount Balance,${getHeadersFromForeignCurrencies(currencies)}Reference,Details,Counter Account\r\n`;

  for (const record of ledgerRecords) {
    const stringifiedRecord = handleLedgerRecord(record, currencies);
    csvString += stringifiedRecord;
  }

  return csvString;
};

function getHeadersFromForeignCurrencies(currencies: Array<Currency>): string {
  let headers = '';
  currencies.map(currency => {
    const currencySymbol = currencyCodeToSymbol(currency);
    headers += `${currency}(${currencySymbol}) Amount,${currency}(${currencySymbol}) Balance,`;
  });
  return headers;
}

function getAmountsFromForeignCurrencies(
  ledgerRecord: ExtendedLedger,
  currencies: Array<Currency>,
): string {
  let amounts = '';
  currencies.map(currency => {
    if (ledgerRecord.foreignAmount && ledgerRecord.foreignAmount.currency === currency) {
      amounts += `${ledgerRecord.foreignAmount.raw},${ledgerRecord[`${currency.toLowerCase()}Balance` as keyof ExtendedLedger] ?? 0},`;
    } else {
      amounts += ',,';
    }
  });
  return amounts;
}

function handleLedgerRecord(ledgerRecord: ExtendedLedger, currencies: Array<Currency>): string {
  let ledgerRecordString = '';

  const sortingDate = ledgerRecord.invoiceDate
    ? format(new Date(ledgerRecord.invoiceDate), 'yyy-MM-dd')
    : null;
  const date = ledgerRecord.invoiceDate
    ? format(new Date(ledgerRecord.invoiceDate), 'dd/MM/yy')
    : null;
  const ilsAmount = ledgerRecord.amount.raw;
  const { ilsBalance, reference, details } = ledgerRecord;
  const counterAccount = ledgerRecord.counterAccount?.name ?? '';

  ledgerRecordString += `${sortingDate},${date},${ilsAmount},${ilsBalance},${getAmountsFromForeignCurrencies(ledgerRecord, currencies)}${sanitizeString(reference ?? '')},${sanitizeString(details ?? '')},${sanitizeString(counterAccount)},\r\n`;
  return ledgerRecordString;
}

function sanitizeString(content: string | number): string {
  if (content === '') {
    return '';
  }
  if (!Number.isNaN(Number(content))) {
    return Number(content).toFixed(2).toString();
  }
  const cleanContent = String(content).replace(/"/g, '""').replace(/,/g, '.');
  return cleanContent;
}
