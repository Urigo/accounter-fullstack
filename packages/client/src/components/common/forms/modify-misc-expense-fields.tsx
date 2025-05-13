import { ReactElement } from 'react';
import { format } from 'date-fns';
import { TimelessDateString } from 'packages/client/src/helpers/dates.js';
import { Controller, UseFormReturn } from 'react-hook-form';
import { DatePickerInput, DateTimePicker } from '@mantine/dates';
import { type InsertMiscExpenseInput, type UpdateMiscExpenseInput } from '../../../gql/graphql.js';
import { TIMELESS_DATE_REGEX } from '../../../helpers/consts.js';
import { useGetFinancialEntities } from '../../../hooks/use-get-financial-entities.js';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form.js';
import { Input } from '../../ui/input.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select.js';
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
            <Select
              onValueChange={field.onChange}
              value={field.value ?? undefined}
              disabled={fetchingFinancialEntities}
              required={isInsert}
            >
              <FormControl>
                <SelectTrigger className="w-full truncate">
                  <SelectValue placeholder="Select a verified email to display" />
                </SelectTrigger>
              </FormControl>
              <SelectContent onClick={event => event.stopPropagation()}>
                {financialEntities.map(entity => (
                  <SelectItem key={entity.value} value={entity.value}>
                    {entity.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Select
              onValueChange={field.onChange}
              required={isInsert}
              value={field.value ?? undefined}
              disabled={fetchingFinancialEntities}
            >
              <FormControl>
                <SelectTrigger className="w-full truncate">
                  <SelectValue placeholder="Select a verified email to display" />
                </SelectTrigger>
              </FormControl>
              <SelectContent onClick={event => event.stopPropagation()}>
                {financialEntities.map(entity => (
                  <SelectItem key={entity.value} value={entity.value}>
                    {entity.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            message: 'Date must be im format yyyy-mm-dd',
          },
        }}
        render={({ field }) => {
          const date = field.value ? new Date(field.value) : undefined;
          return (
            <FormItem>
              <FormLabel>Invoice Date</FormLabel>
              <FormControl>
                <DatePickerInput
                  {...field}
                  required={isInsert}
                  onChange={(date?: Date | string | null): void => {
                    const newDate = date
                      ? typeof date === 'string'
                        ? date
                        : format(date, 'yyyy-MM-dd')
                      : undefined;
                    if (newDate !== field.value) {
                      setValue('invoiceDate', newDate as TimelessDateString);
                      field.onChange(newDate);
                    }
                  }}
                  value={date}
                  valueFormat="DD/MM/YYYY"
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
