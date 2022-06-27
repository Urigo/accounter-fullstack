import { TextInput } from '@mantine/core';
import gql from 'graphql-tag';
import moment from 'moment';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';

import { EditLedgerRecordsFieldsFragment } from '../../../__generated__/types';
import { MakeBoolean, relevantDataPicker } from '../../../helpers';
import { useUpdateLedgerRecord } from '../../../hooks/use-update-ledger-record';
import { CurrencyInput } from '../../common/inputs';

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
  }
`;

type Props = {
  ledgerRecord: EditLedgerRecordsFieldsFragment;
};

export const EditLedgerRecord = ({ ledgerRecord }: Props) => {
  const {
    control,
    handleSubmit,
    formState: { dirtyFields },
  } = useForm<EditLedgerRecordsFieldsFragment>();
  const { mutate, isLoading } = useUpdateLedgerRecord();

  const onSubmit: SubmitHandler<EditLedgerRecordsFieldsFragment> = data => {
    const dataToUpdate = relevantDataPicker(data, dirtyFields as MakeBoolean<typeof data>);
    if (Object.keys(dataToUpdate ?? {}).length > 0) {
      mutate({
        ledgerRecordId: ledgerRecord.id,
        fields: { date: dataToUpdate },
      });
    }
  };

  return (
    <form className="text-gray-600 body-font" onSubmit={handleSubmit(onSubmit)}>
      <div className="container px-5 py-24 mx-auto">
        <div className="text-center mb-20">
          <h1 className="sm:text-3xl text-2xl font-medium text-center title-font text-gray-900 mb-4">
            Edit Ledger Record
          </h1>
        </div>
        <div className="flex flex-wrap lg:w-4/5 sm:mx-auto sm:mb-2 -mx-2">
          <div className="p-2 sm:w-1/2 w-full">
            <div className="bg-gray-100 rounded flex p-4 h-full items-center">
              <Controller
                name="creditAccount.name"
                control={control}
                defaultValue={ledgerRecord.creditAccount?.name}
                rules={{ required: 'Required' }}
                render={({ field, fieldState }) => (
                  <TextInput {...field} error={fieldState.error?.message} label="Credit Account" />
                )}
              />
            </div>
          </div>
          <div className="p-2 sm:w-1/2 w-full">
            <div className="bg-gray-100 rounded flex p-4 h-full items-center">
              <Controller
                name="debitAccount.name"
                control={control}
                defaultValue={ledgerRecord.debitAccount?.name}
                rules={{ required: 'Required' }}
                render={({ field, fieldState }) => (
                  <TextInput {...field} error={fieldState.error?.message} label="Debit Account" />
                )}
              />
            </div>
          </div>
          <div className="p-2 sm:w-1/2 w-full">
            <div className="bg-gray-100 rounded flex p-4 h-full items-center">
              <Controller
                name="date"
                control={control}
                defaultValue={ledgerRecord.date}
                rules={{ required: 'Required' }}
                render={({ field: { value, ...fieldProps }, fieldState }) => {
                  // TODO: update after adding DATE scalar (for timeless dates)
                  const parsedDate = moment(value).format('YYYY-MM-DD');
                  return (
                    <TextInput {...fieldProps} value={parsedDate} error={fieldState.error?.message} label="Date" />
                  );
                }}
              />
            </div>
          </div>
          <div className="p-2 sm:w-1/2 w-full">
            <div className="bg-gray-100 rounded flex p-4 h-full items-center">
              <Controller
                name="description"
                control={control}
                defaultValue={ledgerRecord.description}
                render={({ field, fieldState }) => (
                  <TextInput
                    {...field}
                    value={field.value === 'Missing' ? '' : field.value}
                    error={fieldState.error?.message}
                    label="Description"
                  />
                )}
              />
            </div>
          </div>
          <div className="p-2 sm:w-1/2 w-full">
            <div className="bg-gray-100 rounded flex p-4 h-full items-center">
              <Controller
                name="localCurrencyAmount.raw"
                control={control}
                defaultValue={ledgerRecord.localCurrencyAmount.raw}
                render={({ field: amountField, fieldState: amountFieldState }) => (
                  <Controller
                    name="localCurrencyAmount.currency"
                    control={control}
                    defaultValue={ledgerRecord.localCurrencyAmount.currency}
                    render={({ field: currencyCodeField, fieldState: currencyCodeFieldState }) => (
                      <CurrencyInput
                        {...amountField}
                        error={amountFieldState.error?.message || currencyCodeFieldState.error?.message}
                        label="Local Currency"
                        currencyCodeProps={{ ...currencyCodeField, label: 'Currency', disabled: true }}
                      />
                    )}
                  />
                )}
              />
            </div>
          </div>
          <div className="p-2 sm:w-1/2 w-full">
            <div className="bg-gray-100 rounded flex p-4 h-full items-center">
              <Controller
                name="originalAmount.raw"
                control={control}
                defaultValue={ledgerRecord.originalAmount.raw}
                render={({ field: amountField, fieldState: amountFieldState }) => (
                  <Controller
                    name="originalAmount.currency"
                    control={control}
                    defaultValue={ledgerRecord.originalAmount.currency}
                    render={({ field: currencyCodeField, fieldState: currencyCodeFieldState }) => (
                      <CurrencyInput
                        {...amountField}
                        error={amountFieldState.error?.message || currencyCodeFieldState.error?.message}
                        label="Original Currency"
                        currencyCodeProps={{ ...currencyCodeField, label: 'Currency' }}
                      />
                    )}
                  />
                )}
              />
            </div>
          </div>
        </div>
        <button
          type="submit"
          className="flex mx-auto mt-16 text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-lg"
          disabled={isLoading || Object.keys(dirtyFields).length === 0}
        >
          Accept
        </button>
      </div>
    </form>
  );
};
