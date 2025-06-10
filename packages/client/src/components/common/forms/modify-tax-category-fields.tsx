import { ReactElement, useEffect } from 'react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { Select } from '@mantine/core';
import { InsertTaxCategoryInput, UpdateTaxCategoryInput } from '../../../gql/graphql.js';
import { dirtyFieldMarker } from '../../../helpers/index.js';
import { useGetSortCodes } from '../../../hooks/use-get-sort-codes.js';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form.js';
import { Input } from '../../ui/input.js';
import { Switch } from '../../ui/switch.js';
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
  isInsert,
}: ModalProps<boolean>): ReactElement {
  const { control, watch, setValue } = formManager;

  // Sort codes array handle
  const {
    selectableSortCodes: sortCodes,
    fetching: fetchingSortCodes,
    sortCodes: rawSortCodes,
  } = useGetSortCodes();

  useEffect(() => {
    setFetching(fetchingSortCodes);
  }, [setFetching, fetchingSortCodes]);

  // on sort code change, update IRS code
  const sortCode = watch('sortCode');
  useEffect(() => {
    if (sortCode) {
      const sortCodeObj = rawSortCodes.find(sc => sc.key === sortCode);
      if (sortCodeObj?.defaultIrsCode) {
        setValue('irsCode', sortCodeObj.defaultIrsCode, { shouldDirty: true });
      }
    }
  }, [sortCode, rawSortCodes, setValue]);

  return (
    <>
      <FormField
        name="name"
        control={control}
        rules={{
          required: 'Required',
          minLength: { value: 2, message: 'Must be at least 2 characters' },
        }}
        render={({ field, fieldState }) => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? undefined}
                required
                className={isInsert ? '' : dirtyFieldMarker(fieldState)}
              />
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
              onChange={val => {
                field.onChange(Number(val));
              }}
              data={sortCodes}
              value={field.value?.toString()}
              disabled={fetchingSortCodes}
              label="Sort Code"
              placeholder="Scroll to see all options"
              maxDropdownHeight={160}
              searchable
              className={isInsert ? '' : dirtyFieldMarker(fieldState)}
            />
          );
        }}
      />

      <FormField
        name="irsCode"
        control={control}
        render={({ field, fieldState }): ReactElement => (
          <FormItem>
            <FormLabel>IRS Code</FormLabel>
            <FormControl>
              <NumberInput
                {...field}
                className={isInsert ? '' : dirtyFieldMarker(fieldState)}
                value={field.value ?? undefined}
                hideControls
                decimalScale={0}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="taxExcluded"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between">
            <div className="space-y-0.5">
              <FormLabel>Tax excluded category</FormLabel>
            </div>
            <FormControl>
              <Switch onCheckedChange={field.onChange} checked={field.value ?? undefined} />
            </FormControl>
          </FormItem>
        )}
      />
    </>
  );
}
