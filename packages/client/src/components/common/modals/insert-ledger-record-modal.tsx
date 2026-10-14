import { useCallback, useContext, useMemo, useState, type ReactElement } from 'react';
import { Plus } from 'lucide-react';
import { Currency } from '../../../gql/graphql.js';
import { useInsertLedgerRecord } from '../../../hooks/use-insert-ledger-record.js';
import { UserContext } from '../../../providers/user-provider.js';
import { Button } from '../../ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../ui/dialog.js';
import { LedgerRecordForm } from '../forms/ledger-record-form/index.js';
import {
  formValuesToLedgerRecordInput,
  type LedgerRecordFormValues,
} from '../forms/ledger-record-form/schema.js';
import { Tooltip } from '../tooltip.js';

type Props = {
  /** The charge to add the record to; without one, the server creates a new charge for it */
  chargeId?: string;
  /** A financial entity to prefill Debit 1 with, e.g. the business in view */
  defaultEntityId?: string;
  /** Called after a record was inserted, to refresh the host view */
  onDone: () => void;
};

/**
 * "+" button that opens a dialog for manually adding a ledger record to a charge, or, without a
 * `chargeId`, to a new charge created with it
 */
export function InsertLedgerRecordModal({
  chargeId,
  defaultEntityId,
  onDone,
}: Props): ReactElement {
  const [open, setOpen] = useState(false);
  const { userContext } = useContext(UserContext);
  const localCurrency = (userContext?.context.defaultLocalCurrency || Currency.Ils) as Currency;
  const { fetching, insertLedgerRecord } = useInsertLedgerRecord();
  const label = chargeId ? 'Add ledger record' : 'Add ledger record (new charge)';
  const defaultValues = useMemo(
    () => (defaultEntityId ? { debitEntity1: defaultEntityId } : undefined),
    [defaultEntityId],
  );

  const onSubmit = useCallback(
    async (values: LedgerRecordFormValues): Promise<void> => {
      if (!values.operation) {
        return;
      }
      const result = await insertLedgerRecord({
        ...(chargeId ? { chargeId } : {}),
        operation: values.operation,
        input: formValuesToLedgerRecordInput(values, { localCurrency }),
      });
      // On a CommonError the hook already toasted it: keep the dialog open so the user can fix it
      if (result) {
        setOpen(false);
        onDone();
      }
    },
    [chargeId, insertLedgerRecord, localCurrency, onDone],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip content={label} asChild>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" className="size-7.5" aria-label={label}>
            <Plus className="size-5" />
          </Button>
        </DialogTrigger>
      </Tooltip>
      <DialogContent className="max-h-screen overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add ledger record</DialogTitle>
          <DialogDescription>
            {chargeId
              ? 'Creates the ledger record together with the misc expense or document it represents.'
              : 'Creates a new charge, with the ledger record and the misc expense or document it represents.'}
          </DialogDescription>
        </DialogHeader>
        {open && (
          <LedgerRecordForm
            mode="insert"
            defaultValues={defaultValues}
            submitting={fetching}
            onSubmit={onSubmit}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
