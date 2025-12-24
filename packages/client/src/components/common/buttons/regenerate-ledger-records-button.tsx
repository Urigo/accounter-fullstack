import type { ComponentProps, ReactElement } from 'react';
import { RefreshCcwDot } from 'lucide-react';
import { useRegenerateLedgerRecords } from '../../../hooks/use-regenerate-ledger-records.js';
import { cn } from '../../../lib/utils.js';
import { Button } from '../../ui/button.js';
import { ConfirmationModal, Tooltip } from '../index.js';

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
    <Tooltip content="Regenerate Ledger">
      <ConfirmationModal
        onConfirm={onRegenerate}
        title="Are you sure you want to regenerate ledger records?"
      >
        <Button
          variant="outline"
          size="icon"
          {...buttonProps}
          className={cn('size-7.5', buttonProps.className)}
        >
          <RefreshCcwDot className="size-5" />
        </Button>
      </ConfirmationModal>
    </Tooltip>
  );
}
