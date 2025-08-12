import { type ReactElement } from 'react';
import { Unlink } from 'lucide-react';
import { EMPTY_UUID } from '../../../helpers/index.js';
import { useUpdateTransaction } from '../../../hooks/use-update-transaction.js';
import { Button } from '../../ui/button.js';
import { ConfirmationModal } from '../index.js';

interface Props {
  transactionId: string;
}

export function UnlinkTransactionButton({ transactionId }: Props): ReactElement {
  const { updateTransaction } = useUpdateTransaction();

  function onUnlink(): void {
    updateTransaction({
      transactionId,
      fields: { chargeId: EMPTY_UUID },
    });
  }

  return (
    <ConfirmationModal
      onConfirm={onUnlink}
      title="Are you sure you want to unlink this transaction from the charge?"
    >
      <Button variant="ghost" size="icon" className="size-7.5">
        <Unlink className="size-5" />
      </Button>
    </ConfirmationModal>
  );
}
