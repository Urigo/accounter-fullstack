import { FragmentType, getFragmentData } from '../../../../gql';
import { TransactionsTableDescriptionFieldsFragmentDoc } from '../../../../gql/graphql';

/* GraphQL */ `
  fragment TransactionsTableDescriptionFields on Transaction {
    id
    ...on CommonTransaction {
      description
    }
  }
`;

type Props = {
  data: FragmentType<typeof TransactionsTableDescriptionFieldsFragmentDoc>;
};

export const Description = ({ data }: Props) => {
  const transaction = getFragmentData(TransactionsTableDescriptionFieldsFragmentDoc, data);
  const cellText = 'description' in transaction ? transaction.description : 'Missing';

  return (
    <td>
      <div className="flex flex-wrap">
        <div className="flex flex-col justify-center">{cellText}</div>
      </div>
    </td>
  );
};
