import { TextInput } from '@mantine/core';
import { format } from 'date-fns';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';

import { InsertLedgerRecordInput } from '../../../__generated__/types';
import { MakeBoolean, relevantDataPicker } from '../../../helpers';
import { TIMELESS_DATE_REGEX } from '../../../helpers/consts';
import { useInsertLedgerRecord } from '../../../hooks/use-insert-ledger-record';
import { LedgerRecordFields } from './ledger-record-fields';

type Props = {
  chargeId: string;
  closeModal?: () => void;
};

export const InsertLedgerRecord = ({ chargeId, closeModal }: Props) => {
  const {
    control,
    handleSubmit,
    formState: { dirtyFields },
  } = useForm<InsertLedgerRecordInput>();
  const { mutate, isLoading } = useInsertLedgerRecord();

  const onSubmit: SubmitHandler<InsertLedgerRecordInput> = data => {
    const dataToUpdate = relevantDataPicker(data, dirtyFields as MakeBoolean<typeof data>);
    if (dataToUpdate && Object.keys(dataToUpdate).length > 0) {
      mutate({
        chargeId,
        record: dataToUpdate,
      });
      if (closeModal) {
        closeModal();
      }
    }
  };

  return (
    <form className="text-gray-600 body-font" onSubmit={handleSubmit(onSubmit)}>
      <div className="container px-5 py-24 mx-auto">
        <div className="text-center mb-20">
          <h1 className="sm:text-3xl text-2xl font-medium text-center title-font text-gray-900 mb-4">
            Insert Ledger Record
          </h1>
          <p>to charge ID: {chargeId}</p>
        </div>
        <div className="flex flex-wrap lg:w-4/5 sm:mx-auto sm:mb-2 -mx-2">
          <LedgerRecordFields ledgerRecord={{}} control={control} />
          <div className="p-2 sm:w-1/2 w-full">
            <div className="bg-gray-100 rounded flex p-4 h-full items-center">
              <Controller
                name="valueDate"
                control={control}
                rules={{
                  required: 'Required',
                  pattern: {
                    value: TIMELESS_DATE_REGEX,
                    message: 'Date must be im format yyyy-mm-dd',
                  },
                  validate: value => {
                    try {
                      format(new Date(value), 'yyyy-MM-dd');
                      return;
                    } catch {
                      return 'Invalid date input';
                    }
                  },
                }}
                render={({ field, fieldState }) => (
                  <TextInput {...field} error={fieldState.error?.message} label="Value Date" />
                )}
              />
            </div>
          </div>
          <div className="p-2 sm:w-1/2 w-full">
            <div className="bg-gray-100 rounded flex p-4 h-full items-center">
              <Controller
                name="date3"
                control={control}
                rules={{
                  required: 'Required',
                  pattern: {
                    value: TIMELESS_DATE_REGEX,
                    message: 'Date must be im format yyyy-mm-dd',
                  },
                }}
                render={({ field, fieldState }) => (
                  <TextInput {...field} error={fieldState.error?.message} label="Date3" />
                )}
              />
            </div>
          </div>
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
            onClick={closeModal}
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
};
