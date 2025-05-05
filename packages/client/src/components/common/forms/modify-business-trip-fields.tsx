import { ReactElement } from 'react';
import { format } from 'date-fns';
import { Control, Controller } from 'react-hook-form';
import { Select } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { InsertBusinessTripInput } from '../../../gql/graphql.js';
import { TIMELESS_DATE_REGEX } from '../../../helpers/consts.js';
import { useAllCountries } from '../../../hooks/use-get-countries.js';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form.js';
import { Input } from '../../ui/input.js';

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

      <Controller
        name="fromDate"
        control={control}
        rules={{
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
              onChange={(date?: Date | string | null): void => {
                const newDate = date
                  ? typeof date === 'string'
                    ? date
                    : format(date, 'yyyy-MM-dd')
                  : undefined;
                if (newDate !== value) field.onChange(newDate);
              }}
              value={date}
              label="Start Date"
              popoverProps={{ withinPortal: true }}
            />
          );
        }}
      />

      <Controller
        name="toDate"
        control={control}
        rules={{
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
              onChange={(date?: Date | string | null): void => {
                const newDate = date
                  ? typeof date === 'string'
                    ? date
                    : format(date, 'yyyy-MM-dd')
                  : undefined;
                if (newDate !== value) field.onChange(newDate);
              }}
              value={date}
              label="End Date"
              popoverProps={{ withinPortal: true }}
            />
          );
        }}
      />

      <Controller
        name="destinationCode"
        control={control}
        render={({ field, fieldState }): ReactElement => (
          <Select
            {...field}
            data={countries.map(country => ({
              value: country.code,
              label: country.name,
            }))}
            value={field.value ?? undefined}
            disabled={fetchingCountries}
            label="Destination"
            maxDropdownHeight={160}
            searchable
            error={fieldState.error?.message}
          />
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
