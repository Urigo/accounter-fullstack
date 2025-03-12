import { ReactElement, useEffect, useState } from 'react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { useQuery } from 'urql';
import { Select, TextInput } from '@mantine/core';
import {
  AllSortCodesDocument,
  InsertTaxCategoryInput,
  UpdateTaxCategoryInput,
} from '../../../gql/graphql.js';

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
  const [sortCodes, setSortCodes] = useState<Array<{ value: string; label: string }>>([]);

  // Sort codes array handle
  const [{ data: sortCodesData, fetching: fetchingSortCodes, error: sortCodesError }] = useQuery({
    query: AllSortCodesDocument,
  });

  useEffect(() => {
    if (sortCodesError) {
      toast.error('Error', {
        description: "Couldn't fetch sort codes",
      });
    }
  }, [sortCodesError]);

  useEffect(() => {
    if (sortCodesData?.allSortCodes.length) {
      const sortCodes = sortCodesData.allSortCodes
        .filter(code => !!code.name)
        .map(code => ({
          value: code.id.toString(),
          label: `${code.id}: ${code.name}`,
        }))
        .sort((a, b) => (a.label > b.label ? 1 : -1));
      setSortCodes(sortCodes);
    }
  }, [sortCodesData, setSortCodes]);

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
