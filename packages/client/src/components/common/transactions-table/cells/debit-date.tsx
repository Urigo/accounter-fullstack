import { ReactElement } from 'react';
import { format } from 'date-fns';
import { FragmentOf, graphql, readFragment } from '../../../../graphql.js';

export const TransactionsTableDebitDateFieldsFragmentDoc = graphql(`
  fragment TransactionsTableDebitDateFields on Transaction {
    id
    effectiveDate
  }
`);

type Props = {
  data: FragmentOf<typeof TransactionsTableDebitDateFieldsFragmentDoc>;
};

export const DebitDate = ({ data }: Props): ReactElement => {
  const transaction = readFragment(TransactionsTableDebitDateFieldsFragmentDoc, data);
  const effectiveDate = 'effectiveDate' in transaction ? transaction.effectiveDate : undefined;

  return (
    <td>
      <div>{effectiveDate && format(new Date(effectiveDate), 'dd/MM/yy')}</div>
    </td>
  );
};
