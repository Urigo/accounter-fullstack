import type { ComponentProps, ReactElement } from 'react';
import { RefreshDot } from 'tabler-icons-react';
import { Tooltip } from '@mantine/core';
import { useRegenerateLedgerRecords } from '../../../hooks/use-regenerate-ledger-records.js';
import { Button } from '../../ui/button.js';
import { ConfirmationModal } from '../index.js';

type Props = {
  chargeId: string;
  onChange: () => void;
} & ComponentProps<typeof Button>;

export function RegenerateLedgerRecordsButton({
  chargeId,
  onChange,
  ...buttonProps
}: Props): ReactElement {
  const { regenerateLedgerRecords } = useRegenerateLedgerRecords();

  function onRegenerate(): void {
    regenerateLedgerRecords({
      chargeId,
    }).then(onChange);
  }

  return (
    <ConfirmationModal
      onConfirm={onRegenerate}
      title="Are you sure you want to regenerate ledger records?"
    >
      <Tooltip label="Regenerate Ledger">
        <Button
          variant="outline"
          size="icon"
          {...buttonProps}
          className={cn('size-7.5', buttonProps.className)}
        >
          <RefreshDot className="size-5" />
        </Button>
      </Tooltip>
    </ConfirmationModal>
  );
}
