import { ReactElement, useContext, useEffect, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Copy } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { ActionIcon, Loader, Select, Switch } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import {
  AllBusinessesRowFieldsFragment,
  AllSortCodesDocument,
  AllTaxCategoriesDocument,
  FetchBusinessDocument,
  FetchBusinessQuery,
  UpdateBusinessInput,
} from '../../../gql/graphql.js';
import { MakeBoolean, relevantDataPicker, writeToClipboard } from '../../../helpers/index.js';
import { useUpdateBusiness } from '../../../hooks/use-update-business.js';
import { UserContext } from '../../../providers/user-provider.js';
import { SimpleGrid, TextInput } from '../index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query FetchBusiness($id: UUID!) {
    business(id: $id) {
      __typename
      id
      ... on LtdFinancialEntity {
        address
        email
        exemptDealer
        governmentId
        hebrewName
        name
        phoneNumber
        sortCode {
          id
          name
        }
        taxCategory {
          id
          name
        }
        website
      }
    }
  }
`;

interface Props {
  businessID: string;
  updateBusiness: React.Dispatch<React.SetStateAction<AllBusinessesRowFieldsFragment>>;
}

export function BusinessCard({ businessID, updateBusiness }: Props): ReactElement {
  const [sortCodes, setSortCodes] = useState<Array<{ value: string; label: string }>>([]);
  const [taxCategories, setTaxCategories] = useState<Array<{ value: string; label: string }>>([]);
  const [business, setBusiness] = useState<
    Extract<FetchBusinessQuery['business'], { __typename: 'LtdFinancialEntity' }> | undefined
  >(undefined);

  const { userContext } = useContext(UserContext);

  const { updateBusiness: updateDbBusiness, fetching: isBusinessLoading } = useUpdateBusiness();

  // Form business data handle
  const [{ data, fetching }, refetchBusiness] = useQuery({
    query: FetchBusinessDocument,
    variables: {
      id: businessID,
    },
  });

  useEffect(() => {
    if (data && data.business.__typename === 'LtdFinancialEntity') {
      setBusiness(data.business);
    }
  }, [data]);

  // Sort codes array handle
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

  // on every business fetch, update the business in the parent component
  useEffect(() => {
    if (data?.business?.__typename === 'LtdFinancialEntity') {
      updateBusiness(data?.business);
    }
  }, [data, updateBusiness]);

  // form management
  const useFormManager = useForm<UpdateBusinessInput>({
    defaultValues: { ...business, sortCode: business?.sortCode?.id },
  });

  const {
    control,
    handleSubmit: handleBusinessSubmit,
    formState: { dirtyFields: dirtyBusinessFields },
  } = useFormManager;

  const onBusinessSubmit: SubmitHandler<UpdateBusinessInput> = data => {
    if (!business) {
      return;
    }

    const dataToUpdate = relevantDataPicker(data, dirtyBusinessFields as MakeBoolean<typeof data>);
    if (dataToUpdate && Object.keys(dataToUpdate).length > 0) {
      dataToUpdate.sortCode &&= parseInt(dataToUpdate.sortCode.toString());

      updateDbBusiness({
        businessId: business.id,
        ownerId: userContext?.ownerId,
        fields: dataToUpdate,
      }).then(() => refetchBusiness());
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {fetching && (
        <Loader className="flex self-center my-5" color="dark" size="xl" variant="dots" />
      )}
      {!fetching && business && (
        <div className="flex flex-row gap-5">
          <form onSubmit={handleBusinessSubmit(onBusinessSubmit)}>
            <div className="flex flex-row mx-3 pt-3 sm:text-1xl gap-10">
              <h1 className="sm:text-2xl font-small text-gray-900">Edit Business:</h1>
              <div className="flex flex-row gap-2">
                ID: {businessID}
                <ActionIcon
                  variant="default"
                  onClick={(): void => writeToClipboard(businessID)}
                  size={30}
                >
                  <Copy size={20} />
                </ActionIcon>
              </div>
            </div>
            <div className="flex-row px-10 h-max justify-start block">
              <SimpleGrid cols={3}>
                <Controller
                  name="name"
                  control={control}
                  defaultValue={business.name}
                  rules={{
                    required: 'Required',
                    minLength: { value: 2, message: 'Must be at least 2 characters' },
                  }}
                  render={({ field: { value, ...field }, fieldState }): ReactElement => (
                    <TextInput
                      {...field}
                      value={value ?? undefined}
                      error={fieldState.error?.message}
                      label="Name"
                    />
                  )}
                />
                <Controller
                  name="hebrewName"
                  control={control}
                  defaultValue={business.hebrewName}
                  rules={{
                    minLength: { value: 2, message: 'Must be at least 2 characters' },
                  }}
                  render={({ field: { value, ...field }, fieldState }): ReactElement => (
                    <TextInput
                      {...field}
                      value={value ?? undefined}
                      error={fieldState.error?.message}
                      label="Hebrew Name"
                    />
                  )}
                />
                <Controller
                  name="governmentId"
                  control={control}
                  defaultValue={business.governmentId}
                  rules={{
                    minLength: { value: 2, message: 'Must be at least 2 characters' },
                  }}
                  render={({ field: { value, ...field }, fieldState }): ReactElement => (
                    <TextInput
                      {...field}
                      value={value ?? undefined}
                      error={fieldState.error?.message}
                      label="Government ID"
                    />
                  )}
                />
                <Controller
                  name="email"
                  control={control}
                  defaultValue={business.email}
                  rules={{
                    minLength: { value: 2, message: 'Must be at least 2 characters' },
                  }}
                  render={({ field: { value, ...field }, fieldState }): ReactElement => (
                    <TextInput
                      {...field}
                      value={value ?? undefined}
                      error={fieldState.error?.message}
                      label="Email"
                    />
                  )}
                />
                <Controller
                  name="address"
                  control={control}
                  defaultValue={business.address}
                  rules={{
                    minLength: { value: 2, message: 'Must be at least 2 characters' },
                  }}
                  render={({ field: { value, ...field }, fieldState }): ReactElement => (
                    <TextInput
                      {...field}
                      value={value ?? undefined}
                      error={fieldState.error?.message}
                      label="Address"
                    />
                  )}
                />
                <Controller
                  name="phoneNumber"
                  control={control}
                  defaultValue={business.phoneNumber}
                  rules={{
                    minLength: { value: 2, message: 'Must be at least 2 characters' },
                  }}
                  render={({ field: { value, ...field }, fieldState }): ReactElement => (
                    <TextInput
                      {...field}
                      value={value ?? undefined}
                      error={fieldState.error?.message}
                      label="Phone Number"
                    />
                  )}
                />
                <Controller
                  name="website"
                  control={control}
                  defaultValue={business.website}
                  rules={{
                    minLength: { value: 2, message: 'Must be at least 2 characters' },
                  }}
                  render={({ field: { value, ...field }, fieldState }): ReactElement => (
                    <TextInput
                      {...field}
                      value={value ?? undefined}
                      error={fieldState.error?.message}
                      label="Website URL"
                    />
                  )}
                />
                <Controller
                  name="sortCode"
                  control={control}
                  rules={{
                    required: 'Required',
                    minLength: { value: 2, message: 'Minimum 2 characters' },
                  }}
                  defaultValue={business.sortCode?.id}
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
                  name="taxCategory"
                  control={control}
                  defaultValue={business.taxCategory?.id}
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
                  name="exemptDealer"
                  control={control}
                  defaultValue={business.exemptDealer}
                  render={({ field: { value, ...field } }): ReactElement => (
                    <Switch {...field} checked={value === true} label="Exempt Dealer" />
                  )}
                />
              </SimpleGrid>
            </div>
            <div className="mt-10 mb-5 flex justify-center gap-5">
              <button
                type="submit"
                onClick={(): (() => Promise<void>) => handleBusinessSubmit(onBusinessSubmit)}
                className="mt-8 text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-lg"
                disabled={isBusinessLoading || Object.keys(dirtyBusinessFields).length === 0}
              >
                Update
              </button>
            </div>
          </form>
        </div>
      )}
      {!fetching && !business && <p>Error fetching extended information for this business</p>}
    </div>
  );
}
