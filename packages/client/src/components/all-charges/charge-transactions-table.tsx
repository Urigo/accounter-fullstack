import { ReactElement } from 'react';
import { ChargeTableTransactionsFieldsFragmentDoc } from '../../gql/graphql.js';
import { FragmentOf, graphql, readFragment } from '../../graphql.js';
import { TransactionsTable } from '../common/index.js';

export const TableTransactionsFieldsFragmentDoc = graphql(`
  fragment ChargeTableTransactionsFields on Charge {
    id
    transactions {
      ...TransactionForTransactionsTableFields
    }
  }
`);

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
