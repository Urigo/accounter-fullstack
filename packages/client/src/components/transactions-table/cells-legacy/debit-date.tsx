import { type ReactElement } from 'react';
import { format } from 'date-fns';
import { TransactionsTableDebitDateFieldsFragmentDoc } from '../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment TransactionsTableDebitDateFields on Transaction {
    id
    effectiveDate
    sourceEffectiveDate
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
      <div className="flex flex-col justify-center">
        <div>{effectiveDate && format(new Date(effectiveDate), 'dd/MM/yy')}</div>
        {transaction.sourceEffectiveDate && (
          <div className="text-xs text-gray-500">
            (Originally {format(new Date(transaction.sourceEffectiveDate), 'dd/MM/yy')})
          </div>
        )}
      </div>
    </td>
  );
};
