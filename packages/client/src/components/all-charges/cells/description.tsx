import { ReactElement, useCallback, useMemo } from 'react';
import { Indicator } from '@mantine/core';
import { AllChargesDescriptionFieldsFragmentDoc, MissingChargeInfo } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { useUpdateCharge } from '../../../hooks/use-update-charge.js';
import { ConfirmMiniButton } from '../../common/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment AllChargesDescriptionFields on Charge {
    id
    userDescription
    ... on Charge @defer {
      validationData {
        missingInfo
      }
      missingInfoSuggestions {
        description
      }
    }
  }
`;

type Props = {
  data: FragmentType<typeof AllChargesDescriptionFieldsFragmentDoc>;
  onChange: () => void;
};

export const Description = ({ data, onChange }: Props): ReactElement => {
  const charge = getFragmentData(AllChargesDescriptionFieldsFragmentDoc, data);
  const isError = useMemo(
    () => charge?.validationData?.missingInfo?.includes(MissingChargeInfo.Description),
    [charge?.validationData?.missingInfo],
  );
  const hasAlternative = useMemo(
    () => isError && !!charge.missingInfoSuggestions?.description?.trim().length,
    [isError, charge.missingInfoSuggestions?.description],
  );
  const { userDescription, id: chargeId } = charge;
  const cellText = useMemo(
    () => userDescription?.trim() ?? charge.missingInfoSuggestions?.description ?? 'Missing',
    [userDescription, charge.missingInfoSuggestions?.description],
  );

  const { updateCharge, fetching } = useUpdateCharge();

  const updateUserDescription = useCallback(
    (value?: string) => {
      if (value !== undefined) {
        updateCharge({
          chargeId,
          fields: { userDescription: value },
        }).then(onChange);
      }
    },
    [chargeId, updateCharge, onChange],
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
            onClick={(): void => updateUserDescription(charge.missingInfoSuggestions!.description!)}
            disabled={fetching}
          />
        )}
      </div>
    </td>
  );
};
