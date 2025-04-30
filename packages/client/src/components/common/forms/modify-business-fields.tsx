import { ReactElement, useEffect, useState } from 'react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { Divider, Select, SimpleGrid, Switch, Title } from '@mantine/core';
import { InsertNewBusinessInput, UpdateBusinessInput } from '../../../gql/graphql.js';
import { useGetSortCodes } from '../../../hooks/use-get-sort-codes.js';
import { useGetTaxCategories } from '../../../hooks/use-get-tax-categories.js';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form.js';
import { Input } from '../../ui/input.js';
import { PhrasesInput, TagsInput } from '../index.js';

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
}: ModalProps<boolean>): ReactElement {
  const { control } = formManager;
  const [tagsFetching, setTagsFetching] = useState(false);

  // Tax categories array handle
  const { selectableTaxCategories: taxCategories, fetching: fetchingTaxCategories } =
    useGetTaxCategories();

  // Sort codes array handle
  const { selectableSortCodes: sortCodes, fetching: fetchingSortCodes } = useGetSortCodes();

  useEffect(() => {
    setFetching(tagsFetching || fetchingTaxCategories || fetchingSortCodes);
  }, [setFetching, tagsFetching, fetchingTaxCategories, fetchingSortCodes]);

  return (
    <>
      <SimpleGrid cols={3}>
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
          name="hebrewName"
          control={control}
          rules={{
            minLength: { value: 2, message: 'Must be at least 2 characters' },
          }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hebrew Name</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? undefined} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Controller
          name="country"
          control={control}
          rules={{
            required: 'Required',
          }}
          render={({ field, fieldState }): ReactElement => (
            <Select
              {...field}
              data={[
                { value: 'Israel', label: 'Local' },
                { value: 'FOREIGN', label: 'Foreign' },
              ]}
              value={field.value}
              label="Locality"
              maxDropdownHeight={160}
              required
              error={fieldState.error?.message}
            />
          )}
        />

        <FormField
          name="governmentId"
          control={control}
          rules={{
            minLength: { value: 8, message: 'Must be at least 8 characters' },
          }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Government ID</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? undefined} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Controller
          name="taxCategory"
          control={control}
          render={({ field, fieldState }): ReactElement => (
            <Select
              {...field}
              data={taxCategories}
              value={field.value}
              disabled={fetchingTaxCategories}
              label="Tax Category"
              placeholder="Scroll to see all options"
              maxDropdownHeight={160}
              searchable
              error={fieldState.error?.message}
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

        <FormField
          name="address"
          control={control}
          rules={{
            minLength: { value: 2, message: 'Must be at least 2 characters' },
          }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Address</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? undefined} />
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
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? undefined} />
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
          render={({ field }) => (
            <FormItem>
              <FormLabel>Website</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? undefined} />
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
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? undefined} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Controller
          name="exemptDealer"
          control={control}
          defaultValue={false}
          render={({ field: { value, ...field }, fieldState }): ReactElement => (
            <Switch
              {...field}
              checked={value === true}
              label="Is Exempt Dealer?"
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          name="optionalVAT"
          control={control}
          defaultValue={false}
          render={({ field: { value, ...field }, fieldState }): ReactElement => (
            <Switch
              {...field}
              checked={value === true}
              label="Is VAT optional?"
              error={fieldState.error?.message}
            />
          )}
        />
      </SimpleGrid>
      <Divider my="sm" />
      <Title order={5}>Suggestions</Title>
      <SimpleGrid cols={3}>
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
          render={({ field }) => (
            <FormItem>
              <FormLabel>Charge description</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? undefined} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </SimpleGrid>
    </>
  );
}
