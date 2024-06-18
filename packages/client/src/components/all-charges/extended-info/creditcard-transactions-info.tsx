import { ReactElement } from 'react';
import { CreditcardBankChargeInfoFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { TransactionsTable } from '../../common/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment CreditcardBankChargeInfo on Charge {
    id
    __typename
    ... on CreditcardBankCharge @defer {
      creditCardTransactions {
        ...TransactionForTransactionsTableFields
      }
    }
  }
`;

type Props = {
  chargeProps: FragmentType<typeof CreditcardBankChargeInfoFragmentDoc>;
};

export const CreditcardTransactionsInfo = ({ chargeProps }: Props): ReactElement => {
  const charge = getFragmentData(CreditcardBankChargeInfoFragmentDoc, chargeProps);
  if (charge.__typename !== 'CreditcardBankCharge' || charge.creditCardTransactions?.length === 0) {
    // eslint-disable-next-line react/jsx-no-useless-fragment
    return <></>;
  }

  return (
    charge.creditCardTransactions && (
      <TransactionsTable transactionsProps={charge.creditCardTransactions} />
    )
  );
};
