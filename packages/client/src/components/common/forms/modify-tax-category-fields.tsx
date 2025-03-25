import { ReactElement, useEffect } from 'react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { Select, TextInput } from '@mantine/core';
import { InsertTaxCategoryInput, UpdateTaxCategoryInput } from '../../../gql/graphql.js';
import { useGetSortCodes } from '../../../hooks/use-get-sort-codes.js';

type ModalProps<T extends boolean> = {
  isInsert: T;
  useFormManager: UseFormReturn<
    T extends true ? InsertTaxCategoryInput : UpdateTaxCategoryInput,
    unknown,
    undefined
  >;
  setFetching: (fetching: boolean) => void;
};

export function ModifyTaxCategoryFields({
  useFormManager,
  setFetching,
}: ModalProps<boolean>): ReactElement {
  const { control } = useFormManager;

  // Sort codes array handle
  const { selectableSortCodes: sortCodes, fetching: fetchingSortCodes } = useGetSortCodes();

  useEffect(() => {
    setFetching(fetchingSortCodes);
  }, [setFetching, fetchingSortCodes]);

  return (
    <>
      <Controller
        name="name"
        control={control}
        rules={{
          required: 'Required',
          minLength: { value: 2, message: 'Must be at least 2 characters' },
        }}
        render={({ field, fieldState }): ReactElement => (
          <TextInput
            data-autofocus
            {...field}
            value={field.value ?? undefined}
            error={fieldState.error?.message}
            label="Name"
            required
          />
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
