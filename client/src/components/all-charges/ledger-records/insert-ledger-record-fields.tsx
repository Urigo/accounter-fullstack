import { format } from 'date-fns';
import { Control, Controller } from 'react-hook-form';
import {
  Currency,
  EditLedgerRecordsFieldsFragment,
  InsertLedgerRecordInput,
  UpdateLedgerRecordInput,
} from '../../../__generated__/types';
import { TIMELESS_DATE_REGEX } from '../../../helpers/consts';
import { CurrencyInput, NumberInput, TextInput } from '../../common/inputs';

type Props = {
  ledgerRecord: Partial<EditLedgerRecordsFieldsFragment>;
  control: Control<UpdateLedgerRecordInput | InsertLedgerRecordInput, unknown>;
};

export const InsertLedgerRecordFields = ({ ledgerRecord, control }: Props) => {
  return (
    <>
      <Controller
        name="creditAccount.name"
        control={control}
        defaultValue={ledgerRecord.creditAccount?.name}
        rules={{ required: 'Required' }}
        render={({ field, fieldState }) => (
          <TextInput {...field} error={fieldState.error?.message} label="Credit Account" />
        )}
      />
      <Controller
        name="debitAccount.name"
        control={control}
        defaultValue={ledgerRecord.debitAccount?.name}
        rules={{ required: 'Required' }}
        render={({ field, fieldState }) => (
          <TextInput {...field} error={fieldState.error?.message} label="Debit Account" />
        )}
      />
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
        render={({ field, fieldState }) => (
          <TextInput {...field} error={fieldState.error?.message} label="Date" />
        )}
      />

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

      <Controller
        name="localCurrencyAmount.raw"
        control={control}
        defaultValue={ledgerRecord.localCurrencyAmount?.raw}
        render={({ field: amountField, fieldState: amountFieldState }) => (
          <Controller
            name="localCurrencyAmount.currency"
            control={control}
            defaultValue={ledgerRecord.localCurrencyAmount?.currency ?? Currency.Ils}
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
    </>
  );
};
