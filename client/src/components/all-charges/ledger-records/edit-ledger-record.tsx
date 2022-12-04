import { showNotification } from '@mantine/notifications';
import gql from 'graphql-tag';
import { SubmitHandler, useForm } from 'react-hook-form';
import {
  EditLedgerRecordsFieldsFragment,
  UpdateLedgerRecordInput,
} from '../../../__generated__/types';
import { MakeBoolean, relevantDataPicker } from '../../../helpers';
import { useUpdateLedgerRecord } from '../../../hooks/use-update-ledger-record';
import { SimpleGrid } from '../../common/simple-grid';
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
    date3
    valueDate
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
  const { mutate, isLoading, isError, isSuccess } = useUpdateLedgerRecord();

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
    <div className="flex flex-row">
      <div className="px-5 h-max justify-items-center">
        <form onSubmit={handleSubmit(onSubmit)}>
          <SimpleGrid cols={5}>
            <LedgerRecordFields ledgerRecord={ledgerRecord} control={control} />
          </SimpleGrid>
          <div className="flex justify-center gap-5">
            <button
              type="submit"
              className="mt-8 text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-lg"
              disabled={isLoading || Object.keys(dirtyFields).length === 0}
              onClick={() => {
                if (isError) {
                  showNotification({
                    title: 'Error!',
                    message: 'Oh no!, we have an error! 🤥',
                  });
                }
                if (isSuccess) {
                  showNotification({
                    title: 'Update Success!',
                    message: 'Hey there, you add new ledger!',
                  });
                }
              }}
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
