import gql from 'graphql-tag';
import { CSSProperties, useCallback } from 'react';

import { DescriptionFieldsFragment } from '../../../__generated__/types';
import type { SuggestedCharge } from '../../../helpers';
import { useUpdateTransaction } from '../../../hooks/use-update-transaction';
import { ConfirmMiniButton, EditMiniButton } from '../../common';
import { AccounterDivider } from '../../common/divider';

gql`
  fragment DescriptionFields on Charge {
    transactions {
      id
      userNote
    }
  }
`;

type Props = {
  data: DescriptionFieldsFragment['transactions'][0];
  alternativeCharge?: SuggestedCharge;
  style?: CSSProperties;
};

export const Description = ({ data, alternativeCharge, style }: Props) => {
  const { userNote, id: transactionId } = data;
  const isDescription = userNote && userNote.trim() !== '';
  const cellText = userNote?.trim() ?? alternativeCharge?.userDescription;

  const { mutate, isLoading } = useUpdateTransaction();

  const updateUserNote = useCallback(
    (value?: string) => {
      mutate({
        transactionId,
        fields: { userNote: value },
      });
    },
    [transactionId, mutate]
  );

  return (
    <td
      style={{
        ...(isDescription ? {} : { backgroundColor: 'rgb(236, 207, 57)' }),
        ...style,
      }}
    >
      {cellText ?? 'undefined'}
      {!isDescription && alternativeCharge?.userDescription && (
        <ConfirmMiniButton onClick={() => updateUserNote(alternativeCharge.userDescription)} disabled={isLoading} />
      )}
      <AccounterDivider my="sm" />
      <EditMiniButton
        onClick={() => updateUserNote(prompt('New user description:') ?? undefined)}
        disabled={isLoading}
      />
    </td>
  );
};
