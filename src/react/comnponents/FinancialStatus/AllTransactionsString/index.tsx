import { FC } from 'react';
import type { TransactionColumn, TransactionType } from '../../../models/types';
import { TransactionRow } from './TransactionRow';

// /* sql req */
// pool.query(`
//       select *
//       from accounter_schema.all_transactions
//       -- where account_number in ('466803', '1074', '1082')
//       order by event_date desc
//       limit 2550;
//     `)

export const AllTransactionsString: FC = () => {
  // TODO: fetch all transactions data from DB
  const allTransactions: TransactionType[] = [];

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
          <TransactionRow transaction={row} columns={columns} index={i} />
        ))}
      </tbody>
    </table>
  );
};
