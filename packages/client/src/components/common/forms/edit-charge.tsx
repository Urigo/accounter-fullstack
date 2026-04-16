import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { toast } from 'sonner';
import { useQuery } from 'urql';
import { Select } from '@mantine/core';
import {
  AllBusinessTripsDocument,
  type EditChargeQuery,
  type UpdateChargeInput,
} from '../../../gql/graphql.js';
import {
  CHARGE_TYPE_NAME,
  EMPTY_UUID,
  getChargeTypeInputValue,
  relevantDataPicker,
  type MakeBoolean,
  type TimelessDateString,
} from '../../../helpers/index.js';
import { useGetTags } from '../../../hooks/use-get-tags.js';
import { useGetTaxCategories } from '../../../hooks/use-get-tax-categories.js';
import { useUpdateCharge } from '../../../hooks/use-update-charge.js';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form.js';
import { Input } from '../../ui/input.js';
import { Switch } from '../../ui/switch.js';
import {
  ChargeSpreadInput,
  InsertBusinessTripModal,
  MultiSelect,
  SimilarChargesByIdModal,
  SimpleGrid,
} from '../index.js';

const chargeTypes = Object.entries(CHARGE_TYPE_NAME).map(([value, label]) => ({
  value: getChargeTypeInputValue(value as keyof typeof CHARGE_TYPE_NAME),
  label,
}));

type Props = {
  charge: EditChargeQuery['charge'];
  close: () => void;
  onChange: () => void;
};

