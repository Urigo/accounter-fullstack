import { useCallback } from 'react';
import { FragmentType, getFragmentData } from '../../../gql';
import { AllChargesEntityFieldsFragmentDoc } from '../../../gql/graphql';
import type { SuggestedCharge } from '../../../helpers';
import { useUpdateCharge } from '../../../hooks/use-update-charge';
import { ConfirmMiniButton } from '../../common';

/* GraphQL */ `
  fragment AllChargesEntityFields on Charge {
    id
    counterparty {
      name
    }
  }
`;

type Props = {
  data: FragmentType<typeof AllChargesEntityFieldsFragmentDoc>;
  alternativeCharge?: SuggestedCharge;
};

export const Entity = ({ data, alternativeCharge }: Props) => {
  const { counterparty, id: chargeId } = getFragmentData(AllChargesEntityFieldsFragmentDoc, data);
  const { name } = counterparty || {};
  const isFinancialEntity = name && name !== '';
  const cellText = isFinancialEntity ? name : alternativeCharge?.financialEntity;

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
    <div className="flex flex-wrap">
      <p style={isFinancialEntity ? {} : { backgroundColor: 'rgb(236, 207, 57)' }}>
        {cellText ?? 'undefined'}
      </p>
      {!isFinancialEntity && alternativeCharge?.financialEntity && (
        <ConfirmMiniButton
          onClick={() => updateTag(alternativeCharge.financialEntity)}
          disabled={fetching}
        />
      )}
    </div>
  );
};
