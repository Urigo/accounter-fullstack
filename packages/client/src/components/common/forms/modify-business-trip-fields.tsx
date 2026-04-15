import type { ReactElement } from 'react';
import { format } from 'date-fns';
import { type Control } from 'react-hook-form';
import { Select } from '@mantine/core';
import type { InsertBusinessTripInput } from '../../../gql/graphql.js';
import { TIMELESS_DATE_REGEX } from '../../../helpers/consts.js';
import { useAllCountries } from '../../../hooks/use-get-countries.js';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form.js';
import { Input } from '../../ui/input.js';
import { DatePickerInput } from '../index.js';

interface Props {
  control: Control<InsertBusinessTripInput, object>;
}

export const ModifyBusinessTripFields = ({ control }: Props): ReactElement => {
  const { countries, fetching: fetchingCountries } = useAllCountries();

  return (
    <>
      <FormField
        name="name"
        control={control}
        rules={{ required: 'Required' }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input {...field} required />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        name="fromDate"
        control={control}
        rules={{
          pattern: {
            value: TIMELESS_DATE_REGEX,
            message: 'Date must be im format yyyy-mm-dd',
          },
        }}
        render={({ field, fieldState }): ReactElement => {
          const date = field.value ? new Date(field.value) : undefined;
          return (
            <FormItem>
              <FormLabel>Start Date</FormLabel>
              <FormControl>
                <DatePickerInput
                  id="business-trip-from-date"
                  onChange={(date?: Date | null): void => {
                    const newDate = date ? format(date, 'yyyy-MM-dd') : undefined;
                    if (newDate !== field.value) field.onChange(newDate);
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
        name="toDate"
        control={control}
        rules={{
          pattern: {
            value: TIMELESS_DATE_REGEX,
            message: 'Date must be im format yyyy-mm-dd',
          },
        }}
        render={({ field, fieldState }): ReactElement => {
          const date = field.value ? new Date(field.value) : undefined;
          return (
            <FormItem>
              <FormLabel>End Date</FormLabel>
              <FormControl>
                <DatePickerInput
                  id="business-trip-to-date"
                  onChange={(date?: Date | null): void => {
                    const newDate = date ? format(date, 'yyyy-MM-dd') : undefined;
                    if (newDate !== field.value) field.onChange(newDate);
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
        name="destinationCode"
        control={control}
        render={({ field, fieldState }): ReactElement => (
          <FormItem>
            <FormLabel>Destination</FormLabel>
            <Select
              {...field}
              data={countries.map(country => ({
                value: country.code,
                label: country.name,
              }))}
              value={field.value ?? undefined}
              disabled={fetchingCountries}
              maxDropdownHeight={160}
              searchable
              error={fieldState.error?.message}
            />
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="tripPurpose"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Trip Purpose</FormLabel>
            <FormControl>
              <Input {...field} value={field.value ?? undefined} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
};
