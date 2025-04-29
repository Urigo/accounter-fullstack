import { ReactElement } from 'react';
import { RefreshDot } from 'tabler-icons-react';
import { ActionIcon, ActionIconProps, Tooltip } from '@mantine/core';
import { useRegenerateLedgerRecords } from '../../../hooks/use-regenerate-ledger-records.js';
import { ConfirmationModal } from '../index.js';

type Props = {
  chargeId: string;
  onChange: () => void;
} & ActionIconProps;

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
        <ActionIcon {...buttonProps}>
          <RefreshDot size={20} />
        </ActionIcon>
      </Tooltip>
    </ConfirmationModal>
  );
}
