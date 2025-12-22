import { useState, type ReactElement } from 'react';
import { ListPlus } from 'lucide-react';
import { useQuery } from 'urql';
import { MiscExpenseTransactionFieldsDocument } from '../../../gql/graphql.js';
import { Button } from '../../ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../ui/dialog.js';
import { InsertMiscExpense, Tooltip } from '../index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query MiscExpenseTransactionFields($transactionId: UUID!) {
    transactionsByIDs(transactionIDs: [$transactionId]) {
      id
      chargeId
      amount {
        raw
        currency
      }
      eventDate
      effectiveDate
      exactEffectiveDate
      counterparty {
        id
      }
    }
  }
`;

interface Props {
  chargeId: string;
  transactionId: string;
  onDone?: () => void;
}

export const InsertMiscExpenseModal = ({
  onDone,
  transactionId,
  chargeId,
}: Props): ReactElement => {
  const [dialogOpen, setDialogOpen] = useState(false);

  const [{ data: transactionData, fetching: fetchingTransaction }] = useQuery({
    query: MiscExpenseTransactionFieldsDocument,
    pause: !transactionId,
    variables: {
      transactionId,
    },
  });

  const transaction = transactionData?.transactionsByIDs[0];

  function onInsertDone(): void {
    setDialogOpen(false);
    onDone?.();
  }
  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Tooltip content="Insert Related Misc Expense">
          <Button variant="ghost" size="icon" className="size-7.5" disabled={fetchingTransaction}>
            <ListPlus className="size-5" />
          </Button>
        </Tooltip>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Insert Misc Expense</DialogTitle>
        </DialogHeader>
        {transaction && (
          <InsertMiscExpense
            onDone={onInsertDone}
            chargeId={chargeId}
            defaultValues={{
              amount: transaction?.amount.raw ? Math.abs(transaction?.amount.raw) : undefined,
              currency: transaction?.amount.currency,
              invoiceDate: transaction?.eventDate,
              valueDate:
                transaction?.exactEffectiveDate || transaction?.effectiveDate
                  ? new Date(transaction.exactEffectiveDate ?? transaction.effectiveDate!)
                  : undefined,
              creditorId:
                (transaction?.amount.raw ?? 0) > 0 ? transaction?.counterparty?.id : undefined,
              debtorId:
                (transaction?.amount.raw ?? 0) < 0 ? transaction?.counterparty?.id : undefined,
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
