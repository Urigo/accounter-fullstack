import { FC, useEffect, useState } from 'react';
import { useSql } from '../../../hooks/useSql';
import type { TransactionColumn, TransactionType } from '../../../models/types';
import { TransactionRow } from './TransactionRow';
import { useSearchParams } from 'react-router-dom';
import { gql } from 'graphql-request';
import { useGraphql } from '../../../hooks/useGraphql';

const ledgerRecordsQuery = gql`
  {
    financialEntity(id: "6a20aa69-57ff-446e-8d6a-1e96d095e988") {
      accounts {
        id
      }
      charges {
        id
        ledgerRecords {
          id
          date
          originalAmount {
            formatted
          }
          localCurrencyAmount {
            formatted
          }
          creditAccount {
            name
          }
          debitAccount {
            name
          }
          accountantApproval {
            approved
          }
          description
          hashavshevetId
        }
      }
    }
  }
`;

export const AllTransactionsString: FC = () => {
  let [searchParams] = useSearchParams();
  const financialEntity = searchParams.get('financialEntity');

  const { getAllTransactions } = useSql();
  const [allTransactions, setAllTransactions] = useState<TransactionType[]>([]);
  const { request } = useGraphql();
  const [ledgerRecords, setLedgerRecords] = useState<any>(undefined);

  useEffect(() => {
    request(ledgerRecordsQuery).then(setLedgerRecords);
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
            charge={
              ledgerRecords?.financialEntity?.charges &&
              ledgerRecords.financialEntity.charges.find(
                (charge: any) => charge.id === row.id
              )
            }
          />
        ))}
      </tbody>
    </table>
  );
};
