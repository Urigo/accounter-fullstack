import { ReactElement, useEffect } from 'react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { Select } from '@mantine/core';
import { InsertTaxCategoryInput, UpdateTaxCategoryInput } from '../../../gql/graphql.js';
import { useGetSortCodes } from '../../../hooks/use-get-sort-codes.js';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form.js';
import { Input } from '../../ui/input.js';

type ModalProps<T extends boolean> = {
  isInsert: T;
  formManager: UseFormReturn<
    T extends true ? InsertTaxCategoryInput : UpdateTaxCategoryInput,
    unknown,
    T extends true ? InsertTaxCategoryInput : UpdateTaxCategoryInput
  >;
  setFetching: (fetching: boolean) => void;
};

export function ModifyTaxCategoryFields({
  formManager,
  setFetching,
}: ModalProps<boolean>): ReactElement {
  const { control } = formManager;

  // Sort codes array handle
  const { selectableSortCodes: sortCodes, fetching: fetchingSortCodes } = useGetSortCodes();

  useEffect(() => {
    setFetching(fetchingSortCodes);
  }, [setFetching, fetchingSortCodes]);

  return (
    <>
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

      <Controller
        name="sortCode"
        control={control}
        render={({ field, fieldState }): ReactElement => {
          return (
            <Select
              {...field}
              data={sortCodes}
              value={field.value?.toString()}
              disabled={fetchingSortCodes}
              label="Sort Code"
              placeholder="Scroll to see all options"
              maxDropdownHeight={160}
              searchable
              error={fieldState.error?.message}
            />
          );
        }}
      />
    </>
  );
}
