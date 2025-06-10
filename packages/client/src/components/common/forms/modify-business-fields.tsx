import { ReactElement, useEffect, useState } from 'react';
import { UseFormReturn } from 'react-hook-form';
import type {
  InsertNewBusinessInput,
  Pcn874RecordType,
  UpdateBusinessInput,
} from '../../../gql/graphql.js';
import { dirtyFieldMarker } from '../../../helpers/index.js';
import { useGetSortCodes } from '../../../hooks/use-get-sort-codes.js';
import { useGetTaxCategories } from '../../../hooks/use-get-tax-categories.js';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form.js';
import { Input } from '../../ui/input.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select.js';
import { Switch } from '../../ui/switch.js';
import { ComboBox, NumberInput, PhrasesInput, TagsInput } from '../index.js';

const pcn874RecordType: Record<Pcn874RecordType, string> = {
  C: 'INPUT_SELF_INVOICE',
  H: 'INPUT_SINGLE_DOC_BY_LAW',
  I: 'SALE_PALESTINIAN_CUSTOMER',
  K: 'INPUT_PETTY_CASH',
  L1: 'SALE_UNIDENTIFIED_CUSTOMER',
  L2: 'SALE_UNIDENTIFIED_ZERO_OR_EXEMPT',
  M: 'SALE_SELF_INVOICE',
  P: 'INPUT_PALESTINIAN_SUPPLIER',
  R: 'INPUT_IMPORT',
  S1: 'SALE_REGULAR',
  S2: 'SALE_ZERO_OR_EXEMPT',
  T: 'INPUT_REGULAR',
  Y: 'SALE_EXPORT',
} as const;

type ModalProps<T extends boolean> = {
  isInsert: T;
  formManager: UseFormReturn<
    T extends true ? InsertNewBusinessInput : UpdateBusinessInput,
    unknown,
    T extends true ? InsertNewBusinessInput : UpdateBusinessInput
  >;
  setFetching: (fetching: boolean) => void;
};

