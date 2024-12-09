import { ReactElement, useEffect, useState } from 'react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { useQuery } from 'urql';
import { Divider, Select, SimpleGrid, Switch, TextInput, Title } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import {
  AllSortCodesDocument,
  AllTaxCategoriesDocument,
  Country,
  InsertNewBusinessInput,
  UpdateBusinessInput,
} from '../../../gql/graphql.js';
import { capitalizeFirstLetter } from '../../../helpers/index.js';
import { PhrasesInput, TagsInput } from '../index.js';

const countries = Object.values(Country).map(country => {
  const label =
    country === 'USA' ? 'United States' : country.split('_').map(capitalizeFirstLetter).join(' ');
  return {
    value: country,
    label,
  };
});

type ModalProps<T extends boolean> = {
  isInsert: T;
  useFormManager: UseFormReturn<
    T extends true ? InsertNewBusinessInput : UpdateBusinessInput,
    unknown,
    undefined
  >;
  setFetching: (fetching: boolean) => void;
  defaultPhrases?: string[];
};

export function ModifyBusinessFields({
  useFormManager,
  setFetching,
  defaultPhrases,
}: ModalProps<boolean>): ReactElement {
  const { control } = useFormManager;
  const [tagsFetching, setTagsFetching] = useState(false);
  const [sortCodes, setSortCodes] = useState<Array<{ value: string; label: string }>>([]);
  const [taxCategories, setTaxCategories] = useState<Array<{ value: string; label: string }>>([]);

  // Tax categories array handle
  const [{ data: taxCategoriesData, fetching: fetchingTaxCategories, error: taxCategoriesError }] =
    useQuery({
      query: AllTaxCategoriesDocument,
    });

  useEffect(() => {
    if (taxCategoriesError) {
      showNotification({
        title: 'Error!',
        message: 'Oh no!, we have an error fetching tax categories! 🤥',
      });
    }
  }, [taxCategoriesError]);

  useEffect(() => {
    if (taxCategoriesData?.taxCategories.length) {
      setTaxCategories(
        taxCategoriesData.taxCategories
          .map(entity => ({
            value: entity.id,
            label: entity.name,
          }))
          .sort((a, b) => (a.label > b.label ? 1 : -1)),
      );
    }
  }, [taxCategoriesData, setTaxCategories]);

  // Sort codes array handle
  const [{ data: sortCodesData, fetching: fetchingSortCodes, error: sortCodesError }] = useQuery({
    query: AllSortCodesDocument,
  });

  useEffect(() => {
    if (sortCodesError) {
      showNotification({
        title: 'Error!',
        message: 'Oh no!, we have an error fetching sort codes! 🤥',
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
          name="country"
          control={control}
          defaultValue={Country.Israel}
          render={({ field, fieldState }): ReactElement => (
            <Select
              {...field}
              data={countries}
              value={field.value}
              label="Country"
              placeholder="Scroll to see all options"
              maxDropdownHeight={160}
              searchable
              error={fieldState.error?.message}
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
      </SimpleGrid>
      <Divider my="sm" />
      <Title order={5}>Classification</Title>
      <SimpleGrid cols={3}>
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
        <PhrasesInput
          formManager={useFormManager}
          phrasesPath="suggestions.phrases"
          defaultPhrases={defaultPhrases}
        />
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
