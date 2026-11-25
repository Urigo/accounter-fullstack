import { useCallback, useContext, useEffect, useState, type ReactElement } from 'react';
import { format } from 'date-fns';
import { useQuery } from 'urql';
import { ConfirmationModal } from '@/components/common/index.js';
import { Button } from '@/components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Textarea } from '@/components/ui/textarea.js';
import { useLedgerLock } from '@/hooks/use-ledger-lock.js';
import { useLedgerUnlock } from '@/hooks/use-ledger-unlock.js';
import { UserContext } from '@/providers/user-provider.js';
import { AdminLedgerLockDateDocument } from '../../../../../gql/graphql.js';
import type { TimelessDateString } from '../../../../../helpers/dates.js';
import { BaseStepCard, type BaseStepProps, type StepStatus } from '../step-base.js';

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

export function Step08LedgerLock(props: Step08Props): ReactElement {
  const [status, setStatus] = useState<StepStatus>('pending');
  const [open, setOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const { fetching: lockingLedger, ledgerLock } = useLedgerLock();
  const { fetching: unlockingLedger, ledgerUnlock } = useLedgerUnlock();
  const { refreshUserContext } = useContext(UserContext);

  const { adminBusinessId, id, onStatusChange, year } = props;
  const ledgerLockDate = `${year}-12-31` as TimelessDateString;
  const [reopenDate, setReopenDate] = useState<string>(`${year - 1}-12-31`);
  const [reason, setReason] = useState('');

  const [{ data, fetching }, refetchLedgerLockDate] = useQuery({
    query: AdminLedgerLockDateDocument,
    variables: {
      ownerId: adminBusinessId,
    },
  });

  // Take the lock date from the fresh query, not the user context loaded at login
  const currentLockDate = data?.adminContext?.ledgerLock ?? null;

  // Report status changes to parent
  useEffect(() => onStatusChange?.(id, status), [status, onStatusChange, id]);

  // update status
  useEffect(() => {
    if (fetching || lockingLedger || unlockingLedger) {
      setStatus('loading');
    } else if (!data) {
      setStatus('blocked');
    } else if (!currentLockDate || currentLockDate < ledgerLockDate) {
      setStatus('pending');
    } else {
      setStatus('completed');
    }
  }, [data, fetching, ledgerLockDate, lockingLedger, unlockingLedger, currentLockDate]);

  const onLockChanged = useCallback(() => {
    refetchLedgerLockDate({ requestPolicy: 'network-only' });
    // other screens read the lock date from the user context
    refreshUserContext?.();
  }, [refetchLedgerLockDate, refreshUserContext]);

  const onLedgerLockClicked = useCallback(async () => {
    await ledgerLock({ date: ledgerLockDate });
    onLockChanged();
  }, [ledgerLockDate, ledgerLock, onLockChanged]);

  const onReopenConfirmed = useCallback(async () => {
    const reopened = await ledgerUnlock({
      date: reopenDate as TimelessDateString,
      reason: reason.trim(),
    });
    if (reopened) {
      setReopenOpen(false);
      setReason('');
      onLockChanged();
    }
  }, [ledgerUnlock, reopenDate, reason, onLockChanged]);

  const isLocked = !!currentLockDate && currentLockDate >= ledgerLockDate;

  return (
    <>
      <BaseStepCard
        {...props}
        status={status}
        actions={[
          {
            label: 'Lock Ledger',
            onClick: () => setOpen(true),
            disabled: isLocked || fetching,
          },
          {
            label: 'Reopen Ledger',
            onClick: () => setReopenOpen(true),
            disabled: !currentLockDate || fetching,
          },
        ]}
      />
      <ConfirmationModal
        onConfirm={onLedgerLockClicked}
        title={`Are you sure you want to lock all ledger records until ${format(new Date(ledgerLockDate), 'MMMM do, yyy')}?`}
        open={open}
        setOpen={setOpen}
      />
      <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reopen ledger</DialogTitle>
            <DialogDescription>
              The ledger is locked until {currentLockDate}. Move the lock date back to post new
              entries, such as audit adjustments, in the reopened period. Records that were already
              locked stay locked. This action is logged.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="reopen-date">New lock date</Label>
              <Input
                id="reopen-date"
                type="date"
                value={reopenDate}
                onChange={e => setReopenDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="reopen-reason">Reason</Label>
              <Textarea
                id="reopen-reason"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. posting auditor adjustments"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopenOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={onReopenConfirmed}
              disabled={
                !reason.trim() ||
                !reopenDate ||
                unlockingLedger ||
                (!!currentLockDate && reopenDate >= currentLockDate)
              }
            >
              Reopen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