export function ModifyBusinessFields({
  formManager,
  setFetching,
  isInsert,
}: ModalProps<boolean>): ReactElement {
  const { control, watch, setValue } = formManager;
  const [tagsFetching, setTagsFetching] = useState(false);

  // Tax categories array handle
  const { selectableTaxCategories: taxCategories, fetching: fetchingTaxCategories } =
    useGetTaxCategories();

  // Sort codes array handle
  const {
    selectableSortCodes: sortCodes,
    fetching: fetchingSortCodes,
    sortCodes: rawSortCodes,
  } = useGetSortCodes();

  useEffect(() => {
    setFetching(tagsFetching || fetchingTaxCategories || fetchingSortCodes);
  }, [setFetching, tagsFetching, fetchingTaxCategories, fetchingSortCodes]);

  // on sort code change, update IRS code
  const sortCode = watch('sortCode');
  useEffect(() => {
    if (sortCode) {
      const sortCodeObj = rawSortCodes.find(sc => Number(sc.key) === Number(sortCode));

      if (sortCodeObj) {
        if (sortCodeObj.defaultIrsCode) {
          setValue('irsCode', sortCodeObj.defaultIrsCode, { shouldDirty: true });
        } else {
          setValue('irsCode', null, { shouldDirty: true });
        }
      }
    }
  }, [sortCode, rawSortCodes, setValue]);

  return (
    <>
      <div className="grid grid-cols-3 gap-4">
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
          name="hebrewName"
          control={control}
          rules={{
            minLength: { value: 2, message: 'Must be at least 2 characters' },
          }}
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Hebrew Name</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? undefined}
                  className={isInsert ? '' : dirtyFieldMarker(fieldState)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          name="country"
          control={control}
          rules={{
            required: 'Required',
          }}
          render={({ field, fieldState }): ReactElement => (
            <FormItem>
              <FormLabel>Locality</FormLabel>
              <Select required onValueChange={field.onChange} value={field.value ?? undefined}>
                <FormControl>
                  <SelectTrigger className="w-full truncate">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent onClick={event => event.stopPropagation()}>
                  {[
                    { value: 'Israel', label: 'Local' },
                    { value: 'FOREIGN', label: 'Foreign' },
                  ].map(({ value, label }) => (
                    <SelectItem
                      key={value}
                      value={value}
                      className={isInsert ? '' : dirtyFieldMarker(fieldState)}
                    >
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          name="governmentId"
          control={control}
          rules={{
            minLength: { value: 8, message: 'Must be at least 8 characters' },
          }}
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Government ID</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? undefined}
                  className={isInsert ? '' : dirtyFieldMarker(fieldState)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          name="taxCategory"
          control={control}
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Tax Category</FormLabel>
              <ComboBox
                {...field}
                data={taxCategories}
                disabled={fetchingTaxCategories}
                placeholder="Scroll to see all options"
                formPart
                triggerProps={{
                  className: isInsert ? '' : dirtyFieldMarker(fieldState),
                }}
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          name="sortCode"
          control={control}
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Sort Code</FormLabel>
              <ComboBox
                {...field}
                onChange={val => {
                  field.onChange(Number(val));
                }}
                data={sortCodes}
                value={field.value?.toString()}
                disabled={fetchingSortCodes}
                placeholder="Scroll to see all options"
                formPart
                triggerProps={{
                  className: isInsert ? '' : dirtyFieldMarker(fieldState),
                }}
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          name="address"
          control={control}
          rules={{
            minLength: { value: 2, message: 'Must be at least 2 characters' },
          }}
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? undefined}
                  className={isInsert ? '' : dirtyFieldMarker(fieldState)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          name="email"
          control={control}
          rules={{
            minLength: { value: 2, message: 'Must be at least 2 characters' },
          }}
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? undefined}
                  className={isInsert ? '' : dirtyFieldMarker(fieldState)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          name="website"
          control={control}
          rules={{
            minLength: { value: 2, message: 'Must be at least 2 characters' },
          }}
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Website</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? undefined}
                  className={isInsert ? '' : dirtyFieldMarker(fieldState)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          name="phoneNumber"
          control={control}
          rules={{
            minLength: { value: 2, message: 'Must be at least 2 characters' },
          }}
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Phone Number</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? undefined}
                  className={isInsert ? '' : dirtyFieldMarker(fieldState)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          name="pcn874RecordType"
          control={control}
          render={({ field, fieldState }): ReactElement => (
            <FormItem>
              <FormLabel>PCN874 Record Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                <FormControl>
                  <SelectTrigger
                    className={`w-full truncate ${isInsert ? '' : dirtyFieldMarker(fieldState)}`}
                  >
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent onClick={event => event.stopPropagation()}>
                  {Object.entries(pcn874RecordType).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {`${label} (${value})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          name="exemptDealer"
          control={control}
          defaultValue={false}
          render={({ field, fieldState }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Exempt Dealer</FormLabel>
              </div>
              <FormControl>
                <Switch
                  checked={field.value === true}
                  onCheckedChange={field.onChange}
                  className={isInsert ? '' : dirtyFieldMarker(fieldState)}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          name="optionalVAT"
          control={control}
          defaultValue={false}
          render={({ field, fieldState }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <FormLabel>Optional VAT</FormLabel>
              </div>
              <FormControl>
                <Switch
                  checked={field.value === true}
                  onCheckedChange={field.onChange}
                  className={isInsert ? '' : dirtyFieldMarker(fieldState)}
                />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
      <div className="border-0 border-t-[0.0625rem] border-gray-300 border-solid mx-0 my-[0.75rem]" />
      <div className="font-bold text-base">Suggestions</div>
      <div className="grid grid-cols-3 gap-4">
        <PhrasesInput formManager={formManager} phrasesPath="suggestions.phrases" />
        <TagsInput
          formManager={formManager}
          tagsPath="suggestions.tags"
          setFetching={setTagsFetching}
        />

        <FormField
          name="suggestions.description"
          control={control}
          rules={{
            minLength: { value: 2, message: 'Must be at least 2 characters' },
          }}
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>Charge description</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? undefined}
                  className={isInsert ? '' : dirtyFieldMarker(fieldState)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </>
  );
}
