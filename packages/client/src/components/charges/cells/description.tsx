import { ReactElement, useCallback, useMemo, useState } from 'react';
import { Indicator } from '@mantine/core';
import {
  ChargesTableDescriptionFieldsFragmentDoc,
  MissingChargeInfo,
} from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { useUpdateCharge } from '../../../hooks/use-update-charge.js';
import { ConfirmMiniButton, SimilarChargesByIdModal } from '../../common/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment ChargesTableDescriptionFields on Charge {
    id
    userDescription
    ... on Charge @defer {
      validationData {
        missingInfo
      }
      missingInfoSuggestions {
        description
      }
    }
  }
`;

type Props = {
  data: FragmentType<typeof ChargesTableDescriptionFieldsFragmentDoc>;
  onChange: () => void;
};

export const Description = ({ data, onChange }: Props): ReactElement => {
  const [similarChargesOpen, setSimilarChargesOpen] = useState(false);
  const charge = getFragmentData(ChargesTableDescriptionFieldsFragmentDoc, data);
  const isError = useMemo(
    () => charge?.validationData?.missingInfo?.includes(MissingChargeInfo.Description),
    [charge?.validationData?.missingInfo],
  );
  const hasAlternative = useMemo(
    () => isError && !!charge.missingInfoSuggestions?.description?.trim().length,
    [isError, charge.missingInfoSuggestions?.description],
  );
  const { userDescription, id: chargeId } = charge;
  const cellText = useMemo(() => {
    if (userDescription && userDescription?.trim() !== '') {
      return userDescription;
    }
    if (charge.missingInfoSuggestions?.description) {
      return charge.missingInfoSuggestions.description;
    }
    return 'Missing';
  }, [userDescription, charge.missingInfoSuggestions?.description]);

  const { updateCharge, fetching } = useUpdateCharge();

  const updateUserDescription = useCallback(
    async (value?: string) => {
      if (value !== undefined) {
        await updateCharge({
          chargeId,
          fields: { userDescription: value },
        });
        setSimilarChargesOpen(true);
      }
    },
    [chargeId, updateCharge],
  );

  return (
    <td>
      <div className="flex flex-wrap">
        <div className="flex flex-col justify-center">
          <Indicator inline size={12} disabled={!isError} color="red" zIndex="auto">
            <p className={hasAlternative ? 'bg-yellow-400' : undefined}>{cellText}</p>
          </Indicator>
        </div>
        {hasAlternative && (
          <ConfirmMiniButton
            onClick={(event): void => {
              event.stopPropagation();
              updateUserDescription(charge.missingInfoSuggestions!.description!);
            }}
            disabled={fetching}
          />
        )}
      </div>

      <SimilarChargesByIdModal
        chargeId={chargeId}
        description={charge.missingInfoSuggestions?.description ?? undefined}
        open={similarChargesOpen}
        onOpenChange={setSimilarChargesOpen}
        onClose={onChange}
      />
    </td>
  );
};
