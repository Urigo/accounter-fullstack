import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { useQuery } from 'urql';
import { AllDepositsDocument } from '../../gql/graphql.js';
import { useAssignTransactionToDeposit } from '../../hooks/use-assign-transaction-to-deposit.js';
import { Button } from '../ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog.js';
import { Label } from '../ui/label.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select.js';

type Props = {
  depositId: string;
  transactionId: string;
  refetch?: () => void;
};

export function DepositReassignDialog({ depositId, transactionId, refetch }: Props): ReactElement {
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [targetDepositId, setTargetDepositId] = useState<string | undefined>(undefined);

  const [{ data: allDepositsData }] = useQuery({
    query: AllDepositsDocument,
    pause: !reassignDialogOpen,
  });

  const { assigning, assignTransactionToDeposit } = useAssignTransactionToDeposit();

  const openDeposits = useMemo(
    () => (allDepositsData?.allDeposits ?? []).filter(d => d.isOpen && d.id !== depositId),
    [allDepositsData?.allDeposits, depositId],
  );

  const handleReassignClick = useCallback((transactionId: string) => {
    setSelectedTransactionId(transactionId);
    setTargetDepositId(undefined);
  }, []);

  const handleReassign = useCallback(async () => {
    if (!selectedTransactionId || !targetDepositId) return;
    await assignTransactionToDeposit({
      transactionId: selectedTransactionId,
      depositId: targetDepositId,
    });
    setReassignDialogOpen(false);
    setSelectedTransactionId(null);
    setTargetDepositId(undefined);
    refetch?.();
  }, [assignTransactionToDeposit, selectedTransactionId, targetDepositId, refetch]);

  return (
    <Dialog open={reassignDialogOpen} onOpenChange={setReassignDialogOpen}>
      <DialogTrigger>
        <Button variant="ghost" size="sm" onClick={() => handleReassignClick(transactionId)}>
          Reassign
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reassign Transaction</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="target-deposit-select">Target Deposit</Label>
            <Select value={targetDepositId} onValueChange={val => setTargetDepositId(val)}>
              <SelectTrigger className="min-w-[220px]">
                <SelectValue
                  id="target-deposit-select"
                  placeholder={openDeposits.length ? 'Select deposit' : 'No open deposits'}
                />
              </SelectTrigger>
              <SelectContent>
                {openDeposits.map(d => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.id} ({d.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="secondary"
            disabled={!targetDepositId || assigning}
            onClick={handleReassign}
          >
            {assigning ? 'Reassigning…' : 'Reassign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
