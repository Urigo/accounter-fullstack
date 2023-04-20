import { FragmentType, getFragmentData } from '../../../../gql';
import { Transactions_DescriptionFieldsFragmentDoc } from '../../../../gql/graphql';

/* GraphQL */ `
  fragment Transactions_DescriptionFields on Transaction {
    id
    ...on CommonTransaction {
      description
    }
  }
`;

type Props = {
  data: FragmentType<typeof Transactions_DescriptionFieldsFragmentDoc>;
};

export const Description = ({ data }: Props) => {
  const transaction = getFragmentData(Transactions_DescriptionFieldsFragmentDoc, data);
  const cellText = 'description' in transaction ? transaction.description : 'Missing';

  return (
    <td>
      <div className="flex flex-wrap">
        <div className="flex flex-col justify-center">{cellText}</div>
      </div>
    </td>
  );
};
