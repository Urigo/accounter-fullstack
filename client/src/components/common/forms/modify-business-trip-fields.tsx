import { ReactElement } from 'react';
import { format } from 'date-fns';
import { Control, Controller } from 'react-hook-form';
import { DateInput } from '@mantine/dates';
import { TextInput } from '..';
import { InsertBusinessTripInput } from '../../../gql/graphql.js';
import { TIMELESS_DATE_REGEX } from '../../../helpers/consts.js';

export interface Props {
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
        render={({ field: { value, ...field }, fieldState }): ReactElement => {
          const date = value ? new Date(value) : undefined;
          return (
            <DateInput
              {...field}
              onChange={(date?: Date | string | null) => {
                const newDate = date
                  ? typeof date === 'string'
                    ? date
                    : format(date, 'yyyy-MM-dd')
                  : undefined;
                if (newDate !== value) field.onChange(newDate);
              }}
              value={date}
              label="Start Date"
              placeholder="Start Date"
              maw={400}
              mx="auto"
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
        render={({ field, fieldState }): ReactElement => (
          <TextInput
            {...field}
            value={field.value ?? undefined}
            error={fieldState.error?.message}
            isDirty={fieldState.isDirty}
            label="End Date"
          />
        )}
      />
    </>
  );
};
