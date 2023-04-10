import { format } from 'date-fns';
import { FragmentType, getFragmentData } from '../../../../gql';
import { TransactionsTableDebitDateFieldsFragmentDoc } from '../../../../gql/graphql';

/* GraphQL */ `
  fragment TransactionsTableDebitDateFields on Transaction {
    id
    ...on CommonTransaction {
      effectiveDate
    }
  }
`;

type Props = {
  data: FragmentType<typeof TransactionsTableDebitDateFieldsFragmentDoc>;
};

export const DebitDate = ({ data }: Props) => {
  const transaction = getFragmentData(TransactionsTableDebitDateFieldsFragmentDoc, data);
  const effectiveDate = 'effectiveDate' in transaction ? transaction.effectiveDate : undefined;

  return (
    <td>
      <div>{effectiveDate && format(new Date(effectiveDate), 'dd/MM/yy')}</div>
    </td>
  );
};
