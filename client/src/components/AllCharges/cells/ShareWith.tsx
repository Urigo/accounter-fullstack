import { CSSProperties, FC, useCallback } from 'react';
import gql from 'graphql-tag';
import { ShareWithFieldsFragment } from '../../../__generated__/types';
import {
  businessesNotToShare,
  businessesWithoutTaxCategory,
  privateBusinessExpenses,
  SuggestedCharge,
} from '../../../helpers';
import { ConfirmMiniButton, EditMiniButton } from '../../common';
import { useUpdateCharge } from '../../../hooks/useUdateCharge';

gql`
  fragment shareWithFields on FinancialEntity {
    __typename
    ... on LtdFinancialEntity {
      name
    }
    charges {
      id
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
  data: ShareWithFieldsFragment['charges'][0];
  financialEntityType: ShareWithFieldsFragment['__typename'];
  financialEntityName?: string;
  alternativeCharge?: SuggestedCharge;
  style?: CSSProperties;
};

export const ShareWith: FC<Props> = ({
  data,
  financialEntityName = '',
  financialEntityType,
  alternativeCharge,
  style,
}) => {
  const { beneficiaries, id: chargeId } = data;

  const { mutate, isLoading } = useUpdateCharge();

  const updateTag = useCallback(
    (value?: string) => {
      mutate({
        chargeId,
        fields: { beneficiaries: value },
      });
    },
    [chargeId, mutate]
  );

  const hasBeneficiariesd = beneficiaries.length > 0;
  const shareWithDotanFlag =
    !hasBeneficiariesd &&
    (financialEntityType !== 'LtdFinancialEntity' ||
      [...privateBusinessExpenses, ...businessesNotToShare, ...businessesWithoutTaxCategory].includes(
        financialEntityName
      ));

  return (
    <td
      style={{
        ...(shareWithDotanFlag ? { backgroundColor: 'rgb(236, 207, 57)' } : {}),
        ...style,
      }}
    >
      {beneficiaries.map(beneficiary => `${beneficiary.counterparty.name}: ${beneficiary.percentage}`)}
      {!hasBeneficiariesd && alternativeCharge?.financialAccountsToBalance}
      {!hasBeneficiariesd && alternativeCharge?.financialAccountsToBalance && (
        <ConfirmMiniButton
          onClick={() => updateTag(alternativeCharge.financialAccountsToBalance)}
          disabled={isLoading}
        />
      )}
      <EditMiniButton
        onClick={() => updateTag(prompt('New Account to share (use old string method):') ?? undefined)}
        disabled={isLoading}
      />
    </td>
  );
};
