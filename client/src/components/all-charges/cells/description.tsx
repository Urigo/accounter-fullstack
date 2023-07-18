import { useCallback } from 'react';
import { Indicator } from '@mantine/core';
import { FragmentType, getFragmentData } from '../../../gql';
import { AllChargesDescriptionFieldsFragmentDoc, MissingChargeInfo } from '../../../gql/graphql';
import { useUpdateCharge } from '../../../hooks/use-update-charge';
import { ConfirmMiniButton } from '../../common';

/* GraphQL */ `
  fragment AllChargesDescriptionFields on Charge {
    id
    userDescription
    validationData {
      missingInfo
    }
    missingInfoSuggestions {
      description
    }
  }
`;

type Props = {
  data: FragmentType<typeof AllChargesDescriptionFieldsFragmentDoc>;
};

export const Description = ({ data }: Props) => {
  const charge = getFragmentData(AllChargesDescriptionFieldsFragmentDoc, data);
  const isError = charge?.validationData?.missingInfo?.includes(MissingChargeInfo.Description);
  const hasAlternative = isError && !!charge.missingInfoSuggestions?.description?.trim().length;
  const { userDescription, id: chargeId } = charge;
  const cellText =
    userDescription?.trim() ?? charge.missingInfoSuggestions?.description ?? 'Missing';

  const { updateCharge, fetching } = useUpdateCharge();

  const updateUserDescription = useCallback(
    (value?: string) => {
      if (value !== undefined) {
        updateCharge({
          chargeId,
          fields: { userDescription: value },
        });
      }
    },
    [chargeId, updateCharge],
  );

  return (
    <td>
      <div className="flex flex-wrap">
        <div className="flex flex-col justify-center">
          <Indicator inline size={12} disabled={!isError} color="red" zIndex="auto">
            <p style={hasAlternative ? { backgroundColor: 'rgb(236, 207, 57)' } : {}}>{cellText}</p>
          </Indicator>
        </div>
        {hasAlternative && (
          <ConfirmMiniButton
            onClick={() => updateUserDescription(charge.missingInfoSuggestions!.description!)}
            disabled={fetching}
          />
        )}
      </div>
    </td>
  );
};
