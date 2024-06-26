import { ReactElement } from 'react';
import { FragmentOf, graphql, readFragment } from '../../../graphql.js';
import {
  TransactionForTransactionsTableFieldsFragmentDoc,
  TransactionsTable,
} from '../../common/index.js';

export const CreditcardBankChargeInfoFragmentDoc = graphql(
  `
    fragment CreditcardBankChargeInfo on Charge {
      id
      __typename
      ... on CreditcardBankCharge @defer {
        creditCardTransactions {
          ...TransactionForTransactionsTableFields
        }
      }
    }
  `,
  [TransactionForTransactionsTableFieldsFragmentDoc],
);

export function isCreditcardBankChargeInfoFragmentReady(
  data?: object | FragmentOf<typeof CreditcardBankChargeInfoFragmentDoc>,
): data is FragmentOf<typeof CreditcardBankChargeInfoFragmentDoc> {
  if (!!data && '__typename' in data && data.__typename === 'CreditcardBankCharge') {
    return true;
  }
  return false;
}

type Props = {
  chargeProps: FragmentOf<typeof CreditcardBankChargeInfoFragmentDoc>;
};

export const CreditcardTransactionsInfo = ({ chargeProps }: Props): ReactElement => {
  const charge = readFragment(CreditcardBankChargeInfoFragmentDoc, chargeProps);
  if (
    charge.__typename !== 'CreditcardBankCharge' ||
    !('creditCardTransactions' in charge) ||
    charge.creditCardTransactions?.length === 0
  ) {
    // eslint-disable-next-line react/jsx-no-useless-fragment
    return <></>;
  }

  return (
    charge.creditCardTransactions && (
      <TransactionsTable transactionsProps={charge.creditCardTransactions} enableChargeLink />
    )
  );
};
