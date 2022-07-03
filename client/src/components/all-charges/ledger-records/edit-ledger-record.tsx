import gql from 'graphql-tag';
import { SubmitHandler, useForm } from 'react-hook-form';

import { EditLedgerRecordsFieldsFragment, UpdateLedgerRecordInput } from '../../../__generated__/types';
import { MakeBoolean, relevantDataPicker } from '../../../helpers';
import { useUpdateLedgerRecord } from '../../../hooks/use-update-ledger-record';
import { LedgerRecordFields } from './ledger-record-fields';

gql`
  fragment EditLedgerRecordsFields on LedgerRecord {
    id
    creditAccount {
      name
    }
    debitAccount {
      name
    }
    date
    description
    localCurrencyAmount {
      raw
      currency
    }
    originalAmount {
      raw
      currency
    }
    hashavshevetId
  }
`;

type Props = {
  ledgerRecord: EditLedgerRecordsFieldsFragment;
  onAccept?: () => void;
  onCancel?: () => void;
};

export const EditLedgerRecord = ({ ledgerRecord, onAccept, onCancel }: Props) => {
  const {
    control,
    handleSubmit,
    formState: { dirtyFields },
  } = useForm<UpdateLedgerRecordInput>({ defaultValues: ledgerRecord });
  const { mutate, isLoading } = useUpdateLedgerRecord();

  const onSubmit: SubmitHandler<UpdateLedgerRecordInput> = data => {
    const dataToUpdate = relevantDataPicker(data, dirtyFields as MakeBoolean<typeof data>);
    if (dataToUpdate && Object.keys(dataToUpdate).length > 0) {
      mutate({
        ledgerRecordId: ledgerRecord.id,
        fields: dataToUpdate,
      });
      if (onAccept) {
        onAccept();
      }
    }
  };

  return (
    <form className="text-gray-600 body-font" onSubmit={handleSubmit(onSubmit)}>
      <div className="container px-5 py-24 mx-auto">
        <div className="text-center mb-20">
          <h1 className="sm:text-3xl text-2xl font-medium text-center title-font text-gray-900 mb-4">
            Edit Ledger Record
          </h1>
          <p>ID: {ledgerRecord.id}</p>
        </div>
        <div className="flex flex-wrap lg:w-4/5 sm:mx-auto sm:mb-2 -mx-2">
          <LedgerRecordFields ledgerRecord={ledgerRecord} control={control} />
        </div>
        <div className="container flex justify-center gap-20">
          <button
            type="submit"
            className="mt-8 text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-lg"
            disabled={isLoading || Object.keys(dirtyFields).length === 0}
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
      </div>
    </form>
  );
};
