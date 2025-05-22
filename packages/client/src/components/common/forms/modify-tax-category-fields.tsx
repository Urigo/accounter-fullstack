import { ReactElement, useEffect } from 'react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { Select } from '@mantine/core';
import { InsertTaxCategoryInput, UpdateTaxCategoryInput } from '../../../gql/graphql.js';
import { useGetSortCodes } from '../../../hooks/use-get-sort-codes.js';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form.js';
import { Input } from '../../ui/input.js';
import { NumberInput } from '../index.js';

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
  const { control, watch, setValue } = formManager;

  // Sort codes array handle
  const {
    selectableSortCodes: sortCodes,
    fetching: fetchingSortCodes,
    rawSortCodes,
  } = useGetSortCodes();

  useEffect(() => {
    setFetching(fetchingSortCodes);
  }, [setFetching, fetchingSortCodes]);

  const sortCode = watch('sortCode');

  useEffect(() => {
    if (sortCode) {
      const sortCodeObj = rawSortCodes.find(({ key }) => key === sortCode);
      if (sortCodeObj?.defaultIrsCode) {
        setValue('irsCode', sortCodeObj.defaultIrsCode);
      }
    }
  }, [rawSortCodes, sortCode, setValue]);

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

      <FormField
        name="irsCode"
        control={control}
        rules={{
          validate: {
            range: value =>
              (Number(value) > 1 && Number(value) <= 9999) || 'Code must be between 1 and 9999',
            integer: value => Number.isInteger(Number(value)) || 'Code must be an integer',
          },
        }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>IRS Code</FormLabel>
            <FormControl>
              <NumberInput
                {...field}
                value={field.value ?? undefined}
                hideControls
                decimalScale={0}
                thousandSeparator=""
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
