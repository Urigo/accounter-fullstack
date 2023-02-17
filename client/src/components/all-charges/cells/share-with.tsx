import { useCallback } from 'react';
import { FragmentType, getFragmentData } from '../../../gql';
import { AllChargesShareWithFieldsFragmentDoc, BeneficiaryInput } from '../../../gql/graphql';
import {
  businessesNotToShare,
  businessesWithoutTaxCategory,
  entitiesWithoutInvoice,
  privateBusinessExpenses,
  SuggestedCharge,
} from '../../../helpers';
import { useUpdateCharge } from '../../../hooks/use-update-charge';
import { ConfirmMiniButton, ListCapsule } from '../../common';

/* GraphQL */ `
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
    financialEntity {
      __typename
      id
    }
  }
`;

export interface Props {
  data: FragmentType<typeof AllChargesShareWithFieldsFragmentDoc>;
  alternativeCharge?: SuggestedCharge;
}

export const ShareWith = ({ data, alternativeCharge }: Props) => {
  const {
    beneficiaries,
    counterparty,
    id: chargeId,
    financialEntity,
  } = getFragmentData(AllChargesShareWithFieldsFragmentDoc, data);
  const financialEntityName = counterparty?.name ?? '';
  const isBusiness = financialEntity?.__typename === 'LtdFinancialEntity';
  const isError = beneficiaries.length === 0;

  const { updateCharge, fetching } = useUpdateCharge();

  const updateBeneficiaries = useCallback(
    (value?: string) => {
      if (value !== undefined) {
        updateCharge({
          chargeId,
          fields: { beneficiaries: value as unknown as BeneficiaryInput[] },
        });
      }
    },
    [chargeId, updateCharge],
  );

  const shareWithDotanFlag =
    isError &&
    (!(isBusiness && !entitiesWithoutInvoice.includes(financialEntityName)) ||
      [
        ...privateBusinessExpenses,
        ...businessesNotToShare,
        ...businessesWithoutTaxCategory,
      ].includes(financialEntityName));

  return (
    <td>
      <ListCapsule
        style={shareWithDotanFlag ? { backgroundColor: 'rgb(236, 207, 57)' } : {}}
        items={beneficiaries?.map((beneficiary, index) => (
          <div key={index} className="sm:w-1/4 whitespace-nowrap text-xs">
            {beneficiary.counterparty.name}: <span>{beneficiary.percentage}%</span>
          </div>
        ))}
      />
      {isError && alternativeCharge?.financialAccountsToBalance && (
        <div className="sm:w-1/4">
          <ConfirmMiniButton
            onClick={() => updateBeneficiaries(alternativeCharge.financialAccountsToBalance)}
            disabled={fetching}
          />
        </div>
      )}
    </td>
  );
};
