import { ReactElement } from 'react';
import { FragmentOf, graphql, readFragment } from '../../../../graphql.js';

export const TransactionsTableDescriptionFieldsFragmentDoc = graphql(`
  fragment TransactionsTableDescriptionFields on Transaction {
    id
    sourceDescription
  }
`);

type Props = {
  data: FragmentOf<typeof TransactionsTableDescriptionFieldsFragmentDoc>;
};

export const Description = ({ data }: Props): ReactElement => {
  const transaction = readFragment(TransactionsTableDescriptionFieldsFragmentDoc, data);
  const cellText = 'sourceDescription' in transaction ? transaction.sourceDescription : 'Missing';

  return (
    <td>
      <div className="flex flex-wrap">
        <div className="flex flex-col justify-center">{cellText}</div>
      </div>
    </td>
  );
};
