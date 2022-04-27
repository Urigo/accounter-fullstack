import { FC, useEffect, useState } from 'react';
import { useSql } from '../../../hooks/useSql';
import type { TransactionColumn, TransactionType } from '../../../models/types';
import { TransactionRow } from './TransactionRow';
import { useSearchParams } from 'react-router-dom';

export const AllTransactionsString: FC = () => {
  let [searchParams] = useSearchParams();
  const financialEntity = searchParams.get('financialEntity');

  const { getAllTransactions } = useSql();
  const [allTransactions, setAllTransactions] = useState<TransactionType[]>([]);

  useEffect(() => {
    getAllTransactions(financialEntity).then(setAllTransactions);
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
