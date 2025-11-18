import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { Loader2 } from 'lucide-react';
import { useQuery } from 'urql';
import { DepositsTransactionsTable } from '@/components/bank-deposits/index.js';
import { Button } from '@/components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import { Label } from '@/components/ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import {
  AllDepositsDocument,
  BankDepositInfoDocument,
  ChargeTransactionIdsDocument,
  Currency,
} from '../../../gql/graphql.js';
import { useAssignTransactionToDeposit } from '../../../hooks/use-assign-transaction-to-deposit.js';
import { useCreateDeposit } from '../../../hooks/use-create-deposit.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query BankDepositInfo($chargeId: UUID!) {
    depositByCharge(chargeId: $chargeId) {
      id
      balance {
        formatted
      }
      transactions {
        id
        chargeId
        ...TransactionForTransactionsTableFields
      }
      isOpen
    }
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query ChargeTransactionIds($chargeId: UUID!) {
    charge(chargeId: $chargeId) {
      id
      transactions {
        id
      }
    }
  }
`;

type Props = {
  chargeId: string;
};

export const ChargeBankDeposit = ({ chargeId }: Props): ReactElement => {
  // Existing deposit info for this charge
  const [{ data: depositData, fetching: fetchingDeposit }] = useQuery({
    query: BankDepositInfoDocument,
    variables: { chargeId },
  });

  // All deposits for selection (we filter open client-side)
  const [{ data: allDepositsData, fetching: fetchingAllDeposits }] = useQuery({
    query: AllDepositsDocument,
  });

  // Charge transactions to obtain transactionId when no deposit yet
  const [{ data: chargeTxData, fetching: fetchingChargeTx }] = useQuery({
    query: ChargeTransactionIdsDocument,
    variables: { chargeId },
  });

  const { creating: creatingDeposit, createDeposit } = useCreateDeposit();
  const { assigning: assigningDeposit, assignTransactionToDeposit } =
    useAssignTransactionToDeposit();

  const [selectedDepositId, setSelectedDepositId] = useState<string | undefined>(undefined);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newDepositCurrency, setNewDepositCurrency] = useState<Currency>('ILS');

  const openDeposits = useMemo(
    () => (allDepositsData?.allDeposits ?? []).filter(d => d.isOpen),
    [allDepositsData?.allDeposits],
  );

  const transactionIdForAssignment = useMemo(
    () => chargeTxData?.charge?.transactions?.[0]?.id,
    [chargeTxData?.charge?.transactions],
  );

  const onCreateDeposit = useCallback(async () => {
    await createDeposit({ currency: newDepositCurrency });
    setCreateDialogOpen(false);
    // TODO: refetch deposits list or set selectedDepositId from result
  }, [createDeposit, newDepositCurrency]);

  const onAssign = useCallback(async () => {
    if (!selectedDepositId || !transactionIdForAssignment) return;
    await assignTransactionToDeposit({
      transactionId: transactionIdForAssignment,
      depositId: selectedDepositId,
    });
    // TODO: refetch deposit info
  }, [assignTransactionToDeposit, selectedDepositId, transactionIdForAssignment]);

  const isLoading =
    fetchingDeposit ||
    fetchingAllDeposits ||
    fetchingChargeTx ||
    creatingDeposit ||
    assigningDeposit;

  return isLoading ? (
    <Loader2 className="h-10 w-10 animate-spin" />
  ) : depositData?.depositByCharge ? (
    <div>
      <div className="text-lg font-semibold mb-4">
        Bank Deposit "{depositData?.depositByCharge?.id}" Balance:{' '}
        {depositData?.depositByCharge?.balance.formatted}
      </div>
      <div className="mb-4">
        <span className="text-sm text-gray-500">
          {depositData?.depositByCharge?.isOpen ? 'Deposit is open' : 'Deposit is closed'}
        </span>
      </div>
      <DepositsTransactionsTable depositId={depositData.depositByCharge.id} />
    </div>
  ) : (
    <div className="space-y-4">
      <div className="text-sm text-gray-500">No bank deposit found for this charge.</div>
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Select value={selectedDepositId} onValueChange={val => setSelectedDepositId(val)}>
            <SelectTrigger className="min-w-[220px]">
              <SelectValue
                placeholder={openDeposits.length ? 'Select open deposit' : 'No open deposits'}
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
          <Button
            variant="secondary"
            disabled={!selectedDepositId || assigningDeposit}
            onClick={onAssign}
          >
            {assigningDeposit ? 'Assigning…' : 'Assign'}
          </Button>
        </div>
        <Button variant="outline" onClick={() => setCreateDialogOpen(true)}>
          Create New Deposit
        </Button>
      </div>
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Bank Deposit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="deposit-currency-select">Currency</Label>
              <Select
                value={newDepositCurrency}
                onValueChange={val => setNewDepositCurrency(val as Currency)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue id="deposit-currency-select" />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(Currency).map(c => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" disabled={creatingDeposit} onClick={onCreateDeposit}>
              {creatingDeposit ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
