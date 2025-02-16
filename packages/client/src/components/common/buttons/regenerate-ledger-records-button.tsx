import { ReactElement, useState } from 'react';
import { RefreshDot } from 'tabler-icons-react';
import { Tooltip } from '@mantine/core';
import { useRegenerateLedgerRecords } from '../../../hooks/use-regenerate-ledger-records.js';
import { ActionIcon } from '../../ui/action-icon.js';
import { ConfirmationModal } from '../index.js';

type Props = {
  chargeId: string;
  onChange: () => void;
};

export function RegenerateLedgerRecordsButton({ chargeId, onChange }: Props): ReactElement {
  const [opened, setOpened] = useState(false);
  const { regenerateLedgerRecords } = useRegenerateLedgerRecords();

  function onRegenerate(): void {
    regenerateLedgerRecords({
      chargeId,
    }).then(onChange);
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
        <ActionIcon
          onClick={(event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void => {
            event.stopPropagation();
            setOpened(true);
          }}
        >
          <RefreshDot size={20} />
        </ActionIcon>
      </Tooltip>
    </>
  );
}
