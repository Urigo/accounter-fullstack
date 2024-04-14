import { ReactElement, useEffect, useState } from 'react';
import { Control, Controller } from 'react-hook-form';
import { useQuery } from 'urql';
import { Select, TextInput } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import {
  AddBusinessTripFlightsTransactionInput,
  AllBusinessTripAttendeesDocument,
  Currency,
} from '../../../../gql/graphql.js';
import { TIMELESS_DATE_REGEX } from '../../../../helpers/index.js';
import { CurrencyInput } from '../../index.js';

type ModalProps = {
  businessTripId: string;
  control: Control<AddBusinessTripFlightsTransactionInput, unknown>;
  setFetching: (fetching: boolean) => void;
};

export function AddTransactionFields({
  businessTripId,
  control,
  setFetching,
}: ModalProps): ReactElement {
  const [attendees, setAttendees] = useState<Array<{ value: string; label: string }>>([]);
  const [{ data, fetching: fetchingAttendees, error }] = useQuery({
    query: AllBusinessTripAttendeesDocument,
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
          <TextInput
            data-autofocus
            {...field}
            value={field.value ?? undefined}
            error={fieldState.error?.message}
            label="Date"
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
          <TextInput
            {...field}
            value={field.value ?? undefined}
            error={fieldState.error?.message}
            label="Value Date"
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
