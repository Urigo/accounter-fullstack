import gql from 'graphql-tag';
import { useCallback } from 'react';

import { AllChargesShareWithFieldsFragment } from '../../../__generated__/types';
import {
  businessesNotToShare,
  businessesWithoutTaxCategory,
  entitiesWithoutInvoice,
  privateBusinessExpenses,
  SuggestedCharge,
} from '../../../helpers';
import { useUpdateCharge } from '../../../hooks/use-update-charge';
import { ConfirmMiniButton, EditMiniButton } from '../../common';
import { AccounterDivider } from '../../common/divider';

gql`
  fragment AllChargesShareWithFields on Charge {
    id
    beneficiaries {
      counterparty {
        name
      }
      percentage
    }
    counterparty {
      name
    }
  }
`;

export interface Props {
  data: AllChargesShareWithFieldsFragment;
  alternativeCharge?: SuggestedCharge;
  isBusiness: boolean;
}

export const ShareWith = ({ data, alternativeCharge, isBusiness }: Props) => {
  const { beneficiaries, counterparty, id: chargeId } = data;
  const financialEntityName = counterparty?.name ?? '';

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
    (!(isBusiness && !entitiesWithoutInvoice.includes(financialEntityName)) ||
      [...privateBusinessExpenses, ...businessesNotToShare, ...businessesWithoutTaxCategory].includes(
        financialEntityName
      ));

  return (
    <div className="text-gray-600 body-font">
      <div className="container px-6 py-5 mx-auto">
        <div
          className="flex flex-wrap -m-4 text-center gap-5"
          style={shareWithDotanFlag ? { backgroundColor: 'rgb(236, 207, 57)' } : {}}
        >
          {beneficiaries?.map((beneficiary, index) => (
            <div key={index} className="sm:w-1/4">
              <h2 className="title-font font-medium sm:text-base text-gray-900">{beneficiary.counterparty.name}</h2>
              <p className="leading-relaxed">{beneficiary.percentage}%</p>
            </div>
          ))}
        </div>
        {!hasBeneficiariesd && alternativeCharge?.financialAccountsToBalance && (
          <ConfirmMiniButton
            onClick={() => updateTag(alternativeCharge.financialAccountsToBalance)}
            disabled={isLoading}
          />
        )}
        <AccounterDivider my="sm" />
        <EditMiniButton
          onClick={() => updateTag(prompt('New Account to share (use old string method):') ?? undefined)}
          disabled={isLoading}
        />
      </div>
    </div>
  );
};
