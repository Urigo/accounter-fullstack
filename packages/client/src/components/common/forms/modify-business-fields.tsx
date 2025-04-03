import { ReactElement, useEffect, useState } from 'react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { Divider, Select, SimpleGrid, Switch, TextInput, Title } from '@mantine/core';
import { InsertNewBusinessInput, UpdateBusinessInput } from '../../../gql/graphql.js';
import { useGetSortCodes } from '../../../hooks/use-get-sort-codes.js';
import { useGetTaxCategories } from '../../../hooks/use-get-tax-categories.js';
import { PhrasesInput, TagsInput } from '../index.js';

type ModalProps<T extends boolean> = {
  isInsert: T;
  useFormManager: UseFormReturn<
    T extends true ? InsertNewBusinessInput : UpdateBusinessInput,
    unknown,
    T extends true ? InsertNewBusinessInput : UpdateBusinessInput
  >;
  setFetching: (fetching: boolean) => void;
};

export function ModifyBusinessFields({
  useFormManager,
  setFetching,
}: ModalProps<boolean>): ReactElement {
  const { control } = useFormManager;
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
          name="hebrewName"
          control={control}
          rules={{
            minLength: { value: 2, message: 'Must be at least 2 characters' },
          }}
          render={({ field, fieldState }): ReactElement => (
            <TextInput
              {...field}
              value={field.value ?? undefined}
              error={fieldState.error?.message}
              label="Hebrew Name"
            />
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
        <Controller
          name="governmentId"
          control={control}
          rules={{
            minLength: { value: 8, message: 'Must be at least 8 characters' },
          }}
          render={({ field, fieldState }): ReactElement => (
            <TextInput
              {...field}
              value={field.value ?? undefined}
              error={fieldState.error?.message}
              label="Government ID"
            />
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
        <Controller
          name="address"
          control={control}
          rules={{
            minLength: { value: 2, message: 'Must be at least 2 characters' },
          }}
          render={({ field, fieldState }): ReactElement => (
            <TextInput
              {...field}
              value={field.value ?? undefined}
              error={fieldState.error?.message}
              label="Address"
            />
          )}
        />
        <Controller
          name="email"
          control={control}
          rules={{
            minLength: { value: 2, message: 'Must be at least 2 characters' },
          }}
          render={({ field, fieldState }): ReactElement => (
            <TextInput
              {...field}
              value={field.value ?? undefined}
              error={fieldState.error?.message}
              label="Email"
            />
          )}
        />
        <Controller
          name="website"
          control={control}
          rules={{
            minLength: { value: 2, message: 'Must be at least 2 characters' },
          }}
          render={({ field, fieldState }): ReactElement => (
            <TextInput
              {...field}
              value={field.value ?? undefined}
              error={fieldState.error?.message}
              label="Website"
            />
          )}
        />
        <Controller
          name="phoneNumber"
          control={control}
          rules={{
            minLength: { value: 2, message: 'Must be at least 2 characters' },
          }}
          render={({ field, fieldState }): ReactElement => (
            <TextInput
              {...field}
              value={field.value ?? undefined}
              error={fieldState.error?.message}
              label="Phone Number"
            />
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
        <PhrasesInput formManager={useFormManager} phrasesPath="suggestions.phrases" />
        <TagsInput
          formManager={useFormManager}
          tagsPath="suggestions.tags"
          setFetching={setTagsFetching}
        />
        <Controller
          name="suggestions.description"
          control={control}
          rules={{
            minLength: { value: 2, message: 'Must be at least 2 characters' },
          }}
          render={({ field, fieldState }): ReactElement => (
            <TextInput
              {...field}
              value={field.value ?? undefined}
              error={fieldState.error?.message}
              label="Charge description"
            />
          )}
        />
      </SimpleGrid>
    </>
  );
}
