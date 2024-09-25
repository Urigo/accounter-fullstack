import { ReactElement } from 'react';
import { format } from 'date-fns';
import { Control, Controller } from 'react-hook-form';
import { DatePickerInput } from '@mantine/dates';
import { InsertBusinessTripInput } from '../../../gql/graphql.js';
import { TIMELESS_DATE_REGEX } from '../../../helpers/consts.js';
import { TextInput } from '../index.js';

interface Props {
  control: Control<InsertBusinessTripInput, object>;
}

export const ModifyBusinessTripFields = ({ control }: Props): ReactElement => {
  return (
    <>
      <Controller
        name="name"
        control={control}
        rules={{ required: 'Required' }}
        render={({ field, fieldState }): ReactElement => (
          <TextInput
            {...field}
            error={fieldState.error?.message}
            isDirty={fieldState.isDirty}
            label="Name"
          />
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
        name="destination"
        control={control}
        render={({ field, fieldState }): ReactElement => (
          <TextInput
            {...field}
            value={field.value ?? undefined}
            error={fieldState.error?.message}
            isDirty={fieldState.isDirty}
            label="Destination"
          />
        )}
      />
      <Controller
        name="tripPurpose"
        control={control}
        render={({ field, fieldState }): ReactElement => (
          <TextInput
            {...field}
            value={field.value ?? undefined}
            error={fieldState.error?.message}
            isDirty={fieldState.isDirty}
            label="Trip Purpose"
          />
        )}
      />
    </>
  );
};
