import { ReactElement } from 'react';
import { FragmentOf, graphql, readFragment } from '../../graphql.js';
import {
  TransactionForTransactionsTableFieldsFragmentDoc,
  TransactionsTable,
} from '../common/index.js';

export const ChargeTableTransactionsFieldsFragmentDoc = graphql(
  `
    fragment ChargeTableTransactionsFields on Charge {
      id
      transactions {
        ...TransactionForTransactionsTableFields
      }
    }
  `,
  [TransactionForTransactionsTableFieldsFragmentDoc],
);

export function isChargeTableTransactionsFieldsFragmentReady(
  data?: object | FragmentOf<typeof ChargeTableTransactionsFieldsFragmentDoc>,
): data is FragmentOf<typeof ChargeTableTransactionsFieldsFragmentDoc> {
  if (!!data && 'transactions' in data && data.transactions != null) {
    console.log('data.transactions', data.transactions);
    return true;
  }
  console.log('not ready');
  return false;
}

type Props = {
  transactionsProps: FragmentOf<typeof ChargeTableTransactionsFieldsFragmentDoc>;
  onChange: () => void;
};

export const ChargeTransactionsTable = ({ transactionsProps, onChange }: Props): ReactElement => {
  const { transactions } = readFragment(
    ChargeTableTransactionsFieldsFragmentDoc,
    transactionsProps,
  );
  return <TransactionsTable transactionsProps={transactions} onChange={onChange} enableEdit />;
};
