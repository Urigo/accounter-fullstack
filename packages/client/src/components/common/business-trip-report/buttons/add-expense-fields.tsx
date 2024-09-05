import { ReactElement, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Control, Controller } from 'react-hook-form';
import { useQuery } from 'urql';
import { Select } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { showNotification } from '@mantine/notifications';
import {
  AddBusinessTripFlightsExpenseInput,
  AttendeesByBusinessTripDocument,
  Currency,
} from '../../../../gql/graphql.js';
import { TIMELESS_DATE_REGEX } from '../../../../helpers/index.js';
import { CurrencyInput } from '../../index.js';

type ModalProps = {
  businessTripId: string;
  control: Control<AddBusinessTripFlightsExpenseInput, unknown>;
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
      showNotification({
        title: 'Error!',
        message: 'Oops, we have an error fetching attendees',
      });
    }
  }, [error]);

  return (
    <>
      <Controller
        name="date"
        control={control}
        rules={{
          pattern: {
            value: TIMELESS_DATE_REGEX,
            message: 'Date must be im format yyyy-mm-dd',
          },
        }}
        render={({ field, fieldState }): ReactElement => (
          <DatePickerInput
            data-autofocus
            {...field}
            onChange={(date?: Date | string | null): void => {
              const newDate = date
                ? typeof date === 'string'
                  ? date
                  : format(date, 'yyyy-MM-dd')
                : undefined;
              if (newDate !== field.value) field.onChange(newDate);
            }}
            value={field.value ? new Date(field.value) : undefined}
            error={fieldState.error?.message}
            label="Date"
            popoverProps={{ withinPortal: true }}
          />
        )}
      />
      <Controller
        name="valueDate"
        control={control}
        rules={{
          pattern: {
            value: TIMELESS_DATE_REGEX,
            message: 'Date must be im format yyyy-mm-dd',
          },
        }}
        render={({ field, fieldState }): ReactElement => (
          <DatePickerInput
            {...field}
            onChange={(date?: Date | string | null): void => {
              const newDate = date
                ? typeof date === 'string'
                  ? date
                  : format(date, 'yyyy-MM-dd')
                : undefined;
              if (newDate !== field.value) field.onChange(newDate);
            }}
            value={field.value ? new Date(field.value) : undefined}
            error={fieldState.error?.message}
            label="Value Date"
            popoverProps={{ withinPortal: true }}
          />
        )}
      />
      <Controller
        name="amount"
        control={control}
        render={({ field: amountField, fieldState: amountFieldState }): ReactElement => (
          <Controller
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
      <Controller
        name="employeeBusinessId"
        control={control}
        render={({ field, fieldState }): ReactElement => (
          <Select
            {...field}
            data={attendees}
            value={field.value}
            disabled={fetchingAttendees}
            label="Attendee"
            placeholder="Scroll to see all options"
            maxDropdownHeight={160}
            searchable
            error={fieldState.error?.message}
            withinPortal
          />
        )}
      />
    </>
  );
}
