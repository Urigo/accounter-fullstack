import { format } from 'date-fns';
import { FragmentType, getFragmentData } from '../../../../gql';
import { Transactions_DebitDateFieldsFragmentDoc } from '../../../../gql/graphql';

/* GraphQL */ `
  fragment Transactions_DebitDateFields on Transaction {
    id
    ...on CommonTransaction {
      effectiveDate
    }
  }
`;

type Props = {
  data: FragmentType<typeof Transactions_DebitDateFieldsFragmentDoc>;
};

export const DebitDate = ({ data }: Props) => {
  const transaction = getFragmentData(Transactions_DebitDateFieldsFragmentDoc, data);
  const effectiveDate = 'effectiveDate' in transaction ? transaction.effectiveDate : undefined;

  return (
    <td>
      <div>{effectiveDate && format(new Date(effectiveDate), 'dd/MM/yy')}</div>
    </td>
  );
};
