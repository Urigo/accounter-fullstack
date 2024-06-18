import { ReactElement } from 'react';
import { ChargeTableTransactionsFieldsFragmentDoc } from '../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../gql/index.js';
import { TransactionsTable } from '../common/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ChargeTableTransactionsFields on Charge {
    id
    transactions {
      ...TransactionForTransactionsTableFields
    }
  }
`;

type Props = {
  transactionsProps: FragmentType<typeof ChargeTableTransactionsFieldsFragmentDoc>;
  onChange: () => void;
};

export const ChargeTransactionsTable = ({ transactionsProps, onChange }: Props): ReactElement => {
  const { transactions } = getFragmentData(
    ChargeTableTransactionsFieldsFragmentDoc,
    transactionsProps,
  );
  return <TransactionsTable transactionsProps={transactions} onChange={onChange} />;
};
