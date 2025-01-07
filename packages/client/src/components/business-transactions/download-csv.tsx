import type { ReactElement } from 'react';
import { format } from 'date-fns';
import { FileDown } from 'lucide-react';
import { Tooltip } from '@mantine/core';
import { Currency } from '../../gql/graphql.js';
import { currencyCodeToSymbol, type TimelessDateString } from '../../helpers/index.js';
import type { ExtendedTransaction } from './business-extended-info.js';

interface Props {
  transactions: Array<ExtendedTransaction>;
  businessName: string;
  fromDate?: TimelessDateString;
  toDate?: TimelessDateString;
}

export const DownloadCSV = ({
  transactions,
  businessName,
  fromDate,
  toDate,
}: Props): ReactElement => {
  const downloadCSV = (): void => {
    const csvData = new Blob([convertToCSV(transactions)], { type: 'text/csv;charset=utf-8' });
    const csvURL = URL.createObjectURL(csvData);
    const link = document.createElement('a');
    link.href = csvURL;
    link.download = `business_${businessName}_transactions${fromDate ? `_${fromDate}` : ''}${toDate ? `_${toDate}` : ''}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <button onClick={downloadCSV}>
      <Tooltip label="Download CSV" position="top">
        <FileDown />
      </Tooltip>
    </button>
  );
};

const convertToCSV = (transactions: Array<ExtendedTransaction>): string => {
  let csvString = '';

  const currencies = Array.from(
    new Set(
      transactions.filter(t => t.foreignAmount?.currency).map(t => t.foreignAmount!.currency),
    ),
  );

  csvString += `Sorting Date,Date,Amount,Amount Balance,${getHeadersFromForeignCurrencies(currencies)}Reference,Details,Counter Account\r\n`;

  for (const transaction of transactions) {
    const stringifiedTransaction = handleTransaction(transaction, currencies);
    csvString += stringifiedTransaction;
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
  transaction: ExtendedTransaction,
  currencies: Array<Currency>,
): string {
  let amounts = '';
  currencies.map(currency => {
    if (transaction.foreignAmount && transaction.foreignAmount.currency === currency) {
      amounts += `${transaction.foreignAmount.raw},${transaction[`${currency.toLowerCase()}Balance` as keyof ExtendedTransaction] ?? 0},`;
    } else {
      amounts += ',,';
    }
    const currencySymbol = currencyCodeToSymbol(currency);
    amounts += `${currency}(${currencySymbol}) Amount,${currency}(${currencySymbol}) Balance,`;
  });
  return amounts;
}

function handleTransaction(transaction: ExtendedTransaction, currencies: Array<Currency>): string {
  let transactionString = '';

  const sortingDate = transaction.invoiceDate
    ? format(new Date(transaction.invoiceDate), 'yyy-MM-dd')
    : null;
  const date = transaction.invoiceDate
    ? format(new Date(transaction.invoiceDate), 'dd/MM/yy')
    : null;
  const ilsAmount = transaction.amount.raw;
  const { ilsBalance, reference, details } = transaction;
  const counterAccount = transaction.counterAccount?.name ?? '';

  transactionString += `${sortingDate},${date},${ilsAmount},${ilsBalance},${getAmountsFromForeignCurrencies(transaction, currencies)}${sanitizeString(reference ?? '')},${sanitizeString(details ?? '')},${sanitizeString(counterAccount)},\r\n`;
  return transactionString;
}

function sanitizeString(desc: string): string {
  let itemDesc = '';
  itemDesc = desc.replace(/"/g, '""');
  return itemDesc;
}
