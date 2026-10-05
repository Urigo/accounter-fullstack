import { type ReactElement } from 'react';
import { TransactionsTableDebitDateFieldsFragmentDoc } from '../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../gql/index.js';
import { formatTimelessDate } from '../../../helpers/index.js';
import { TableCell } from '../../ui/table.js';

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
    <TableCell>
      <div className="flex flex-col justify-center">
        <div>{effectiveDate && formatTimelessDate(effectiveDate)}</div>
        {transaction.sourceEffectiveDate && (
          <div className="text-xs text-gray-500">
            (Originally {formatTimelessDate(transaction.sourceEffectiveDate)})
          </div>
        )}
      </div>
    </TableCell>
  );
};
