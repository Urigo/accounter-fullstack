import { useMemo, type ReactElement } from 'react';
import { useWatch, type Control } from 'react-hook-form';
import { ChargeType } from '../../../../gql/graphql.js';
import { useGetAdminBusinesses } from '../../../../hooks/use-get-admin-businesses.js';
import { useGetBusinessTrips } from '../../../../hooks/use-get-business-trips.js';
import { useGetFinancialAccounts } from '../../../../hooks/use-get-financial-accounts.js';
import { useGetFinancialEntities } from '../../../../hooks/use-get-financial-entities.js';
import { useGetTags } from '../../../../hooks/use-get-tags.js';
import type { NegatableMultiSelectOption } from '../../../common/inputs/negatable-multi-select.js';
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_ORDER } from '../constants.js';
import { MultiSelectField, NegatableMultiSelectField } from '../negatable-multi-select-field.js';
import type { ChargeFilterFormValues } from '../schema.js';

export type EntitiesData = ReturnType<typeof useEntitiesData>;

/** Hoisted so the form can also feed the header chips and gate the Apply button. */
export function useEntitiesData() {
  const { selectableAdminBusinesses, fetching: ownersFetching } = useGetAdminBusinesses();
  const { selectableFinancialEntities, fetching: financialEntitiesFetching } =
    useGetFinancialEntities();
  const { selectableFinancialAccounts, fetching: financialAccountsFetching } =
    useGetFinancialAccounts();
  const { selectableTags, fetching: tagsFetching } = useGetTags();
  const { selectableBusinessTrips, fetching: businessTripsFetching } = useGetBusinessTrips();

  const accountOptions = useMemo<NegatableMultiSelectOption[]>(
    () =>
      selectableFinancialAccounts.map(account => ({
        value: account.value,
        label: account.label,
        group: ACCOUNT_TYPE_LABELS[account.type],
      })),
    [selectableFinancialAccounts],
  );

  return {
    owners: selectableAdminBusinesses,
    ownersFetching,
    financialEntities: selectableFinancialEntities,
    financialEntitiesFetching,
    financialAccounts: accountOptions,
    financialAccountsFetching,
    tags: selectableTags,
    tagsFetching,
    businessTrips: selectableBusinessTrips,
    businessTripsFetching,
    fetching:
      ownersFetching ||
      financialEntitiesFetching ||
      financialAccountsFetching ||
      tagsFetching ||
      businessTripsFetching,
  };
}

export function EntitiesSection({
  control,
  data,
}: {
  control: Control<ChargeFilterFormValues>;
  data: EntitiesData;
}): ReactElement {
  const byChargeTypes = useWatch({ control, name: 'byChargeTypes' });
  const byBusinessTrips = useWatch({ control, name: 'byBusinessTrips' });
  const byOwners = useWatch({ control, name: 'byOwners' });

  // A single-owner tenant has nothing to choose, so the field is noise — but never hide
  // a value that is already set, or it becomes invisible and unremovable.
  const showOwners = data.owners.length > 1 || (byOwners?.length ?? 0) > 0;
  // Same rule: keep the trip picker reachable whenever a trip is already selected.
  const showBusinessTrips =
    (byChargeTypes ?? []).includes(ChargeType.BusinessTrip) || (byBusinessTrips?.length ?? 0) > 0;

  return (
    <>
      {showOwners && (
        <MultiSelectField
          control={control}
          name="byOwners"
          label="Owners"
          options={data.owners}
          loading={data.ownersFetching}
          placeholder="All my businesses"
          searchPlaceholder="Search owners..."
        />
      )}

      <NegatableMultiSelectField
        control={control}
        include="byBusinesses"
        exclude="excludedBusinesses"
        label="Financial Entities"
        options={data.financialEntities}
        loading={data.financialEntitiesFetching}
        placeholder="All counterparties"
        searchPlaceholder="Search counterparties..."
      />

      <NegatableMultiSelectField
        control={control}
        include="byFinancialAccounts"
        exclude="excludedFinancialAccounts"
        label="Financial Accounts"
        options={data.financialAccounts}
        loading={data.financialAccountsFetching}
        placeholder="All accounts"
        searchPlaceholder="Search accounts..."
        groupOrder={ACCOUNT_TYPE_ORDER}
      />

      <NegatableMultiSelectField
        control={control}
        include="byTags"
        exclude="excludedTags"
        label="Tags"
        options={data.tags}
        loading={data.tagsFetching}
        placeholder="All tags"
        searchPlaceholder="Search tags or paths..."
      />

      {showBusinessTrips && (
        <MultiSelectField
          control={control}
          name="byBusinessTrips"
          label="Business Trips"
          options={data.businessTrips}
          loading={data.businessTripsFetching}
          placeholder="All trips"
          searchPlaceholder="Search trips..."
        />
      )}
    </>
  );
}
