import { ReactElement, useCallback, useMemo } from 'react';
import { Indicator } from '@mantine/core';
import { FragmentOf, graphql, readFragment } from '../../../graphql.js';
import { useUpdateCharge } from '../../../hooks/use-update-charge.js';
import { ConfirmMiniButton } from '../../common/index.js';

export const AllChargesDescriptionFieldsFragmentDoc = graphql(`
  fragment AllChargesDescriptionFields on Charge {
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
`);

type Props = {
  data: FragmentOf<typeof AllChargesDescriptionFieldsFragmentDoc>;
  onChange: () => void;
};

export const Description = ({ data, onChange }: Props): ReactElement => {
  const charge = readFragment(AllChargesDescriptionFieldsFragmentDoc, data);
  const isError = useMemo(
    () =>
      'validationData' in charge
        ? charge.validationData?.missingInfo?.includes('DESCRIPTION')
        : undefined,
    [charge],
  );
  const hasAlternative = useMemo(
    () =>
      isError &&
      'missingInfoSuggestions' in charge &&
      !!charge.missingInfoSuggestions?.description?.trim().length,
    [isError, charge],
  );
  const { userDescription, id: chargeId } = charge;
  const cellText = useMemo(
    () =>
      userDescription?.trim() ??
      ('missingInfoSuggestions' in charge && charge.missingInfoSuggestions?.description) ??
      'Missing',
    [userDescription, charge],
  );

  const { updateCharge, fetching } = useUpdateCharge();

  const updateUserDescription = useCallback(
    (value?: string) => {
      if (value !== undefined) {
        updateCharge({
          chargeId,
          fields: { userDescription: value },
        }).then(onChange);
      }
    },
    [chargeId, updateCharge, onChange],
  );

  return (
    <td>
      <div className="flex flex-wrap">
        <div className="flex flex-col justify-center">
          <Indicator inline size={12} disabled={!isError} color="red" zIndex="auto">
            <p className={hasAlternative ? 'bg-yellow-400' : undefined}>{cellText}</p>
          </Indicator>
        </div>
        {hasAlternative && 'missingInfoSuggestions' in charge && (
          <ConfirmMiniButton
            onClick={(event): void => {
              event.stopPropagation();
              updateUserDescription(charge.missingInfoSuggestions!.description!);
            }}
            disabled={fetching}
          />
        )}
      </div>
    </td>
  );
};
