import { CSSProperties, useCallback } from 'react';
import gql from 'graphql-tag';
import { ConfirmMiniButton, EditMiniButton } from '../../common';
import type { SuggestedCharge } from '../../../helpers';
import { useUpdateCharge } from '../../../hooks/useUdateCharge';
import { CategoryFieldsFragment } from '../../../__generated__/types';

gql`
  fragment categoryFields on Charge {
    id
    tags
  }
`;

type Props = {
  data: CategoryFieldsFragment;
  alternativeCharge?: SuggestedCharge;
  style?: CSSProperties;
};

export const Category = ({ data, alternativeCharge, style }: Props) => {
  const { tags, id: chargeId } = data;
  const isPersonalCategory = tags.length > 0;
  const cellText = isPersonalCategory ? tags.join(', ') : alternativeCharge?.personalCategory;

  const { mutate, isLoading } = useUpdateCharge();

  const updateTag = useCallback(
    (value?: string) => {
      mutate({
        chargeId,
        fields: { tag: value },
      });
    },
    [chargeId, mutate]
  );

  return (
    <td
      style={{
        ...(isPersonalCategory ? {} : { backgroundColor: 'rgb(236, 207, 57)' }),
        ...style,
      }}
    >
      {cellText ?? 'undefined'}
      {!isPersonalCategory && alternativeCharge?.personalCategory && (
        <ConfirmMiniButton onClick={() => updateTag(alternativeCharge.personalCategory)} disabled={isLoading} />
      )}
      <EditMiniButton onClick={() => updateTag(prompt('Enter new category') ?? undefined)} disabled={isLoading} />
    </td>
  );
};
