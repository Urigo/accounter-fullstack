import { ReactElement } from 'react';
import { format } from 'date-fns';
import { Controller, UseFormReturn } from 'react-hook-form';
import { Select, TextInput } from '@mantine/core';
import { DatePickerInput, DateTimePicker } from '@mantine/dates';
import { type InsertMiscExpenseInput, type UpdateMiscExpenseInput } from '../../../gql/graphql.js';
import { TIMELESS_DATE_REGEX } from '../../../helpers/consts.js';
import { useGetFinancialEntities } from '../../../hooks/use-get-financial-entities.js';
import { CurrencyInput } from '../index.js';

interface Props<T extends boolean> {
  isInsert: T;
  formManager: UseFormReturn<
    InsertMiscExpenseInput | UpdateMiscExpenseInput,
    unknown,
    InsertMiscExpenseInput | UpdateMiscExpenseInput
  >;
}

export const ModifyMiscExpenseFields = ({
  formManager,
  isInsert,
}: Props<boolean>): ReactElement => {
  const { control } = formManager;

  const { selectableFinancialEntities: financialEntities, fetching: fetchingFinancialEntities } =
    useGetFinancialEntities();

  return (
    <>
      <Controller
        name="creditorId"
        control={control}
        rules={{
          required: isInsert ? 'Required' : undefined,
        }}
        render={({ field, fieldState }): ReactElement => (
          <Select
            {...field}
            required={isInsert}
            data={financialEntities}
            value={field.value}
            disabled={fetchingFinancialEntities}
            label="Creditor"
            placeholder="Scroll to see all options"
            maxDropdownHeight={160}
            searchable
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        name="debtorId"
        control={control}
        rules={{
          required: isInsert ? 'Required' : undefined,
        }}
        render={({ field, fieldState }): ReactElement => (
          <Select
            {...field}
            required={isInsert}
            data={financialEntities}
            value={field.value}
            disabled={fetchingFinancialEntities}
            label="Debtor"
            placeholder="Scroll to see all options"
            maxDropdownHeight={160}
            searchable
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        name="amount"
        control={control}
        rules={{
          required: isInsert ? 'Required' : undefined,
        }}
        render={({ field: amountField, fieldState: amountFieldState }): ReactElement => (
          <Controller
            name="currency"
            control={control}
            rules={{
              required: isInsert ? 'Required' : undefined,
            }}
            render={({
              field: currencyCodeField,
              fieldState: currencyCodeFieldState,
            }): ReactElement => (
              <CurrencyInput
                {...amountField}
                required={isInsert}
                value={amountField.value ?? undefined}
                error={amountFieldState.error?.message || currencyCodeFieldState.error?.message}
                label="Amount"
                currencyCodeProps={{
                  ...currencyCodeField,
                  required: isInsert,
                  label: 'Currency',
                }}
              />
            )}
          />
        )}
      />
      <Controller
        name="invoiceDate"
        control={control}
        rules={{
          required: isInsert ? 'Required' : undefined,
          pattern: {
            value: TIMELESS_DATE_REGEX,
            message: 'Date must be im format yyyy-mm-dd',
          },
        }}
        render={({ field: { value, ...field } }): ReactElement => {
          const date = value ? new Date(value) : undefined;
          return (
            <DatePickerInput
              {...field}
              required={isInsert}
              onChange={(date?: Date | string | null): void => {
                const newDate = date
                  ? typeof date === 'string'
                    ? date
                    : format(date, 'yyyy-MM-dd')
                  : undefined;
                if (newDate !== value) field.onChange(newDate);
              }}
              value={date}
              label="Invoice Date"
              valueFormat="DD/MM/YYYY"
              popoverProps={{ withinPortal: true }}
            />
          );
        }}
      />
      <Controller
        name="valueDate"
        control={control}
        rules={{
          required: isInsert ? 'Required' : undefined,
          validate: (value?: Date | null) => {
            if (!value) return true;
            return !Number.isNaN(value.getTime()) || 'Invalid date and time format';
          },
        }}
        render={({ field }): ReactElement => {
          return (
            <DateTimePicker
              {...field}
              onPointerEnterCapture={(): void => {}}
              onPointerLeaveCapture={(): void => {}}
              required={isInsert}
              label="Value Date"
              placeholder="Pick date and time"
              valueFormat="DD/MM/YYYY HH:mm:ss"
              popoverProps={{ withinPortal: true }}
              withSeconds
            />
          );
        }}
      />
      <Controller
        name="description"
        control={control}
        rules={{
          required: isInsert ? 'Required' : undefined,
        }}
        render={({ field, fieldState }): ReactElement => (
          <TextInput
            {...field}
            required={isInsert}
            value={field.value ?? undefined}
            error={fieldState.error?.message}
            label="Description"
          />
        )}
      />
    </>
  );
};
