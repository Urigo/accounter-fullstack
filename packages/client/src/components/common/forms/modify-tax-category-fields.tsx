import { type ReactElement } from 'react';
import { type UseFormReturn } from 'react-hook-form';
import type { InsertTaxCategoryInput, UpdateTaxCategoryInput } from '../../../gql/graphql.js';
import { dirtyFieldMarker } from '../../../helpers/index.js';
import { SortCodeSelect } from '../inputs/sort-code-select.js';
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
  ownerId?: string;
};

export function ModifyTaxCategoryFields({
  formManager,
  setFetching,
  isInsert,
  ownerId,
}: ModalProps<boolean>): ReactElement {
  const { control, setValue } = formManager;

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

      <FormField
        name="sortCode"
        control={control}
        render={({ field, fieldState }): ReactElement => (
          <FormItem>
            <FormLabel>Sort Code</FormLabel>
            <FormControl>
              <SortCodeSelect
                ownerId={ownerId}
                value={field.value}
                onChange={(value, sortCode) => {
                  field.onChange(value);
                  // on sort code change, update IRS code with its default (if any)
                  if (sortCode?.defaultIrsCode) {
                    setValue('irsCode', sortCode.defaultIrsCode, { shouldDirty: true });
                  }
                }}
                onFetchingChange={setFetching}
                formPart
                triggerClassName={isInsert ? undefined : dirtyFieldMarker(fieldState)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
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
