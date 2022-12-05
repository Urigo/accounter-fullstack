import { useCallback, useState } from 'react';
import gql from 'graphql-tag';
import { AllChargesDescriptionFieldsFragment } from '../../../__generated__/types';
import type { SuggestedCharge } from '../../../helpers';
import { useUpdateTransaction } from '../../../hooks/use-update-transaction';
import { ConfirmMiniButton, InfoMiniButton } from '../../common';

gql`
  fragment AllChargesDescriptionFields on Charge {
    id
    transactions {
      id
      userNote
      description
    }
  }
`;

type Props = {
  data: AllChargesDescriptionFieldsFragment['transactions'][0];
  alternativeCharge?: SuggestedCharge;
};

export const Description = ({ data, alternativeCharge }: Props) => {
  const { userNote, id: transactionId, description: fullDescription } = data;
  const isDescription = userNote && userNote.trim() !== '';
  const cellText = userNote?.trim() ?? alternativeCharge?.userDescription ?? 'undefined';
  const [toggleDescription, setToggleDescription] = useState(false);

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
    [transactionId, mutate],
  );

  return (
    <>
      <div className="flex flex-wrap">
        <div className="flex flex-col justify-center">
          <p style={isDescription ? {} : { backgroundColor: 'rgb(236, 207, 57)' }}>{cellText}</p>
        </div>
        <InfoMiniButton onClick={() => setToggleDescription(!toggleDescription)} />
        {!isDescription && alternativeCharge?.userDescription && (
          <ConfirmMiniButton
            onClick={() => updateUserNote(alternativeCharge.userDescription)}
            disabled={isLoading}
          />
        )}
      </div>
      {toggleDescription && fullDescription}
    </>
  );
};
