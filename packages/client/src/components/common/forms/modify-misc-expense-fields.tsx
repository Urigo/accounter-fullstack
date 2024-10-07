import { ReactElement, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Controller, UseFormReturn } from 'react-hook-form';
import { useQuery } from 'urql';
import { Select, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { showNotification } from '@mantine/notifications';
import {
  AllFinancialEntitiesDocument,
  type InsertMiscExpenseInput,
  type UpdateMiscExpenseInput,
} from '../../../gql/graphql.js';
import { TIMELESS_DATE_REGEX } from '../../../helpers/consts.js';
import { CurrencyInput } from '../index.js';

interface Props<T extends boolean> {
  isInsert: T;
  formManager: UseFormReturn<InsertMiscExpenseInput | UpdateMiscExpenseInput, unknown, undefined>;
}

export const ModifyMiscExpenseFields = ({
  formManager,
  isInsert,
}: Props<boolean>): ReactElement => {
  const { control } = formManager;
  const [financialEntities, setFinancialEntities] = useState<
    Array<{ value: string; label: string }>
  >([]);

  const [
    {
      data: financialEntitiesData,
      fetching: fetchingFinancialEntities,
      error: financialEntitiesError,
    },
  ] = useQuery({
    query: AllFinancialEntitiesDocument,
  });

  useEffect(() => {
    if (financialEntitiesError) {
      showNotification({
        title: 'Error!',
        message: 'Oh no!, we have an error fetching financial entities! 🤥',
        color: 'red',
      });
    }
  }, [financialEntitiesError]);

  useEffect(() => {
    if (financialEntitiesData?.allFinancialEntities?.nodes.length) {
      setFinancialEntities(
        financialEntitiesData.allFinancialEntities.nodes
          .map(entity => ({
            value: entity.id,
            label: entity.name,
          }))
          .sort((a, b) => (a.label > b.label ? 1 : -1)),
      );
    }
  }, [financialEntitiesData, setFinancialEntities]);

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
          pattern: {
            value: TIMELESS_DATE_REGEX,
            message: 'Date must be im format yyyy-mm-dd',
          },
        }}
        render={({ field }): ReactElement => (
          <DatePickerInput
            {...field}
            required={isInsert}
            label="Value Date"
            popoverProps={{ withinPortal: true }}
          />
        )}
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
