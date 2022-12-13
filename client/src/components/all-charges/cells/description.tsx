import { useCallback, useState } from 'react';
import { FragmentType, getFragmentData } from '../../../gql';
import { AllChargesDescriptionFieldsFragmentDoc } from '../../../gql/graphql';
import type { SuggestedCharge } from '../../../helpers';
import { useUpdateTransaction } from '../../../hooks/use-update-transaction';
import { ConfirmMiniButton, InfoMiniButton } from '../../common';

/* GraphQL */ `
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
  data: FragmentType<typeof AllChargesDescriptionFieldsFragmentDoc>;
  alternativeCharge?: SuggestedCharge;
};

export const Description = ({ data, alternativeCharge }: Props) => {
  const charge = getFragmentData(AllChargesDescriptionFieldsFragmentDoc, data);
  const { userNote, id: transactionId, description: fullDescription } = charge.transactions[0];
  const isDescription = userNote && userNote.trim() !== '';
  const cellText = userNote?.trim() ?? alternativeCharge?.userDescription ?? 'undefined';
  const [toggleDescription, setToggleDescription] = useState(false);

  const { updateTransaction, fetching } = useUpdateTransaction();

  const updateUserNote = useCallback(
    (value?: string) => {
      if (value !== undefined) {
        updateTransaction({
          transactionId,
          fields: { userNote: value },
        });
      }
    },
    [transactionId, updateTransaction],
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
            disabled={fetching}
          />
        )}
      </div>
      {toggleDescription && fullDescription}
    </>
  );
};