export const EditCharge = ({ charge, close, onChange }: Props): ReactElement => {
  const { updateCharge, fetching: isChargeLoading } = useUpdateCharge();
  const [businessTrips, setBusinessTrips] = useState<Array<{ value: string; label: string }>>([]);
  const [similarChargesOpen, setSimilarChargesOpen] = useState(false);
  const [similarChargesData, setSimilarChargesData] = useState<
    | {
        tagIds?: { id: string }[];
        description?: string;
      }
    | undefined
  >(undefined);

  const chargeInputData: UpdateChargeInput = useMemo(
    () => ({
      tags: charge.tags?.map(tag => ({ id: tag.id })),
      counterpartyId: charge.counterparty?.id,
      businessTripID: 'businessTrip' in charge ? charge.businessTrip?.id : undefined,
      defaultTaxCategoryID: charge.taxCategory?.id,
      isDecreasedVAT: charge.decreasedVAT,
      isInvoicePaymentDifferentCurrency: charge.isInvoicePaymentDifferentCurrency,
      optionalDocuments: charge.optionalDocuments,
      optionalVAT: charge.optionalVAT,
      ownerId: charge.owner?.id,
      type: getChargeTypeInputValue(charge.__typename),
      userDescription: charge.userDescription,
      yearsOfRelevance: charge.yearsOfRelevance
        ?.map(record => ({
          year: record.year as TimelessDateString,
          amount: record.amount,
        }))
        .sort((a, b) => (a.year > b.year ? 1 : -1)),
    }),
    [charge],
  );

  const formManager = useForm<UpdateChargeInput>({
    defaultValues: chargeInputData,
  });

  const {
    control,
    handleSubmit,
    formState: { dirtyFields: dirtyChargeFields },
    // setValue,
  } = formManager;

  const onChargeSubmit: SubmitHandler<UpdateChargeInput> = async data => {
    const dataToUpdate = relevantDataPicker(data, dirtyChargeFields as MakeBoolean<typeof data>);
    if (dataToUpdate && Object.keys(dataToUpdate).length > 0) {
      await updateCharge({
        chargeId: charge.id,
        fields: {
          ...dataToUpdate,
          yearsOfRelevance: data.yearsOfRelevance
            ? Object.values(data.yearsOfRelevance)
            : undefined,
        },
      });
      if (dataToUpdate.tags?.length || dataToUpdate.userDescription) {
        const nonSimilarData: {
          tagIds?: { id: string }[];
          description?: string;
        } = {};
        if (dataToUpdate.tags) {
          const suggestedTags = charge?.missingInfoSuggestions?.tags ?? [];
          const suggestedTagIds = new Set(suggestedTags.map(t => t.id));
          const updatedTagIds = new Set(dataToUpdate.tags.map(t => t.id));

          // Check if tags differ from suggestions
          const tagsAreDifferent =
            suggestedTagIds.size !== updatedTagIds.size ||
            [...suggestedTagIds].some(id => !updatedTagIds.has(id));

          if (tagsAreDifferent) {
            nonSimilarData.tagIds = dataToUpdate.tags.map(tag => ({ id: tag.id }));
          }
        }
        // if (
        //   dataToUpdate.userDescription &&
        //   dataToUpdate.userDescription !== charge.missingInfoSuggestions?.description
        // ) {
        //   nonSimilarData.description = dataToUpdate.userDescription;
        // }
        setSimilarChargesData(nonSimilarData);
        setSimilarChargesOpen(true);
      } else {
        close();
        onChange?.();
      }
    }
  };

  // handle tax categories
  const { selectableTaxCategories: taxCategories, fetching: fetchingTaxCategories } =
    useGetTaxCategories();
  const { selectableTags, fetching: fetchingTags } = useGetTags();

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
    <>
      <Form {...formManager}>
        <form onSubmit={handleSubmit(onChargeSubmit)}>
          <div className="flex-row px-10 h-max justify-start block">
            <SimpleGrid cols={3}>
              <FormField
                name="userDescription"
                control={control}
                defaultValue={chargeInputData.userDescription}
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
              <FormField
                name="defaultTaxCategoryID"
                control={control}
                defaultValue={chargeInputData.defaultTaxCategoryID}
                render={({ field, fieldState }): ReactElement => (
                  <FormItem>
                    <FormLabel>Tax Category Override</FormLabel>
                    <FormControl>
                      <Select
                        {...field}
                        data={taxCategories}
                        value={field.value}
                        disabled={fetchingTaxCategories}
                        placeholder="Scroll to see all options"
                        maxDropdownHeight={160}
                        searchable
                        error={fieldState.error?.message}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="businessTripID"
                control={control}
                defaultValue={chargeInputData.businessTripID}
                render={({ field, fieldState }): ReactElement => (
                  <FormItem>
                    <FormLabel>Business Trip</FormLabel>
                    <FormControl>
                      <Select
                        {...field}
                        data={businessTrips}
                        value={field.value}
                        disabled={fetchingBusinessTrips}
                        placeholder="Scroll to see all options"
                        maxDropdownHeight={160}
                        searchable
                        error={fieldState.error?.message}
                        rightSection={
                          <InsertBusinessTripModal onDone={refetchBusinessTripsCallback} />
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="tags"
                control={control}
                defaultValue={chargeInputData.tags}
                render={({ field, fieldState }): ReactElement => {
                  const selectedTagIds = field.value?.map(tag => tag.id) ?? [];

                  return (
                    <FormItem>
                      <FormLabel>Tags</FormLabel>
                      <FormControl>
                        <MultiSelect
                          asChild
                          options={Object.values(selectableTags)}
                          onValueChange={selectedIds =>
                            field.onChange(selectedIds.map(id => ({ id })))
                          }
                          defaultValue={selectedTagIds}
                          value={selectedTagIds}
                          placeholder="Select Tags"
                          variant="default"
                          disabled={fetchingTags}
                          className={fieldState.error ? 'border-red-500' : undefined}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                name="type"
                control={control}
                defaultValue={chargeInputData.type}
                render={({ field, fieldState }): ReactElement => (
                  <FormItem>
                    <FormLabel>Charge Type</FormLabel>
                    <FormControl>
                      <Select
                        {...field}
                        data={chargeTypes}
                        value={field.value}
                        placeholder="Scroll to see all options"
                        maxDropdownHeight={160}
                        searchable
                        error={fieldState.error?.message}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                name="isInvoicePaymentDifferentCurrency"
                control={control}
                defaultValue={chargeInputData.isInvoicePaymentDifferentCurrency}
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
                name="isDecreasedVAT"
                control={control}
                defaultValue={chargeInputData.isDecreasedVAT}
                render={({ field }) => (
                  <FormItem className="flex flex-row h-fit items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Is Decreased VAT</FormLabel>
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
                defaultValue={chargeInputData.optionalVAT ?? false}
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
                defaultValue={chargeInputData.optionalDocuments ?? false}
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

      <SimilarChargesByIdModal
        chargeId={charge.id}
        tagIds={similarChargesData?.tagIds}
        description={similarChargesData?.description}
        open={similarChargesOpen}
        onOpenChange={setSimilarChargesOpen}
        onClose={() => {
          close();
          onChange?.();
        }}
        showChargesWithExistingSuggestions
      />
    </>
  );
};
