import gql from 'graphql-tag';
import { useCallback } from 'react';

import { AllChargesEntityFieldsFragment } from '../../../__generated__/types';
import type { SuggestedCharge } from '../../../helpers';
import { useUpdateCharge } from '../../../hooks/use-update-charge';
import { ConfirmMiniButton } from '../../common';

gql`
  fragment AllChargesEntityFields on Charge {
    id
    counterparty {
      name
    }
  }
`;

type Props = {
  data: AllChargesEntityFieldsFragment;
  alternativeCharge?: SuggestedCharge;
};

export const Entity = ({ data, alternativeCharge }: Props) => {
  const { counterparty, id: chargeId } = data;
  const { name } = counterparty || {};
  const isFinancialEntity = name && name !== '';
  const cellText = isFinancialEntity ? name : alternativeCharge?.financialEntity;

  const { mutate, isLoading } = useUpdateCharge();

  const updateTag = useCallback(
    (value?: string) => {
      if (value !== undefined) {
        mutate({
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
    [chargeId, mutate]
  );

  return (
    <div className="flex flex-wrap">
      <p style={isFinancialEntity ? {} : { backgroundColor: 'rgb(236, 207, 57)' }}>{cellText ?? 'undefined'}</p>
      {!isFinancialEntity && alternativeCharge?.financialEntity && (
        <ConfirmMiniButton onClick={() => updateTag(alternativeCharge.financialEntity)} disabled={isLoading} />
      )}
    </div>
  );
};
