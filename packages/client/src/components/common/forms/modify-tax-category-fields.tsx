import { ReactElement, useCallback, useEffect } from 'react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { Select } from '@mantine/core';
import { InsertTaxCategoryInput, UpdateTaxCategoryInput } from '../../../gql/graphql.js';
import { dirtyFieldMarker } from '../../../helpers/index.js';
import { useGetSortCodes } from '../../../hooks/use-get-sort-codes.js';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form.js';
import { Input } from '../../ui/input.js';
import { IrsCodesInput } from '../business-trip-report/parts/irs-codes-input.js';

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
  const updateIrsCode = useCallback(
    (sortCode: number) => {
      const sortCodeObj = rawSortCodes.find(sc => sc.key === sortCode);
      if (sortCodeObj?.defaultIrsCodes) {
        setValue('irsCodes', sortCodeObj.defaultIrsCodes, { shouldDirty: true });
      }
    },
    [rawSortCodes, setValue],
  );
  useEffect(() => {
    if (sortCode) {
      updateIrsCode(sortCode);
    }
  }, [sortCode, updateIrsCode]);

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
                className={isInsert ? undefined : dirtyFieldMarker(fieldState)}
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
              data={sortCodes}
              value={field.value?.toString()}
              disabled={fetchingSortCodes}
              label="Sort Code"
              placeholder="Scroll to see all options"
              maxDropdownHeight={160}
              searchable
              className={isInsert ? undefined : dirtyFieldMarker(fieldState)}
            />
          );
        }}
      />

      <IrsCodesInput
        formManager={formManager}
        irsCodesPath="irsCodes"
        highlightIfDirty={!isInsert}
      />
    </>
  );
}
