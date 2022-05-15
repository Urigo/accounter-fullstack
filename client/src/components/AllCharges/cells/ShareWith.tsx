import { CSSProperties, FC } from 'react';
import gql from 'graphql-tag';
import { ShareWithFieldsFragment } from '../../../__generated__/types';

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
  style?: CSSProperties;
};

export const ShareWith: FC<Props> = ({ beneficiaries, style }) => {
  const cellData = beneficiaries; // ?? suggestedTransaction(transaction)?.financialAccountsToBalance;

  return (
    <td
      // style={{
      //   ...(shareWithDotan(transaction)
      //     ? { backgroundColor: 'rgb(236, 207, 57)' }
      //     : {}),
      //   ...style,
      // }}
    >
      {cellData.map(
        (beneficiary) =>
          `${beneficiary.counterparty.name}: ${beneficiary.percentage}`
      )}
      {/* {!transaction.financial_accounts_to_balance && (
        <ConfirmButton
          transaction={transaction}
          propertyName={'financial_accounts_to_balance'}
          value={cellText}
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
