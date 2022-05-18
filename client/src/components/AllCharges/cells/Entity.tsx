import { CSSProperties, FC, useCallback } from 'react';
import gql from 'graphql-tag';
import { ConfirmMiniButton, EditMiniButton } from '../../common';
import type { SuggestedCharge } from '../../../helpers';
import { useUpdateCharge } from '../../../hooks/useUdateCharge';
import { EntityFieldsFragment } from '../../../__generated__/types';

gql`
  fragment entityFields on Charge {
    id
    counterparty {
      name
    }
  }
`;

type Props = {
  data: EntityFieldsFragment;
  alternativeCharge?: SuggestedCharge;
  style?: CSSProperties;
};

export const Entity = ({ data, alternativeCharge, style }: Props) => {
  const {
    counterparty: { name },
    id: chargeId,
  } = data;
  const isFinancialEntity = name !== '';
  const cellText = name ?? alternativeCharge?.financialEntity;

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
    <td
      style={{
        ...(isFinancialEntity ? {} : { backgroundColor: 'rgb(236, 207, 57)' }),
        ...style,
      }}
    >
      {cellText ?? 'undefined'}
      {!isFinancialEntity && alternativeCharge?.financialEntity && (
        <ConfirmMiniButton
          onClick={() => updateTag(alternativeCharge.financialEntity)}
          disabled={isLoading}
        />
      )}
      <EditMiniButton
        onClick={() => updateTag(prompt('New financial entity:') ?? undefined)}
        disabled={isLoading}
      />
    </td>
  );
};
