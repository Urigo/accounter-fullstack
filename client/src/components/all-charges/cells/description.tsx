import { useCallback, useState } from 'react';
import { Indicator } from '@mantine/core';
import { FragmentType, getFragmentData } from '../../../gql';
import { AllChargesDescriptionFieldsFragmentDoc, MissingChargeInfo } from '../../../gql/graphql';
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
    validationData {
      missingInfo
    }
  }
`;

type Props = {
  data: FragmentType<typeof AllChargesDescriptionFieldsFragmentDoc>;
  alternativeCharge?: SuggestedCharge;
};

export const Description = ({ data, alternativeCharge }: Props) => {
  const charge = getFragmentData(AllChargesDescriptionFieldsFragmentDoc, data);
  const isError = charge?.validationData?.missingInfo?.includes(
    MissingChargeInfo.TransactionDescription,
  );
  const hasAlternative = isError && !!alternativeCharge?.userDescription?.trim().length;
  const { userNote, id: transactionId, description: fullDescription } = charge.transactions[0];
  const cellText = userNote?.trim() ?? alternativeCharge?.userDescription ?? 'Missing';
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
    <td>
      <div className="flex flex-wrap">
        <div className="flex flex-col justify-center">
          <Indicator inline size={12} disabled={!isError} color="red" zIndex="auto">
            <p style={hasAlternative ? { backgroundColor: 'rgb(236, 207, 57)' } : {}}>{cellText}</p>
          </Indicator>
        </div>
        <InfoMiniButton onClick={() => setToggleDescription(!toggleDescription)} />
        {hasAlternative && (
          <ConfirmMiniButton
            onClick={() => updateUserNote(alternativeCharge.userDescription)}
            disabled={fetching}
          />
        )}
      </div>
      {toggleDescription && fullDescription}
    </td>
  );
};
