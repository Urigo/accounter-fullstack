import { useEffect, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { useQuery } from 'urql';
import { Loader, Select, Switch } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import {
  // BeneficiariesInput,
  SimpleGrid,
  TagsInput,
  TextInput,
} from '..';
import {
  AllFinancialEntitiesDocument,
  AllTaxCategoriesDocument,
  EditChargeDocument,
  UpdateChargeInput,
} from '../../../gql/graphql';
import { MakeBoolean, relevantDataPicker } from '../../../helpers';
import { useUpdateCharge } from '../../../hooks/use-update-charge';

/* GraphQL */ `
  query EditCharge($chargeIDs: [ID!]!) {
    chargesByIDs(chargeIDs: $chargeIDs) {
      id
      counterparty {
        id
        name
      }
      owner {
        id
        name
      }
      property
      conversion
      userDescription
      taxCategory {
        id
        name
      }
    }
  }
`;

type Props = {
  chargeId: string;
  onDone: () => void;
};

export const EditCharge = ({ chargeId, onDone }: Props) => {
  const [{ data: chargeData, fetching: fetchingCharge }] = useQuery({
    query: EditChargeDocument,
    variables: {
      chargeIDs: [chargeId],
    },
  });

  const charge = chargeData?.chargesByIDs?.[0];
  const useFormManager = useForm<UpdateChargeInput>({
    defaultValues: { ...charge },
  });

  const [financialEntities, setFinancialEntities] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [taxCategories, setTaxCategories] = useState<Array<{ value: string; label: string }>>([]);
  const {
    control: chargeControl,
    handleSubmit: handleChargeSubmit,
    formState: { dirtyFields: dirtyChargeFields },
  } = useFormManager;

  const { updateCharge, fetching: isChargeLoading } = useUpdateCharge();

  const onChargeSubmit: SubmitHandler<UpdateChargeInput> = data => {
    if (!charge) {
      return;
    }

    const dataToUpdate = relevantDataPicker(data, dirtyChargeFields as MakeBoolean<typeof data>);
    onDone();
    if (dataToUpdate && Object.keys(dataToUpdate).length > 0) {
      updateCharge({
        chargeId,
        fields: dataToUpdate,
      });
    }
  };

  const [
    {
      data: financialEntitiesData,
      fetching: fetchingFinancialEntities,
      error: financialEntitiesError,
    },
  ] = useQuery({
    query: AllFinancialEntitiesDocument,
  });

  useEffect(() => {
    if (financialEntitiesError) {
      showNotification({
        title: 'Error!',
        message: 'Oh no!, we have an error fetching financial entities! 🤥',
      });
    }
  }, [financialEntitiesError]);

  // On every new data fetch, reorder results by name
  useEffect(() => {
    if (financialEntitiesData?.allFinancialEntities.length) {
      setFinancialEntities(
        financialEntitiesData.allFinancialEntities
          .map(entity => ({
            value: entity.id,
            label: entity.name,
          }))
          .sort((a, b) => (a.label > b.label ? 1 : -1)),
      );
    }
  }, [financialEntitiesData, setFinancialEntities]);

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

  // On every new data fetch, reorder results by name
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

  return (
    <>
      {fetchingCharge && (
        <Loader className="flex self-center my-5" color="dark" size="xl" variant="dots" />
      )}
      {!fetchingCharge && charge && (
        <form onSubmit={handleChargeSubmit(onChargeSubmit)}>
          <div className="flex-row px-10 h-max justify-start block">
            <SimpleGrid cols={3}>
              <Controller
                name="userDescription"
                control={chargeControl}
                defaultValue={charge.userDescription}
                rules={{
                  required: 'Required',
                  minLength: { value: 2, message: 'Must be at least 2 characters' },
                }}
                render={({ field: { value, ...field }, fieldState }) => (
                  <TextInput
                    {...field}
                    value={value ?? undefined}
                    error={fieldState.error?.message}
                    label="Description"
                  />
                )}
              />
              <Controller
                name="ownerId"
                control={chargeControl}
                defaultValue={charge.owner?.id}
                rules={{
                  required: 'Required',
                  minLength: { value: 2, message: 'Minimum 2 characters' },
                }}
                render={({ field, fieldState }) => (
                  <Select
                    {...field}
                    data={financialEntities}
                    value={field.value}
                    disabled={fetchingFinancialEntities}
                    label="Owner"
                    placeholder="Scroll to see all options"
                    maxDropdownHeight={160}
                    searchable
                    error={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                name="defaultTaxCategoryID"
                control={chargeControl}
                defaultValue={charge.taxCategory?.id}
                render={({ field, fieldState }) => (
                  <Select
                    {...field}
                    data={taxCategories}
                    value={field.value}
                    disabled={fetchingTaxCategories}
                    label="Tax Category Override"
                    placeholder="Scroll to see all options"
                    maxDropdownHeight={160}
                    searchable
                    error={fieldState.error?.message}
                  />
                )}
              />
              <TagsInput formManager={useFormManager} />
              <Controller
                name="isProperty"
                control={chargeControl}
                defaultValue={charge.property}
                render={({ field: { value, ...field } }) => {
                  return <Switch {...field} checked={value === true} label="Is Property" />;
                }}
              />
              <Controller
                name="isConversion"
                control={chargeControl}
                defaultValue={charge.conversion}
                render={({ field: { value, ...field } }) => {
                  return <Switch {...field} checked={value === true} label="Is Conversion" />;
                }}
              />
              {/* <BeneficiariesInput label="Beneficiaries" formManager={useFormManager} /> */}
            </SimpleGrid>
          </div>
          <div className="mt-10 mb-5 flex justify-center gap-5">
            <button
              type="submit"
              onClick={() => handleChargeSubmit(onChargeSubmit)}
              className="mt-8 text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-lg"
              disabled={isChargeLoading || Object.keys(dirtyChargeFields).length === 0}
            >
              Accept
            </button>
            <button
              type="button"
              className="mt-8 text-white bg-rose-500 border-0 py-2 px-8 focus:outline-none hover:bg-rose-600 rounded text-lg"
              onClick={onDone}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </>
  );
};
