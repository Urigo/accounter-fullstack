import { type ReactElement } from 'react';
import { ChargeTableTransactionsFieldsFragmentDoc } from '../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../gql/index.js';
import type { ChargeType } from '../../helpers/charges.js';
import { TransactionsTable } from '../transactions-table/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ChargeTableTransactionsFields on Charge {
    id
    transactions {
      id
      ...TransactionForTransactionsTableFields
    }
  }
`;

type Props = {
  transactionsProps: FragmentType<typeof ChargeTableTransactionsFieldsFragmentDoc>;
  chargeType?: ChargeType;
  onChange: () => void;
};

export const ChargeTransactionsTable = ({
  transactionsProps,
  chargeType,
  onChange,
}: Props): ReactElement => {
  const { transactions } = getFragmentData(
    ChargeTableTransactionsFieldsFragmentDoc,
    transactionsProps,
  );
  return (
    <TransactionsTable
      transactionsProps={transactions}
      onChange={onChange}
      chargeType={chargeType}
      enableEdit
    />
  );
};
