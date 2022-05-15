import { CSSProperties, FC } from 'react';
import gql from 'graphql-tag';
import { ShareWithFieldsFragment } from '../../../__generated__/types';
import type { SuggestedCharge } from '../../../helpers';

gql`
  fragment shareWithFields on Charge {
    beneficiaries {
      counterparty {
        name
      }
      percentage
    }
  }
`;

type Props = {
  beneficiaries: ShareWithFieldsFragment['beneficiaries'];
  alternativeCharge?: SuggestedCharge;
  style?: CSSProperties;
};

export const ShareWith: FC<Props> = ({
  beneficiaries,
  alternativeCharge,
  style,
}) => {
  return (
    <td
    // style={{
    //   ...(shareWithDotan(transaction)
    //     ? { backgroundColor: 'rgb(236, 207, 57)' }
    //     : {}),
    //   ...style,
    // }}
    >
      {beneficiaries.map(
        (beneficiary) =>
          `${beneficiary.counterparty.name}: ${beneficiary.percentage}`
      )}
      {beneficiaries.length === 0 &&
        alternativeCharge?.financialAccountsToBalance}
      {/* {!transaction.financial_accounts_to_balance && (
        <ConfirmButton
          transaction={transaction}
          propertyName={'financial_accounts_to_balance'}
          value={alternativeCharge?.financialAccountsToBalance}
        />
      )} */}
      {/* <UpdateButton
        transaction={transaction}
        propertyName={'financial_accounts_to_balance'}
        promptText="New Account to share:"
      /> */}
    </td>
  );
};
