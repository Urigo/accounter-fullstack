import { useEffect, useState } from 'react';
import { ActionIcon, MultiSelect, Select, Switch } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import equal from 'deep-equal';
import gql from 'graphql-tag';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Filter } from 'tabler-icons-react';
import {
  ChargeFilter,
  ChargeSortByField,
  useAllFinancialEntitiesQuery,
} from '../../__generated__/types';
import { TIMELESS_DATE_REGEX } from '../../helpers/consts';
import { PopUpModal } from '../common';
import { TextInput } from '../common/inputs';

gql`
  query AllFinancialEntities {
    allFinancialEntities {
      id
      name
    }
  }
`;

interface ChargesFiltersFormProps {
  filter: ChargeFilter;
  setFilter: (filter: ChargeFilter) => void;
  closeModal: () => void;
}

const fieldsToSort: { label: string; value: ChargeSortByField }[] = [
  {
    value: ChargeSortByField.AbsAmount,
    label: 'Abs Amount',
  },
  //   {
  //     value: 'account_number',
  //     label: 'Account Number',
  //   },
  //   {
  //     value: 'account_type',
  //     label: 'Account Type',
  //   },
  //   {
  //     value: 'currency_code',
  //     label: 'Currency',
  //   },
  //   {
  //     value: 'debit_date',
  //     label: 'Debit Date',
  //   },
  {
    value: ChargeSortByField.Amount,
    label: 'Amount',
  },
  {
    value: ChargeSortByField.Date,
    label: 'Date',
  },
  //   {
  //     value: 'financial_entity',
  //     label: 'Financial Entity',
  //   },
  //   {
  //     value: 'personal_category',
  //     label: 'Personal Category',
  //   },
  //   {
  //     value: 'receipt_date',
  //     label: 'Receipt Date',
  //   },
  //   {
  //     value: 'tax_category',
  //     label: 'Tax Category',
  //   },
  //   {
  //     value: 'tax_invoice_amount',
  //     label: 'Invoice Amount',
  //   },
  //   {
  //     value: 'tax_invoice_date',
  //     label: 'Invoice Date',
  //   },
  //   {
  //     value: 'vat',
  //     label: 'Vat',
  //   },
];

