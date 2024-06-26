import { ReactElement } from 'react';
import { FragmentOf, graphql, readFragment } from '../../../../graphql.js';

export const TransactionsTableSourceIdFieldsFragmentDoc = graphql(`
  fragment TransactionsTableSourceIDFields on Transaction {
    id
    referenceKey
  }
`);

type Props = {
  data: FragmentOf<typeof TransactionsTableSourceIdFieldsFragmentDoc>;
};

export const SourceID = ({ data }: Props): ReactElement => {
  const transaction = readFragment(TransactionsTableSourceIdFieldsFragmentDoc, data);

  return (
    <td>
      <div className="flex flex-wrap">
        <div className="flex flex-col justify-center">{transaction.referenceKey}</div>
      </div>
    </td>
  );
};
