import type { ReactElement } from 'react';
import { format } from 'date-fns';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { DateTimePicker } from '@mantine/dates';
import { type InsertMiscExpenseInput, type UpdateMiscExpenseInput } from '../../../gql/graphql.js';
import { TIMELESS_DATE_REGEX } from '../../../helpers/consts.js';
import type { TimelessDateString } from '../../../helpers/dates.js';
import { useGetFinancialEntities } from '../../../hooks/use-get-financial-entities.js';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form.js';
import { Input } from '../../ui/input.js';
import { ComboBox, CurrencyInput, DatePickerInput } from '../index.js';

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
  const { control, setValue } = formManager;

  const { selectableFinancialEntities: financialEntities, fetching: fetchingFinancialEntities } =
    useGetFinancialEntities();

  return (
    <>
      <FormField
        name="creditorId"
        control={control}
        rules={{
          required: isInsert ? 'Required' : undefined,
        }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Creditor</FormLabel>
            <ComboBox
              {...field}
              data={financialEntities}
              value={field.value ?? undefined}
              disabled={fetchingFinancialEntities}
              placeholder="Select creditor"
              formPart
            />
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        name="debtorId"
        control={control}
        rules={{
          required: isInsert ? 'Required' : undefined,
        }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Debtor</FormLabel>
            <ComboBox
              {...field}
              data={financialEntities}
              value={field.value ?? undefined}
              disabled={fetchingFinancialEntities}
              placeholder="Select debtor"
              formPart
            />
            <FormMessage />
          </FormItem>
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
      <FormField
        name="invoiceDate"
        control={control}
        rules={{
          ...(isInsert ? { required: 'Required' } : {}),
          pattern: {
            value: TIMELESS_DATE_REGEX,
            message: 'Date must be in format yyyy-mm-dd',
          },
        }}
        render={({ field, fieldState }) => {
          const date = field.value ? new Date(field.value) : undefined;
          return (
            <FormItem>
              <FormLabel>Invoice Date</FormLabel>
              <FormControl>
                <DatePickerInput
                  id="misc-expense-invoice-date"
                  required={isInsert}
                  onChange={(date?: Date | null): void => {
                    const newDate = date ? format(date, 'yyyy-MM-dd') : undefined;
                    if (newDate !== field.value) {
                      setValue('invoiceDate', newDate as TimelessDateString);
                      field.onChange(newDate);
                    }
                  }}
                  value={date}
                  aria-invalid={!!fieldState.error}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          );
        }}
      />
      <FormField
        name="valueDate"
        control={control}
        rules={{
          ...(isInsert ? { required: 'Required' } : {}),
          validate: (value?: Date | null) => {
            if (!value) return true;
            return !Number.isNaN(value.getTime()) || 'Invalid date and time format';
          },
        }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Value Date</FormLabel>
            <FormControl>
              <DateTimePicker
                {...field}
                onChange={(date?: Date | null): void => {
                  setValue('valueDate', date);
                  field.onChange(date);
                }}
                onPointerEnterCapture={(): void => {}}
                onPointerLeaveCapture={(): void => {}}
                required={isInsert}
                placeholder="Pick date and time"
                valueFormat="DD/MM/YYYY HH:mm:ss"
                withSeconds
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        name="description"
        control={control}
        rules={{
          required: isInsert ? 'Required' : undefined,
        }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Input {...field} required={isInsert} value={field.value ?? undefined} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
};
