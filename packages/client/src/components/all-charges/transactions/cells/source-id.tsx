import { ReactElement } from 'react';
import { TransactionsTableSourceIdFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment TransactionsTableSourceIDFields on Transaction {
    id
    referenceKey
  }
`;

type Props = {
  data: FragmentType<typeof TransactionsTableSourceIdFieldsFragmentDoc>;
};

export const SourceID = ({ data }: Props): ReactElement => {
  const transaction = getFragmentData(TransactionsTableSourceIdFieldsFragmentDoc, data);

  return (
    <td>
      <div className="flex flex-wrap">
        <div className="flex flex-col justify-center">{transaction.referenceKey}</div>
      </div>
    </td>
  );
};
