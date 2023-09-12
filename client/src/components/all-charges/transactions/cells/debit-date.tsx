import { ReactElement } from 'react';
import { format } from 'date-fns';
import { TransactionsTableDebitDateFieldsFragmentDoc } from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment TransactionsTableDebitDateFields on Transaction {
    id
    effectiveDate
  }
`;

type Props = {
  data: FragmentType<typeof TransactionsTableDebitDateFieldsFragmentDoc>;
};

export const DebitDate = ({ data }: Props): ReactElement => {
  const transaction = getFragmentData(TransactionsTableDebitDateFieldsFragmentDoc, data);
  const effectiveDate = 'effectiveDate' in transaction ? transaction.effectiveDate : undefined;

  return (
    <td>
      <div>{effectiveDate && format(new Date(effectiveDate), 'dd/MM/yy')}</div>
    </td>
  );
};
