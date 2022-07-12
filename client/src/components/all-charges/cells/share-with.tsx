import gql from 'graphql-tag';
import { useCallback } from 'react';

import { AllChargesShareWithFieldsFragment, BeneficiaryInput } from '../../../__generated__/types';
import {
  businessesNotToShare,
  businessesWithoutTaxCategory,
  entitiesWithoutInvoice,
  privateBusinessExpenses,
  SuggestedCharge,
} from '../../../helpers';
import { useUpdateCharge } from '../../../hooks/use-update-charge';
import { ConfirmMiniButton } from '../../common';

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
      if (value !== undefined) {
        mutate({
          chargeId,
          fields: { beneficiaries: value as unknown as BeneficiaryInput[] },
        });
      }
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
        <div className="flex flex-wrap -m-4 text-center gap-5">
          {beneficiaries?.map((beneficiary, index) => (
            <div
              key={index}
              className="sm:w-1/4"
              style={shareWithDotanFlag ? { backgroundColor: 'rgb(236, 207, 57)' } : {}}
            >
              <h2 className="title-font font-medium sm:text-base text-gray-900">{beneficiary.counterparty.name}</h2>
              <p className="leading-relaxed">{beneficiary.percentage}%</p>
            </div>
          ))}
          {!hasBeneficiariesd && alternativeCharge?.financialAccountsToBalance && (
            <div className="sm:w-1/4">
              <ConfirmMiniButton
                onClick={() => updateTag(alternativeCharge.financialAccountsToBalance)}
                disabled={isLoading}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
