import { FC, useEffect, useState } from 'react';
import { useSql } from '../../../hooks/useSql';
import type { TransactionColumn, TransactionType } from '../../../models/types';
import { TransactionRow } from './TransactionRow';

export const AllTransactionsString: FC = () => {
  const { getAllTransactions } = useSql();
  const [allTransactions, setAllTransactions] = useState<TransactionType[]>([]);

  useEffect(() => {
    getAllTransactions().then(setAllTransactions);
  }, []);

  const columns: TransactionColumn[] = [
    'Date',
    'Amount',
    'Entity',
    'Description',
    'Category',
    'VAT',
    'Account',
    'Share with',
    'Tax category',
    'Bank Description',
    'Invoice Img',
    'Invoice Date',
    'Invoice Number',
    'Invoice File',
    'Receipt Image',
    'Receipt Date',
    'Receipt Number',
    'Receipt URL',
    'Links',
  ];

  return (
    <table>
      <thead>
        <tr>
          {columns.map((key) => (
            <th>{key}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {allTransactions.map((row, i) => (
          <TransactionRow
            transaction={row}
            columns={columns}
            index={i}
            key={row.id}
          />
        ))}
      </tbody>
    </table>
  );
};
