import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { Indicator } from '@mantine/core';
import { useUpdateCharge } from '../../../hooks/use-update-charge.js';
import { ConfirmMiniButton, SimilarChargesByIdModal } from '../../common/index.js';

export type DescriptionProps = {
  chargeId: string;
  value?: string;
  isMissing?: boolean;
  suggestedDescription?: string;
  onChange: () => void;
};

export const Description = ({
  chargeId,
  value,
  isMissing,
  suggestedDescription,
  onChange,
}: DescriptionProps): ReactElement => {
  const [similarChargesOpen, setSimilarChargesOpen] = useState(false);
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

  const cellText = useMemo(() => {
    if (value && value !== '') {
      return value;
    }
    if (suggestedDescription) {
      return suggestedDescription;
    }
    return 'Missing';
  }, [value, suggestedDescription]);

  const hasAlternative = useMemo(
    () => isMissing && !!suggestedDescription?.length,
    [isMissing, suggestedDescription],
  );

  return (
    <>
      <div className="flex flex-wrap whitespace-normal">
        <Indicator inline size={12} disabled={!isMissing} color="red" zIndex="auto">
          <p className={hasAlternative ? 'bg-yellow-400' : undefined}>{cellText}</p>
        </Indicator>
        {hasAlternative && (
          <ConfirmMiniButton
            onClick={(event): void => {
              event.stopPropagation();
              updateUserDescription(suggestedDescription);
            }}
            disabled={fetching}
          />
        )}
      </div>

      <SimilarChargesByIdModal
        chargeId={chargeId}
        description={suggestedDescription ?? undefined}
        open={similarChargesOpen}
        onOpenChange={setSimilarChargesOpen}
        onClose={onChange}
      />
    </>
  );
};
