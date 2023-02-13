import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from 'urql';
import { FinancialEntityOldDocument } from '../../../gql/graphql';
import { businesses, DEFAULT_FINANCIAL_ENTITY_ID } from '../../../helpers';
import { useSql } from '../../../hooks/use-sql';
import type { TransactionColumn, TransactionType } from '../../../models/types';
import { AccounterBasicTable } from '../../common';
import { TransactionRow } from './transaction-row';

/* GraphQL */ `
  query FinancialEntityOld($financialEntityId: ID!, $page: Int, $limit: Int) {
    financialEntity(id: $financialEntityId) {
      id
      charges(page: $page, limit: $limit) {
        nodes {
          ...ChargeFields
          id
        }
      }
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
      : DEFAULT_FINANCIAL_ENTITY_ID;

  const [{ data }] = useQuery({
    query: FinancialEntityOldDocument,
    variables: { financialEntityId },
  });

  const { getAllTransactions } = useSql();
  const [allTransactions, setAllTransactions] = useState<TransactionType[]>([]);

  useEffect(() => {
    getAllTransactions(financialEntity).then(setAllTransactions);
  }, [getAllTransactions, financialEntity]);

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
    <AccounterBasicTable
      content={
        <>
          <thead>
            <tr>
              {columns.map(key => (
                <th key={key}>{key}</th>
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
                chargeProps={data?.financialEntity.charges.nodes.find(
                  charge => charge.id === row.id,
                )}
              />
            ))}
          </tbody>
        </>
      }
    />
  );
};
