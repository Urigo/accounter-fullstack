import { useState } from 'react';
import { Switch } from '@mantine/core';
import { useToggleLedgerRecordAccountantApproval } from '../../../../hooks/use-toggle-ledger-record-accountant-approval';

interface Props {
  ledgerRecordId: string;
  approved: boolean;
}

export function AccountantApproval({ ledgerRecordId, approved: initialApprovedState }: Props) {
  const [checked, setChecked] = useState(initialApprovedState);
  const { mutate } = useToggleLedgerRecordAccountantApproval();

  function onToggle(approved: boolean) {
    setChecked(approved);
    mutate({
      ledgerRecordId,
      approved,
    });
  }

  return (
    <td>
      <div className="flex flex-row justify-center">
        <Switch
          color="green"
          checked={checked}
          onChange={event => onToggle(event.currentTarget.checked)}
          styles={{
            root: { cursor: 'pointer' },
            body: { cursor: 'pointer' },
            input: { cursor: 'pointer' },
            track: { cursor: 'pointer' },
            thumb: { cursor: 'pointer' },
            trackLabel: { cursor: 'pointer' },
            labelWrapper: { cursor: 'pointer' },
          }}
        />
      </div>
    </td>
  );
}
