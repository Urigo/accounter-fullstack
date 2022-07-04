import { Control, Controller } from 'react-hook-form';

import {
  EditLedgerRecordsFieldsFragment,
  InsertLedgerRecordInput,
  UpdateLedgerRecordInput,
} from '../../../__generated__/types';
import { TIMELESS_DATE_REGEX } from '../../../helpers/consts';
import { CurrencyInput, NumberInput, TextInput } from '../../common/inputs';

type Props = {
  ledgerRecord: Partial<EditLedgerRecordsFieldsFragment>;
  control: Control<UpdateLedgerRecordInput | InsertLedgerRecordInput, any>;
};

export const LedgerRecordFields = ({ ledgerRecord, control }: Props) => {
  return (
    <>
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
            rules={{
              required: 'Required',
              pattern: {
                value: TIMELESS_DATE_REGEX,
                message: 'Date must be im format yyyy-mm-dd',
              },
            }}
            render={({ field, fieldState }) => <TextInput {...field} error={fieldState.error?.message} label="Date" />}
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
                value={!field || field.value === 'Missing' ? '' : field.value!}
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
            defaultValue={ledgerRecord.localCurrencyAmount?.raw}
            render={({ field: amountField, fieldState: amountFieldState }) => (
              <Controller
                name="localCurrencyAmount.currency"
                control={control}
                defaultValue={ledgerRecord.localCurrencyAmount?.currency}
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
            defaultValue={ledgerRecord.originalAmount?.raw}
            render={({ field: amountField, fieldState: amountFieldState }) => (
              <Controller
                name="originalAmount.currency"
                control={control}
                defaultValue={ledgerRecord.originalAmount?.currency}
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
      <div className="p-2 sm:w-1/2 w-full">
        <div className="bg-gray-100 rounded flex p-4 h-full items-center">
          <Controller
            name="hashavshevetId"
            control={control}
            defaultValue={ledgerRecord.hashavshevetId}
            render={({ field: { value, ...field }, fieldState }) => {
              const adjustedValue = value ?? undefined;
              return (
                <NumberInput
                  precision={0}
                  value={adjustedValue}
                  {...field}
                  error={fieldState.error?.message}
                  label="Hashavshevet ID"
                />
              );
            }}
          />
        </div>
      </div>
    </>
  );
};