function ChargesFiltersForm({ filter, setFilter, closeModal }: ChargesFiltersFormProps) {
  const { control, handleSubmit, watch } = useForm<ChargeFilter>({ defaultValues: { ...filter } });
  const [asc, setAsc] = useState(filter.sortBy?.asc ?? false);
  const [enableAsc, setEnableAsc] = useState(Boolean(filter.sortBy?.field));
  const { data, isLoading, isError: financialEntitiesError } = useAllFinancialEntitiesQuery();

  const sortByField = watch('sortBy.field');

  useEffect(() => {
    console.log(sortByField);
    if (sortByField && !enableAsc) {
      setEnableAsc(true);
    } else if (!sortByField && enableAsc) {
      setEnableAsc(false);
    }
  }, [sortByField, enableAsc]);

  useEffect(() => {
    if (financialEntitiesError) {
      showNotification({
        title: 'Error!',
        message: 'Oh no!, we have an error fetching financial entities! 🤥',
      });
    }
  }, [financialEntitiesError]);

  const onSubmit: SubmitHandler<ChargeFilter> = data => {
    if (asc != null && data.sortBy?.field) {
      data.sortBy.asc = asc;
    }
    console.log('filter: ', data);
    setFilter(data);
    closeModal();
  };

  function clearFilter() {
    setFilter({});
    setAsc(false);
    closeModal();
  }

  return (
    <>
      {isLoading ? <div>Loading...</div> : <div />}
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* <SimpleGrid cols={4}> */}
        <Controller
          name="byFinancialEntities"
          control={control}
          defaultValue={undefined}
          render={({ field, fieldState }) => (
            <MultiSelect
              {...field}
              data={
                data?.allFinancialEntities.map(entity => ({
                  value: entity.id,
                  label: entity.name,
                })) ?? []
              }
              value={field.value ?? ['6a20aa69-57ff-446e-8d6a-1e96d095e988']}
              disabled={isLoading}
              label="Financial Entities"
              placeholder="Scroll to see all options"
              maxDropdownHeight={160}
              searchable
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          name="fromDate"
          control={control}
          defaultValue={filter.fromDate}
          rules={{
            pattern: {
              value: TIMELESS_DATE_REGEX,
              message: 'Date must be im format yyyy-mm-dd',
            },
          }}
          render={({ field, fieldState }) => (
            <TextInput
              {...field}
              value={!field.value || field.value === 'Missing' ? '' : field.value}
              error={fieldState.error?.message}
              label="From Date"
            />
          )}
        />
        <Controller
          name="toDate"
          control={control}
          defaultValue={filter.toDate}
          rules={{
            pattern: {
              value: TIMELESS_DATE_REGEX,
              message: 'Date must be im format yyyy-mm-dd',
            },
          }}
          render={({ field, fieldState }) => (
            <TextInput
              {...field}
              value={!field.value || field.value === 'Missing' ? '' : field.value}
              error={fieldState.error?.message}
              label="To Date"
            />
          )}
        />
        <Controller
          name="sortBy.field"
          control={control}
          defaultValue={ChargeSortByField.Date}
          render={({ field, fieldState }) => (
            <Select
              {...field}
              data={fieldsToSort}
              label="Field to sort by"
              placeholder="Scroll to see all options"
              maxDropdownHeight={160}
              searchable
              error={fieldState.error?.message}
            />
          )}
        />
        <Switch
          defaultChecked={false}
          checked={asc ?? false}
          disabled={!enableAsc}
          onChange={event => setAsc(event.currentTarget.checked)}
          color="gray"
          onLabel={<p>ASC</p>}
          offLabel={<p>DESC</p>}
        />
        {/* </SimpleGrid> */}
        <div className="flex justify-center mt-5 gap-3">
          <button
            type="submit"
            className="text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-lg"
          >
            Filter
          </button>
          <button
            type="button"
            className="text-white bg-orange-500 border-0 py-2 px-8 focus:outline-none hover:bg-orange-600 rounded text-lg"
            onClick={clearFilter}
          >
            Clear
          </button>
          <button
            type="button"
            className="text-white bg-rose-500 border-0 py-2 px-8 focus:outline-none hover:bg-rose-600 rounded text-lg"
            onClick={closeModal}
          >
            Cancel
          </button>
        </div>
      </form>
    </>
  );
}

interface ChargesFiltersProps {
  filter: ChargeFilter;
  setFilter: (filter: ChargeFilter) => void;
}

export function ChargesFilters({ filter, setFilter }: ChargesFiltersProps) {
  const [opened, setOpened] = useState(false);
  const [isFiltered, setIsFiltered] = useState(false);

  function isFilterApplied(filter: ChargeFilter) {
    const changed = Object.entries(filter ?? {}).filter(
      ([_key, value]) => value !== undefined && Array.isArray(value) && value.length > 0,
    );
    return changed.length > 0;
  }

  function onSetFilter(newFilter: ChargeFilter) {
    // looks for actual changes before triggering update
    if (!equal(newFilter, filter)) {
      setFilter(newFilter);
      setIsFiltered(isFilterApplied(newFilter));
    }
  }

  return (
    <>
      <PopUpModal
        opened={opened}
        onClose={() => setOpened(false)}
        content={
          <ChargesFiltersForm
            filter={filter}
            setFilter={onSetFilter}
            closeModal={() => setOpened(false)}
          />
        }
      />
      <ActionIcon
        variant="outline"
        color={isFiltered ? 'red' : 'gray'}
        onClick={() => setOpened(true)}
      >
        <Filter size={20} />
      </ActionIcon>
    </>
  );
}
