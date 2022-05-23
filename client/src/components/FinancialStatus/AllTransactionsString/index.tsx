import { useEffect, useState } from 'react';
import { useSql } from '../../../hooks/useSql';
import type { TransactionColumn, TransactionType } from '../../../models/types';
import { TransactionRow } from './TransactionRow';
import { useSearchParams } from 'react-router-dom';
import gql from 'graphql-tag';
import { useFinancialEntityOldQuery } from '../../../__generated__/types';
import { businesses } from '../../../helpers';

gql`
  query FinancialEntityOld($financialEntityId: ID!) {
    financialEntity(id: $financialEntityId) {
      ...Charges
    }
  }
`;

export const AllTransactionsString = () => {
  const [searchParams] = useSearchParams();
  const financialEntity = searchParams.get('financialEntity');

  // TODO: improve the ID logic
  const financialEntityId =
    financialEntity === 'Guild'
      ? businesses['Software Products Guilda Ltd.']
      : financialEntity === 'UriLTD'
      ? businesses['Uri Goldshtein LTD']
      : '6a20aa69-57ff-446e-8d6a-1e96d095e988';

  const { data } = useFinancialEntityOldQuery({
    financialEntityId,
  });

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
          {columns.map(key => (
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
            charge={data?.financialEntity?.charges && data.financialEntity.charges.find(charge => charge.id === row.id)}
          />
        ))}
      </tbody>
    </table>
  );
};
