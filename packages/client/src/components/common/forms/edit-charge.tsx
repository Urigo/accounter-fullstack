import { ReactElement, useCallback, useEffect, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useQuery } from 'urql';
import { Select } from '@mantine/core';
import {
  AllBusinessTripsDocument,
  EditChargeQuery,
  UpdateChargeInput,
} from '../../../gql/graphql.js';
import {
  EMPTY_UUID,
  MakeBoolean,
  relevantDataPicker,
  TimelessDateString,
} from '../../../helpers/index.js';
import { useGetBusinesses } from '../../../hooks/use-get-businesses.js';
import { useGetTaxCategories } from '../../../hooks/use-get-tax-categories.js';
import { useUpdateCharge } from '../../../hooks/use-update-charge.js';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form.js';
import { Input } from '../../ui/input.js';
import { Switch } from '../../ui/switch.js';
import { ChargeSpreadInput, InsertBusinessTripModal, SimpleGrid, TagsInput } from '../index.js';

type Props = {
  charge: EditChargeQuery['chargesByIDs'][number];
  close: () => void;
  onChange: () => void;
};

export const EditCharge = ({ charge, close, onChange }: Props): ReactElement => {
  const { updateCharge, fetching: isChargeLoading } = useUpdateCharge();
  const { selectableBusinesses: businesses, fetching: fetchingBusinesses } = useGetBusinesses();
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
    control,
    handleSubmit,
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

  // handle tax categories
  const { selectableTaxCategories: taxCategories, fetching: fetchingTaxCategories } =
    useGetTaxCategories();

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
      toast.error('Error', { description: 'An error occurred while fetching business trips.' });
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
    <Form {...formManager}>
      <form onSubmit={handleSubmit(onChargeSubmit)}>
        <div className="flex-row px-10 h-max justify-start block">
          <SimpleGrid cols={3}>
            <FormField
              name="userDescription"
              control={control}
              defaultValue={charge.userDescription}
              rules={{
                required: 'Required',
                minLength: { value: 2, message: 'Must be at least 2 characters' },
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? undefined} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Controller
              name="ownerId"
              control={control}
              defaultValue={charge.owner?.id}
              rules={{
                required: 'Required',
                minLength: { value: 2, message: 'Minimum 2 characters' },
              }}
              render={({ field, fieldState }): ReactElement => (
                <Select
                  {...field}
                  data={businesses}
                  value={field.value}
                  disabled={fetchingBusinesses}
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
              control={control}
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
              control={control}
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

            <FormField
              name="isProperty"
              control={control}
              defaultValue={charge.property}
              render={({ field }) => (
                <FormItem className="flex flex-row h-fit items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Is Property</FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      disabled
                      checked={field.value === true}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              name="isConversion"
              control={control}
              defaultValue={charge.conversion}
              render={({ field }) => (
                <FormItem className="flex flex-row h-fit items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Is Conversion</FormLabel>
                  </div>
                  <FormControl>
                    <Switch checked={field.value === true} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              name="isInvoicePaymentDifferentCurrency"
              control={control}
              defaultValue={charge.isInvoicePaymentDifferentCurrency}
              render={({ field }) => (
                <FormItem className="flex flex-row h-fit items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Is Invoice-Payment currency difference</FormLabel>
                  </div>
                  <FormControl>
                    <Switch checked={field.value === true} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              name="optionalVAT"
              control={control}
              defaultValue={charge.optionalVAT ?? false}
              render={({ field }) => (
                <FormItem className="flex flex-row h-fit items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Optional VAT</FormLabel>
                  </div>
                  <FormControl>
                    <Switch checked={field.value === true} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              name="optionalDocuments"
              control={control}
              defaultValue={charge.optionalDocuments ?? false}
              render={({ field }) => (
                <FormItem className="flex flex-row h-fit items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Optional Documents</FormLabel>
                  </div>
                  <FormControl>
                    <Switch checked={field.value === true} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <ChargeSpreadInput formManager={formManager} chargeSpreadPath="yearsOfRelevance" />
          </SimpleGrid>
        </div>
        <div className="mt-10 mb-5 flex justify-center gap-5">
          <button
            type="submit"
            onClick={(): (() => Promise<void>) => handleSubmit(onChargeSubmit)}
            className="mt-8 text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-hidden hover:bg-indigo-600 rounded-sm text-lg"
            disabled={isChargeLoading || Object.keys(dirtyChargeFields).length === 0}
          >
            Accept
          </button>
          <button
            type="button"
            className="mt-8 text-white bg-rose-500 border-0 py-2 px-8 focus:outline-hidden hover:bg-rose-600 rounded-sm text-lg"
            onClick={close}
          >
            Cancel
          </button>
        </div>
      </form>
    </Form>
  );
};
