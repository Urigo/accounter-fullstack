import { FragmentType, getFragmentData } from '../../../../gql';
import { TransactionsTableDescriptionFieldsFragmentDoc } from '../../../../gql/graphql';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment TransactionsTableDescriptionFields on Transaction {
    id
    sourceDescription
  }
`;

type Props = {
  data: FragmentType<typeof TransactionsTableDescriptionFieldsFragmentDoc>;
};

export const Description = ({ data }: Props) => {
  const transaction = getFragmentData(TransactionsTableDescriptionFieldsFragmentDoc, data);
  const cellText = 'sourceDescription' in transaction ? transaction.sourceDescription : 'Missing';

  return (
    <td>
      <div className="flex flex-wrap">
        <div className="flex flex-col justify-center">{cellText}</div>
      </div>
    </td>
  );
};
