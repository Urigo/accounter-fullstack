import { CSSProperties, FC } from 'react';
import gql from 'graphql-tag';
import { ShareWithFieldsFragment } from '../../../__generated__/types';
import {
  businessesNotToShare,
  businessesWithoutTaxCategory,
  privateBusinessExpenses,
  SuggestedCharge,
} from '../../../helpers';

gql`
  fragment shareWithFields on FinancialEntity {
    __typename
    ... on LtdFinancialEntity {
      name
    }
    charges {
      beneficiaries {
        counterparty {
          name
        }
        percentage
      }
    }
  }
`;

type Props = {
  beneficiaries: ShareWithFieldsFragment['charges'][0]['beneficiaries'];
  financialEntityType: ShareWithFieldsFragment['__typename'];
  financialEntityName?: string;
  alternativeCharge?: SuggestedCharge;
  style?: CSSProperties;
};

export const ShareWith: FC<Props> = ({
  beneficiaries,
  financialEntityType,
  financialEntityName = '',
  alternativeCharge,
  style,
}) => {
  const hasBeneficiariesd = beneficiaries.length > 0;
  const shareWithDotanFlag =
    !hasBeneficiariesd &&
    (!(financialEntityType === 'LtdFinancialEntity') ||
      [
        ...privateBusinessExpenses,
        ...businessesNotToShare,
        ...businessesWithoutTaxCategory,
      ].includes(financialEntityName));

  return (
    <td
      style={{
        ...(shareWithDotanFlag ? { backgroundColor: 'rgb(236, 207, 57)' } : {}),
        ...style,
      }}
    >
      {beneficiaries.map(
        (beneficiary) =>
          `${beneficiary.counterparty.name}: ${beneficiary.percentage}`
      )}
      {beneficiaries.length === 0 &&
        alternativeCharge?.financialAccountsToBalance}
      {/* {!hasBeneficiariesd && (
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
