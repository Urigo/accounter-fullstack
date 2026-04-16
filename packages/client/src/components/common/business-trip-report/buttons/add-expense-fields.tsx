import { useContext, useEffect, useMemo, useState, type ReactElement } from 'react';
import { type Control } from 'react-hook-form';
import { toast } from 'sonner';
import { useQuery } from 'urql';
import { Select } from '@mantine/core';
import {
  AttendeesByBusinessTripDocument,
  Currency,
  type AddBusinessTripTravelAndSubsistenceExpenseInput,
} from '../../../../gql/graphql.js';
import { TIMELESS_DATE_REGEX } from '../../../../helpers/index.js';
import { UserContext } from '../../../../providers/user-provider.js';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../../ui/form.js';
import { CurrencyInput, DatePickerInput } from '../../index.js';

export type AddBusinessTripExpenseInput = Omit<
  AddBusinessTripTravelAndSubsistenceExpenseInput,
  'expenseType'
>;

type ModalProps = {
  businessTripId: string;
  control: Control<AddBusinessTripExpenseInput, unknown>;
  setFetching: (fetching: boolean) => void;
};

export function AddExpenseFields({
  businessTripId,
  control,
  setFetching,
}: ModalProps): ReactElement {
  const [attendees, setAttendees] = useState<Array<{ value: string; label: string }>>([]);
  const [{ data, fetching: fetchingAttendees, error }] = useQuery({
    query: AttendeesByBusinessTripDocument,
    variables: { businessTripId },
  });
  const { userContext } = useContext(UserContext);

  // On every new data fetch, reorder results by name
  useEffect(() => {
    if (data?.businessTrip?.attendees.length) {
      setAttendees(
        data.businessTrip.attendees
          .map(attendee => ({
            value: attendee.id,
            label: attendee.name,
          }))
          .sort((a, b) => (a.label > b.label ? 1 : -1)),
      );
    }
  }, [data, setAttendees]);

  useEffect(() => {
    setFetching(fetchingAttendees);
  }, [setFetching, fetchingAttendees]);

  useEffect(() => {
    if (error) {
      toast.error('Error', {
        description: 'Oops, we have an error fetching attendees',
      });
    }
  }, [error]);

  const ledgerLock = useMemo(() => userContext?.context.ledgerLock, [userContext]);

  return (
    <>
      <FormField
        name="date"
        control={control}
        rules={{
          min: ledgerLock
            ? {
                value: ledgerLock,
                message: `Date must be after ${ledgerLock}`,
              }
            : undefined,
          pattern: {
            value: TIMELESS_DATE_REGEX,
            message: 'Date must be in format yyyy-mm-dd',
          },
        }}
        render={({ field, fieldState }): ReactElement => (
          <FormItem>
            <FormLabel htmlFor="expense-date">Date</FormLabel>
            <FormControl>
              <DatePickerInput
                id="expense-date"
                data-autofocus
                value={field.value ?? undefined}
                onChange={date => {
                  if (date !== field.value) field.onChange(date);
                }}
                aria-invalid={!!fieldState.error}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        name="valueDate"
        control={control}
        rules={{
          pattern: {
            value: TIMELESS_DATE_REGEX,
            message: 'Date must be in format yyyy-mm-dd',
          },
          min: ledgerLock
            ? {
                value: ledgerLock,
                message: `Date must be after ${ledgerLock}`,
              }
            : undefined,
        }}
        render={({ field, fieldState }): ReactElement => (
          <FormItem>
            <FormLabel htmlFor="expense-value-date">Value Date</FormLabel>
            <FormControl>
              <DatePickerInput
                id="expense-value-date"
                value={field.value ?? undefined}
                onChange={date => {
                  if (date !== field.value) field.onChange(date);
                }}
                aria-invalid={!!fieldState.error}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        name="amount"
        control={control}
        render={({ field: amountField, fieldState: amountFieldState }): ReactElement => (
          <FormField
            name="currency"
            control={control}
            defaultValue={Currency.Ils}
            render={({
              field: currencyCodeField,
              fieldState: currencyCodeFieldState,
            }): ReactElement => (
              <CurrencyInput
                {...amountField}
                value={amountField.value ?? undefined}
                error={amountFieldState.error?.message || currencyCodeFieldState.error?.message}
                label="Amount"
                currencyCodeProps={{
                  ...currencyCodeField,
                  label: 'Currency',
                }}
              />
            )}
          />
        )}
      />
      <FormField
        name="employeeBusinessId"
        control={control}
        render={({ field, fieldState }): ReactElement => (
          <FormItem>
            <FormLabel>Attendee</FormLabel>
            <FormControl>
              <Select
                {...field}
                data={attendees}
                value={field.value}
                disabled={fetchingAttendees}
                placeholder="Scroll to see all options"
                maxDropdownHeight={160}
                searchable
                error={fieldState.error?.message}
                withinPortal
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
