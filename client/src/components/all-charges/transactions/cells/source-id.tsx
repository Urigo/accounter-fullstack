import { FragmentType, getFragmentData } from '../../../../gql';
import { TransactionsTableSourceIdFieldsFragmentDoc } from '../../../../gql/graphql';

/* GraphQL */ `
  fragment TransactionsTableSourceIDFields on Transaction {
    id
    referenceNumber
  }
`;

type Props = {
  data: FragmentType<typeof TransactionsTableSourceIdFieldsFragmentDoc>;
};

export const SourceID = ({ data }: Props) => {
  const transaction = getFragmentData(TransactionsTableSourceIdFieldsFragmentDoc, data);

  return (
    <td>
      <div className="flex flex-wrap">
        <div className="flex flex-col justify-center">{transaction.referenceNumber}</div>
      </div>
    </td>
  );
};
