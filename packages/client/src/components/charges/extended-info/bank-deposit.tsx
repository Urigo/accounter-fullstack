import { useCallback, useState, type ReactElement } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from 'urql';
import { DepositsTransactionsTable } from '@/components/bank-deposits/index.js';
import { Alert, AlertDescription } from '@/components/ui/alert.js';
import { Button } from '@/components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { BankDepositInfoDocument } from '../../../gql/graphql.js';
import { useAssignChargeToDeposit } from '../../../hooks/use-assign-charge-to-deposit.js';
import { useCreateDepositFromCharge } from '../../../hooks/use-create-deposit-from-charge.js';
import { useRelevantDepositsForCharge } from '../../../hooks/use-relevant-deposits-for-charge.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query BankDepositInfo($chargeId: UUID!) {
    depositByCharge(chargeId: $chargeId) {
      id
      name
      metadata {
        id
        currentBalance {
          formatted
        }
        transactions {
          id
          chargeId
          ...TransactionForTransactionsTableFields
        }
      }
      isOpen
    }
  }
`;

type Props = {
  chargeId: string;
  onChange?: () => void;
};

export const ChargeBankDeposit = ({ chargeId, onChange }: Props): ReactElement => {
  // Existing deposit info for this charge
  const [{ data: depositData, fetching: fetchingDeposit }] = useQuery({
    query: BankDepositInfoDocument,
    variables: { chargeId },
  });

  const {
    fetching: fetchingRelevant,
    deposits: relevantDeposits,
    conflictError,
  } = useRelevantDepositsForCharge(chargeId);

  const { creating: creatingDeposit, createDepositFromCharge } = useCreateDepositFromCharge();
  const { assigning: assigningDeposit, assignChargeToDeposit } = useAssignChargeToDeposit();

  const [selectedDepositId, setSelectedDepositId] = useState<string | undefined>(undefined);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newDepositName, setNewDepositName] = useState('');

  const onCreateDeposit = useCallback(async () => {
    const depositId = await createDepositFromCharge({ chargeId, name: newDepositName });
    if (depositId) {
      setCreateDialogOpen(false);
      setNewDepositName('');
      onChange?.();
    }
  }, [createDepositFromCharge, newDepositName, chargeId, onChange]);

  const onAssign = useCallback(
    async (depositId: string) => {
      await assignChargeToDeposit({ chargeId, depositId });
      onChange?.();
    },
    [assignChargeToDeposit, chargeId, onChange],
  );

  // Show the full-section loader only on the initial load — when there's nothing
  // to render yet. During background refetches and while create/assign mutations
  // run, keep the current content visible (mutation progress is surfaced via the
  // inline button states) so the section doesn't blink.
  const hasContent =
    !!depositData?.depositByCharge || relevantDeposits.length > 0 || !!conflictError;
  const isInitialLoading = (fetchingDeposit || fetchingRelevant) && !hasContent;

  const createDialogNode = (
    <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Bank Deposit</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="deposit-name-input">Deposit Name</Label>
            <Input
              id="deposit-name-input"
              value={newDepositName}
              onChange={e => setNewDepositName(e.target.value)}
              placeholder="e.g. Savings Deposit 2026"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="secondary"
            disabled={creatingDeposit || !newDepositName.trim()}
            onClick={onCreateDeposit}
          >
            {creatingDeposit ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (isInitialLoading) {
    return <Loader2 className="h-10 w-10 animate-spin" />;
  }

  if (depositData?.depositByCharge) {
    const dep = depositData.depositByCharge;
    return (
      <div>
        <div className="text-lg font-semibold mb-4">
          Bank Deposit &quot;{dep.name}&quot; Balance: {dep.metadata.currentBalance.formatted}
        </div>
        <div className="mb-4">
          <span className="text-sm text-gray-500">
            {dep.isOpen ? 'Deposit is open' : 'Deposit is closed'}
          </span>
        </div>
        <DepositsTransactionsTable depositId={dep.id} />
      </div>
    );
  }

  if (conflictError) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>{conflictError}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (relevantDeposits.length === 1) {
    const suggested = relevantDeposits[0];
    return (
      <div className="space-y-4">
        <div className="text-sm text-gray-500">Suggested deposit:</div>
        <div className="flex items-center gap-3">
          <span className="font-medium">
            {suggested.name} ({suggested.currency})
          </span>
          <Button
            variant="secondary"
            disabled={assigningDeposit}
            onClick={() => onAssign(suggested.id)}
          >
            {assigningDeposit ? 'Assigning…' : 'Assign'}
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => setCreateDialogOpen(true)}>
          Create New Deposit Instead
        </Button>
        {createDialogNode}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-500">
        {relevantDeposits.length === 0
          ? 'No matching open deposits found.'
          : 'Select an open deposit to assign this charge to:'}
      </div>
      {relevantDeposits.length > 1 && (
        <div className="flex items-center gap-2">
          <Select value={selectedDepositId} onValueChange={setSelectedDepositId}>
            <SelectTrigger className="min-w-[220px]">
              <SelectValue placeholder="Select deposit" />
            </SelectTrigger>
            <SelectContent>
              {relevantDeposits.map(d => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name} ({d.currency})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="secondary"
            disabled={!selectedDepositId || assigningDeposit}
            onClick={() => selectedDepositId && onAssign(selectedDepositId)}
          >
            {assigningDeposit ? 'Assigning…' : 'Assign'}
          </Button>
        </div>
      )}
      <Button variant="outline" onClick={() => setCreateDialogOpen(true)}>
        Create New Deposit
      </Button>
      {createDialogNode}
    </div>
  );
};
