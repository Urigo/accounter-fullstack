import gql from 'graphql-tag';
import { useCallback } from 'react';

import { AllChargesEntityFieldsFragment } from '../../../__generated__/types';
import type { SuggestedCharge } from '../../../helpers';
import { useUpdateCharge } from '../../../hooks/use-update-charge';
import { ConfirmMiniButton, EditMiniButton } from '../../common';
import { AccounterDivider } from '../../common/divider';

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
    },
    [chargeId, mutate]
  );

  return (
    <td style={isFinancialEntity ? {} : { backgroundColor: 'rgb(236, 207, 57)' }}>
      {cellText ?? 'undefined'}
      {!isFinancialEntity && alternativeCharge?.financialEntity && (
        <ConfirmMiniButton onClick={() => updateTag(alternativeCharge.financialEntity)} disabled={isLoading} />
      )}
      <AccounterDivider my="sm" />
      <EditMiniButton onClick={() => updateTag(prompt('New financial entity:') ?? undefined)} disabled={isLoading} />
    </td>
  );
};
