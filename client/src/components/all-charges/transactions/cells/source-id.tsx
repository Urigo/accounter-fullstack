import { FragmentType, getFragmentData } from '../../../../gql';
import { Transactions_SourceIdFieldsFragmentDoc } from '../../../../gql/graphql';

/* GraphQL */ `
  fragment Transactions_SourceIDFields on Transaction {
    id
  }
`;

type Props = {
  data: FragmentType<typeof Transactions_SourceIdFieldsFragmentDoc>;
};

export const SourceID = ({ data }: Props) => {
  const transaction = getFragmentData(Transactions_SourceIdFieldsFragmentDoc, data);

  // TODO(Gil): implement

  return (
    <td>
      <div className="flex flex-wrap">
        <div className="flex flex-col justify-center">Missing</div>
      </div>
    </td>
  );
};
