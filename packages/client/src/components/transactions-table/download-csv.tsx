import { useCallback, useMemo, type ReactElement } from 'react';
import { format } from 'date-fns';
import {
  TransactionToDownloadForTransactionsTableFieldsFragmentDoc,
  type TransactionToDownloadForTransactionsTableFieldsFragment,
} from '../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../gql/index.js';
import { type TimelessDateString } from '../../helpers/index.js';
import { DownloadCSVButton } from '../common/index.js';
import { getAccountTypeLabel } from '../financial-accounts/utils.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment TransactionToDownloadForTransactionsTableFields on Transaction {
    id
    account {
      id
      name
      type
    }
    amount {
      currency
      raw
    }
    counterparty {
      id
      name
    }
    effectiveDate
    eventDate
    referenceKey
    sourceDescription
  }
`;

interface Props {
  rawTransactions: FragmentType<
    typeof TransactionToDownloadForTransactionsTableFieldsFragmentDoc
  >[];
  businessName?: string;
  fromDate?: TimelessDateString;
  toDate?: TimelessDateString;
}

export const DownloadCSV = ({
  rawTransactions,
  businessName,
  fromDate,
  toDate,
}: Props): ReactElement => {
  const transactions = useMemo(() => {
    return rawTransactions.map(rawTransaction => {
      return getFragmentData(
        TransactionToDownloadForTransactionsTableFieldsFragmentDoc,
        rawTransaction,
      );
    });
  }, [rawTransactions]);
  const createFileVariables = useCallback(async () => {
    const csvData = convertToCSV(transactions);
    const fileName = `${businessName ? `business_${businessName}_` : ''}transactions${fromDate ? `_${fromDate}` : ''}${toDate ? `_${toDate}` : ''}`;
    return {
      fileName,
      fileContent: csvData,
    };
  }, [transactions, businessName, fromDate, toDate]);

  return (
    <DownloadCSVButton buttonProps={{ size: 'icon' }} createFileVariables={createFileVariables} />
  );
};

const convertToCSV = (
  transactions: Array<TransactionToDownloadForTransactionsTableFieldsFragment>,
): string => {
  let csvString = '';

  csvString +=
    'Counterparty,Event Date,Debit Date,Amount,Currency,Account Type, Account Name,Description,Reference\r\n';

  for (const transaction of transactions) {
    csvString += stringifyTransaction(transaction);
  }

  return csvString;
};

function stringifyTransaction(
  transaction: TransactionToDownloadForTransactionsTableFieldsFragment,
): string {
  const counterparty = sanitizeString(transaction.counterparty?.name ?? '');

  const eventDate = format(new Date(transaction.eventDate), 'yyyy-MM-dd');
  const debitDate = transaction.effectiveDate
    ? format(new Date(transaction.effectiveDate), 'yyyy-MM-dd')
    : null;
  const { raw: amount, currency } = transaction.amount;
  const accountType = sanitizeString(getAccountTypeLabel(transaction.account.type));
  const accountName = sanitizeString(transaction.account.name);
  const description = sanitizeString(transaction.sourceDescription ?? '');
  const reference = sanitizeString(transaction.referenceKey ?? '');

  const transactionString = `${counterparty},${eventDate},${debitDate},${amount},${currency},${accountType},${accountName},${description},${reference},\r\n`;
  return transactionString;
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
