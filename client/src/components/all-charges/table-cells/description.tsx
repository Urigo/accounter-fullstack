import gql from 'graphql-tag';
import { useCallback } from 'react';

import { AllChargesDescriptionFieldsFragment } from '../../../__generated__/types';
import type { SuggestedCharge } from '../../../helpers';
import { useUpdateTransaction } from '../../../hooks/use-update-transaction';
import { ConfirmMiniButton } from '../../common';

gql`
  fragment AllChargesDescriptionFields on Charge {
    transactions {
      id
      userNote
    }
  }
`;

type Props = {
  data: AllChargesDescriptionFieldsFragment['transactions'][0];
  alternativeCharge?: SuggestedCharge;
};

export const Description = ({ data, alternativeCharge }: Props) => {
  const { userNote, id: transactionId } = data;
  const isDescription = userNote && userNote.trim() !== '';
  const cellText = userNote?.trim() ?? alternativeCharge?.userDescription ?? 'undefined';

  const { mutate, isLoading } = useUpdateTransaction();

  const updateUserNote = useCallback(
    (value?: string) => {
      if (value !== undefined) {
        mutate({
          transactionId,
          fields: { userNote: value },
        });
      }
    },
    [transactionId, mutate]
  );

  return (
    <div className="flex flex-wrap">
      <p style={isDescription ? {} : { backgroundColor: 'rgb(236, 207, 57)' }}>{cellText}</p>
      {!isDescription && alternativeCharge?.userDescription && (
        <ConfirmMiniButton onClick={() => updateUserNote(alternativeCharge.userDescription)} disabled={isLoading} />
      )}
    </div>
  );
};
