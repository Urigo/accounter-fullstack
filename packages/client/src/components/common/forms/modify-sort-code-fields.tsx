import type { ReactElement } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { AddSortCodeMutationVariables } from '../../../gql/graphql.js';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form.jsx';
import { Input } from '../../ui/input.jsx';
import { NumberInput } from '../index.js';
import type { EditSortCodeVariables } from '../modals/edit-sort-code.js';

type ModalProps<T extends boolean> = {
  isInsert: T;
  formManager: UseFormReturn<
    T extends true ? AddSortCodeMutationVariables : EditSortCodeVariables,
    unknown,
    T extends true ? AddSortCodeMutationVariables : EditSortCodeVariables
  >;
};

export function ModifySortCodeFields({ isInsert, formManager }: ModalProps<boolean>): ReactElement {
  const { control } = formManager;

  return (
    <>
      <FormField
        name="key"
        control={control}
        disabled={!isInsert}
        rules={{
          required: 'Required',
          validate: {
            positive: value => Number(value) > 0 || 'Key must be a positive number',
            integer: value => Number.isInteger(Number(value)) || 'Key must be an integer',
          },
        }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Key</FormLabel>
            <FormControl>
              <NumberInput
                {...field}
                value={field.value ?? undefined}
                hideControls
                decimalScale={0}
                thousandSeparator=""
                required
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        name="name"
        control={control}
        rules={{
          required: 'Required',
          minLength: { value: 2, message: 'Must be at least 2 characters' },
        }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input {...field} value={field.value ?? undefined} required />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        name="defaultIrsCode"
        control={control}
        render={({ field }): ReactElement => (
          <FormItem>
            <FormLabel>Default IRS Code</FormLabel>
            <FormControl>
              <NumberInput
                {...field}
                value={field.value ?? undefined}
                hideControls
                decimalScale={0}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
