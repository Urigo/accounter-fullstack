import { ReactElement, useCallback, useEffect, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { useQuery } from 'urql';
import { Select, Switch } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import {
  AllBusinessTripsDocument,
  AllFinancialEntitiesDocument,
  AllTaxCategoriesDocument,
  EditChargeQuery,
  UpdateChargeInput,
} from '../../../gql/graphql.js';
import {
  EMPTY_UUID,
  MakeBoolean,
  relevantDataPicker,
  TimelessDateString,
} from '../../../helpers/index.js';
import { useUpdateCharge } from '../../../hooks/use-update-charge.js';
import {
  ChargeSpreadInput,
  InsertBusinessTripModal,
  SimpleGrid,
  TagsInput,
  TextInput,
} from '../index.js';

type Props = {
  charge: EditChargeQuery['chargesByIDs'][number];
  close: () => void;
  onChange: () => void;
};

export const EditCharge = ({ charge, close, onChange }: Props): ReactElement => {
  const { updateCharge, fetching: isChargeLoading } = useUpdateCharge();
  const [
    {
      data: financialEntitiesData,
      fetching: fetchingFinancialEntities,
      error: financialEntitiesError,
    },
  ] = useQuery({
    query: AllFinancialEntitiesDocument,
  });

  const [financialEntities, setFinancialEntities] = useState<
    Array<{ value: string; label: string }>
  >([]);
  const [taxCategories, setTaxCategories] = useState<Array<{ value: string; label: string }>>([]);
  const [businessTrips, setBusinessTrips] = useState<Array<{ value: string; label: string }>>([]);

  const formManager = useForm<UpdateChargeInput>({
    defaultValues: {
      ...charge,
      yearsOfRelevance: charge.yearsOfRelevance
        ?.map(record => ({
          year: record.year as TimelessDateString,
          amount: record.amount,
        }))
        .sort((a, b) => (a.year > b.year ? 1 : -1)),
    },
  });

  const {
    control: chargeControl,
    handleSubmit: handleChargeSubmit,
    formState: { dirtyFields: dirtyChargeFields },
    // setValue,
  } = formManager;

  const onChargeSubmit: SubmitHandler<UpdateChargeInput> = data => {
    if (!charge) {
      return;
    }

    const dataToUpdate = relevantDataPicker(data, dirtyChargeFields as MakeBoolean<typeof data>);
    close();
    if (dataToUpdate && Object.keys(dataToUpdate).length > 0) {
      updateCharge({
        chargeId: charge.id,
        fields: {
          ...dataToUpdate,
          yearsOfRelevance: data.yearsOfRelevance
            ? Object.values(data.yearsOfRelevance)
            : undefined,
        },
      }).then(() => onChange?.());
    }
  };

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
    if (financialEntitiesData?.allFinancialEntities?.nodes.length) {
      setFinancialEntities(
        financialEntitiesData.allFinancialEntities.nodes
          .map(entity => ({
            value: entity.id,
            label: entity.name,
          }))
          .sort((a, b) => (a.label > b.label ? 1 : -1)),
      );
    }
  }, [financialEntitiesData, setFinancialEntities]);

  // handle tax categories
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

  // handle business trips
  const [
    { data: businessTripsData, fetching: fetchingBusinessTrips, error: businessTripsError },
    refetchBusinessTrips,
  ] = useQuery({
    query: AllBusinessTripsDocument,
  });

  const refetchBusinessTripsCallback = useCallback(() => {
    refetchBusinessTrips();
  }, [refetchBusinessTrips]);

  useEffect(() => {
    if (businessTripsError) {
      showNotification({
        title: 'Error!',
        message: 'Oh no!, we have an error fetching business trips! 🤥',
      });
    }
  }, [businessTripsError]);

  // On every new data fetch, reorder results by name
  useEffect(() => {
    if (businessTripsData?.allBusinessTrips.length) {
      setBusinessTrips([
        ...businessTripsData.allBusinessTrips
          .map(entity => ({
            value: entity.id,
            label: entity.name,
          }))
          .sort((a, b) => (a.label > b.label ? 1 : -1)),
        { value: EMPTY_UUID, label: 'None' },
      ]);
    }
  }, [businessTripsData, setBusinessTrips]);

  return (
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
            render={({ field: { value, ...field }, fieldState }): ReactElement => (
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
            render={({ field, fieldState }): ReactElement => (
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
            render={({ field, fieldState }): ReactElement => (
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
          <Controller
            name="businessTripID"
            control={chargeControl}
            defaultValue={'businessTrip' in charge ? charge.businessTrip?.id : undefined}
            render={({ field, fieldState }): ReactElement => (
              <Select
                {...field}
                data={businessTrips}
                value={field.value}
                disabled={fetchingBusinessTrips}
                label="Business Trip"
                placeholder="Scroll to see all options"
                maxDropdownHeight={160}
                searchable
                error={fieldState.error?.message}
                rightSection={<InsertBusinessTripModal onDone={refetchBusinessTripsCallback} />}
              />
            )}
          />
          <TagsInput formManager={formManager} tagsPath="tags" />
          <Controller
            name="isProperty"
            control={chargeControl}
            defaultValue={charge.property}
            render={({ field: { value, ...field } }): ReactElement => (
              <Switch {...field} checked={value === true} label="Is Property" />
            )}
          />
          <Controller
            name="isConversion"
            control={chargeControl}
            defaultValue={charge.conversion}
            render={({ field: { value, ...field } }): ReactElement => (
              <Switch {...field} checked={value === true} label="Is Conversion" />
            )}
          />
          <Controller
            name="isInvoicePaymentDifferentCurrency"
            control={chargeControl}
            defaultValue={charge.isInvoicePaymentDifferentCurrency}
            render={({ field: { value, ...field } }): ReactElement => (
              <Switch
                {...field}
                checked={value === true}
                label="Is Invoice-Payment currency difference"
              />
            )}
          />
          <Controller
            name="optionalVAT"
            control={chargeControl}
            defaultValue={charge.optionalVAT ?? false}
            render={({ field: { value, ...field } }): ReactElement => (
              <Switch {...field} checked={value === true} label="Optional VAT" />
            )}
          />
          <ChargeSpreadInput formManager={formManager} chargeSpreadPath="yearsOfRelevance" />
        </SimpleGrid>
      </div>
      <div className="mt-10 mb-5 flex justify-center gap-5">
        <button
          type="submit"
          onClick={(): (() => Promise<void>) => handleChargeSubmit(onChargeSubmit)}
          className="mt-8 text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-lg"
          disabled={isChargeLoading || Object.keys(dirtyChargeFields).length === 0}
        >
          Accept
        </button>
        <button
          type="button"
          className="mt-8 text-white bg-rose-500 border-0 py-2 px-8 focus:outline-none hover:bg-rose-600 rounded text-lg"
          onClick={close}
        >
          Cancel
        </button>
      </div>
    </form>
  );
};
