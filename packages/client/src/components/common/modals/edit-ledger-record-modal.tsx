import { useCallback, useContext, useMemo, useState, type ReactElement } from 'react';
import { Currency, type LedgerRecordsTableFieldsFragment } from '../../../gql/graphql.js';
import { useUpdateLedgerRecord } from '../../../hooks/use-update-ledger-record.js';
import { UserContext } from '../../../providers/user-provider.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog.js';
import { LedgerRecordForm } from '../forms/ledger-record-form/index.js';
import {
  formValuesToLedgerRecordInput,
  ledgerRecordToFormValues,
  type LedgerRecordFormValues,
} from '../forms/ledger-record-form/schema.js';

type Props = {
  /** The stored record to edit; the dialog is open while it is set */
  record: LedgerRecordsTableFieldsFragment | null;
  /** Called when the dialog closes, whether dismissed or after a successful save */
  onClose: () => void;
  /** Called after the record was updated, to refresh its charge */
  onDone: () => void;
};

/** Dialog for editing an unlocked stored ledger record, prefilled with its current values */
export function EditLedgerRecordModal({ record, onClose, onDone }: Props): ReactElement {
  const { userContext } = useContext(UserContext);
  const localCurrency = (userContext?.context.defaultLocalCurrency || Currency.Ils) as Currency;
  const { fetching, updateLedgerRecord } = useUpdateLedgerRecord();

  // The last record shown, kept after `record` turns null so the form stays rendered while the
  // dialog's close animation runs (instead of the body collapsing to empty)
  const [shownRecord, setShownRecord] = useState(record);
  if (record && record !== shownRecord) {
    setShownRecord(record);
  }

  const defaultValues = useMemo(
    () => (shownRecord ? ledgerRecordToFormValues(shownRecord) : undefined),
    [shownRecord],
  );

  const onSubmit = useCallback(
    async (values: LedgerRecordFormValues): Promise<void> => {
      if (!record) {
        return;
      }
      const result = await updateLedgerRecord({
        ledgerRecordId: record.id,
        input: formValuesToLedgerRecordInput(values, { localCurrency }),
      });
      // On a CommonError the hook already toasted it: keep the dialog open so the user can fix it
      if (result) {
        onClose();
        onDone();
      }
    },
    [record, updateLedgerRecord, localCurrency, onClose, onDone],
  );

  return (
    <Dialog
      open={record != null}
      onOpenChange={open => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-screen overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit ledger record</DialogTitle>
          <DialogDescription>
            Overwrites the stored record. The misc expense or document behind it is not changed.
          </DialogDescription>
        </DialogHeader>
        {shownRecord && (
          <LedgerRecordForm
            // A fresh form per record, so its default values are this record's
            key={shownRecord.id}
            mode="edit"
            defaultValues={defaultValues}
            submitting={fetching}
            onSubmit={onSubmit}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
