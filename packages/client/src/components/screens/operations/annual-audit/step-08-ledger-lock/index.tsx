import { useCallback, useContext, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { useQuery } from 'urql';
import { ConfirmationModal } from '@/components/common/index.js';
import { useLedgerLock } from '@/hooks/use-ledger-lock.js';
import { UserContext } from '@/providers/user-provider.js';
import { AdminLedgerLockDateDocument } from '../../../../../gql/graphql.js';
import type { TimelessDateString } from '../../../../../helpers/dates.js';
import { BaseStepCard, type BaseStepProps, type StepStatus } from '../step-base.jsx';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query AdminLedgerLockDate($ownerId: UUID) {
    adminContext(ownerId: $ownerId) {
      id
      ledgerLock
    }
  }
`;

interface Step08Props extends BaseStepProps {
  year: number;
  adminBusinessId?: string;
}

export function Step08LedgerLock(props: Step08Props) {
  const [status, setStatus] = useState<StepStatus>('pending');
  const [open, setOpen] = useState(false);
  const { fetching: lockingLedger, ledgerLock } = useLedgerLock();

  const { adminBusinessId, id, onStatusChange, year } = props;
  const ledgerLockDate = `${year}-12-31` as TimelessDateString;

  const [{ data, fetching }, refetchLedgerLockDate] = useQuery({
    query: AdminLedgerLockDateDocument,
    variables: {
      ownerId: adminBusinessId,
    },
  });

  // Report status changes to parent
  useEffect(() => onStatusChange?.(id, status), [status, onStatusChange, id]);

  // update status
  useEffect(() => {
    if (fetching || lockingLedger) {
      setStatus('loading');
    } else if (!data) {
      setStatus('blocked');
    } else if (!data.adminContext?.ledgerLock || data.adminContext.ledgerLock < ledgerLockDate) {
      setStatus('pending');
    } else {
      setStatus('completed');
    }
  }, [data, fetching, ledgerLockDate, lockingLedger]);

  const onLedgerLockClicked = useCallback(async () => {
    ledgerLock({ date: ledgerLockDate }).then(() => refetchLedgerLockDate());
  }, [ledgerLockDate, ledgerLock, refetchLedgerLockDate]);

  const { userContext } = useContext(UserContext);
  const currentLockDate = userContext?.context.ledgerLock;

  return (
    <>
      <BaseStepCard
        {...props}
        status={status}
        actions={[
          {
            label: 'Lock Ledger',
            onClick: () => setOpen(true),
            disabled: !!currentLockDate && currentLockDate >= ledgerLockDate,
          },
        ]}
      />
      <ConfirmationModal
        onConfirm={onLedgerLockClicked}
        title={`Are you sure you want to lock all ledger records until ${format(new Date(ledgerLockDate), 'MMMM do, yyy')}?`}
        open={open}
        setOpen={setOpen}
      />
    </>
  );
}
