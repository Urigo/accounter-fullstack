import { useCallback } from 'react';
import { Indicator } from '@mantine/core';
import { FragmentType, getFragmentData } from '../../../gql';
import { AllChargesEntityFieldsFragmentDoc, MissingChargeInfo } from '../../../gql/graphql';
import type { SuggestedCharge } from '../../../helpers';
import { useUpdateCharge } from '../../../hooks/use-update-charge';
import { ConfirmMiniButton } from '../../common';

/* GraphQL */ `
  fragment AllChargesEntityFields on Charge {
    id
    counterparty {
      name
    }
    validationData {
      missingInfo
    }
  }
`;

type Props = {
  data: FragmentType<typeof AllChargesEntityFieldsFragmentDoc>;
  alternativeCharge?: SuggestedCharge;
};

export const Entity = ({ data, alternativeCharge }: Props) => {
  const {
    counterparty,
    id: chargeId,
    validationData,
  } = getFragmentData(AllChargesEntityFieldsFragmentDoc, data);
  const isError = validationData?.missingInfo?.includes(MissingChargeInfo.Counterparty);
  const hasAlternative = isError && !!alternativeCharge?.financialEntity.trim()?.length;
  const { name } = counterparty || {};
  const alternativeName = hasAlternative ? alternativeCharge.financialEntity.trim() : 'Missing';
  const cellText = isError ? alternativeName : name;

  const { updateCharge, fetching } = useUpdateCharge();

  const updateTag = useCallback(
    (value?: string) => {
      if (value !== undefined) {
        updateCharge({
          chargeId,
          fields: {
            counterparty: value
              ? {
                  name: value,
                }
              : undefined,
          },
        });
      }
    },
    [chargeId, updateCharge],
  );

  return (
    <td>
      <div className="flex flex-wrap">
        <Indicator inline size={12} disabled={!isError} color="red" zIndex="auto">
          <p style={hasAlternative ? { backgroundColor: 'rgb(236, 207, 57)' } : {}}>{cellText}</p>
        </Indicator>
        {hasAlternative && (
          <ConfirmMiniButton onClick={() => updateTag(cellText)} disabled={fetching} />
        )}
      </div>
    </td>
  );
};
