import { SubmitHandler, useForm } from 'react-hook-form';
import { FragmentType, getFragmentData } from '../../../gql';
import {
  EditDbLedgerRecordsFieldsFragmentDoc,
  UpdateDbLedgerRecordInput,
} from '../../../gql/graphql';
import { MakeBoolean, relevantDataPicker } from '../../../helpers';
import { useUpdateDbLedgerRecord } from '../../../hooks/use-update-db-ledger-record';
import { SimpleGrid } from '../../common';
import { EditDbLedgerRecordFields } from './edit-db-ledger-record-fields';

// /* GraphQL */`
//   fragment EditLedgerRecordsFields on LedgerRecord {
//     id
//     creditAccount {
//       name
//     }
//     debitAccount {
//       name
//     }
//     date
//     date3
//     valueDate
//     description
//     localCurrencyAmount {
//       raw
//       currency
//     }
//     originalAmount {
//       raw
//       currency
//     }
//     hashavshevetId
//   }
// `;

/* GraphQL */ `
  fragment EditDbLedgerRecordsFields on LedgerRecord {
    id
    credit_account_1
    credit_account_2
    credit_amount_1
    credit_amount_2
    currency
    date3
    debit_account_1
    debit_account_2
    debit_amount_1
    debit_amount_2
    details
    foreign_credit_amount_1
    foreign_credit_amount_2
    foreign_debit_amount_1
    foreign_debit_amount_2
    hashavshevet_id
    invoice_date
    movement_type
    reference_1
    reference_2
    reviewed
    value_date
  }
`;

type Props = {
  ledgerRecordProps: FragmentType<typeof EditDbLedgerRecordsFieldsFragmentDoc>;
  onAccept?: () => void;
  onCancel?: () => void;
};

export const EditLedgerRecord = ({ ledgerRecordProps, onAccept, onCancel }: Props) => {
  const ledgerRecord = getFragmentData(EditDbLedgerRecordsFieldsFragmentDoc, ledgerRecordProps);
  const {
    control,
    handleSubmit,
    formState: { dirtyFields },
    setValue,
    unregister,
    watch,
  } = useForm<UpdateDbLedgerRecordInput>({ defaultValues: ledgerRecord });
  const { updateDbLedgerRecord, fetching } = useUpdateDbLedgerRecord();

  function isAccountActive(account?: string | null) {
    return Boolean(account && account !== '');
  }

  const onSubmit: SubmitHandler<UpdateDbLedgerRecordInput> = data => {
    if (isAccountActive(data.credit_account_1)) {
      data.credit_amount_1 = undefined;
      data.foreign_credit_amount_1 = undefined;
    }
    if (isAccountActive(data.credit_account_2)) {
      data.credit_amount_2 = undefined;
      data.foreign_credit_amount_2 = undefined;
    }
    if (isAccountActive(data.debit_account_1)) {
      data.debit_amount_1 = undefined;
      data.foreign_debit_amount_1 = undefined;
    }
    if (isAccountActive(data.debit_account_2)) {
      data.debit_amount_2 = undefined;
      data.foreign_debit_amount_2 = undefined;
    }

    const dataToUpdate = relevantDataPicker(data, dirtyFields as MakeBoolean<typeof data>);
    if (dataToUpdate && Object.keys(dataToUpdate).length > 0) {
      updateDbLedgerRecord({
        ledgerRecordId: ledgerRecord.id,
        fields: dataToUpdate,
      });
      if (onAccept) {
        onAccept();
      }
    }
  };

  return (
    <div className="flex flex-row">
      <div className="px-5 h-max justify-items-center">
        <form onSubmit={handleSubmit(onSubmit)}>
          <SimpleGrid cols={5}>
            {/* <EditLedgerRecordFields ledgerRecord={ledgerRecord} control={control} /> */}
            {/* TEMPORARY: the form is replaced to represent full DB record. should be reverted after DB is updated. */}
            <EditDbLedgerRecordFields
              ledgerRecordProps={ledgerRecordProps}
              control={control}
              setValue={setValue}
              unregister={unregister}
              watch={watch}
            />
          </SimpleGrid>
          <div className="flex justify-center gap-5">
            <button
              type="submit"
              className="mt-8 text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-lg"
              disabled={fetching || Object.keys(dirtyFields).length === 0}
            >
              Accept
            </button>
            <button
              type="button"
              className="mt-8 text-white bg-rose-500 border-0 py-2 px-8 focus:outline-none hover:bg-rose-600 rounded text-lg"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
