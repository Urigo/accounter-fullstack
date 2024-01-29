import { ReactElement, useState } from 'react';
import { RefreshDot } from 'tabler-icons-react';
import { ActionIcon, ActionIconProps, Tooltip } from '@mantine/core';
import { ConfirmationModal } from '..';
import { useRegenerateLedgerRecords } from '../../../hooks/use-regenerate-ledger-records.js';

type Props = {
  chargeId: string;
} & ActionIconProps;

export function RegenerateLedgerRecordsButton({ chargeId, ...buttonProps }: Props): ReactElement {
  const [opened, setOpened] = useState(false);
  const { regenerateLedgerRecords } = useRegenerateLedgerRecords();

  function onRegenerate(): void {
    regenerateLedgerRecords({
      chargeId,
    });
    setOpened(false);
  }

  return (
    <>
      <ConfirmationModal
        opened={opened}
        onClose={(): void => setOpened(false)}
        onConfirm={onRegenerate}
        title="Are you sure you want to regenerate ledger records?"
      />
      <Tooltip label="Regenerate Ledger">
        <ActionIcon onClick={(): void => setOpened(true)} {...buttonProps}>
          <RefreshDot size={20} />
        </ActionIcon>
      </Tooltip>
    </>
  );
}
