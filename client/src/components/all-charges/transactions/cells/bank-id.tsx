import { FragmentType, getFragmentData } from '../../../../gql';
import { Transactions_BankIdFieldsFragmentDoc } from '../../../../gql/graphql';

/* GraphQL */ `
  fragment Transactions_BankIDFields on Transaction {
    id
  }
`;

type Props = {
  data: FragmentType<typeof Transactions_BankIdFieldsFragmentDoc>;
};

export const BankID = ({ data }: Props) => {
  const transaction = getFragmentData(Transactions_BankIdFieldsFragmentDoc, data);

  // TODO(Gil): implement

  return (
    <td>
      <div className="flex flex-wrap">
        <div className="flex flex-col justify-center">Missing</div>
      </div>
    </td>
  );
};
