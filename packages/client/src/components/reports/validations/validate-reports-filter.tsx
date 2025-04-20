import { ReactElement, useContext, useEffect, useState } from 'react';
import { format, subYears } from 'date-fns';
import equal from 'deep-equal';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Filter } from 'tabler-icons-react';
import { ActionIcon, Select } from '@mantine/core';
import { MonthPickerInput } from '@mantine/dates';
import { ValidatePcn874ReportsQueryVariables } from '../../../gql/graphql.js';
import { isObjectEmpty, TimelessDateString } from '../../../helpers/index.js';
import { useGetBusinesses } from '../../../hooks/use-get-businesses.js';
import { useUrlQuery } from '../../../hooks/use-url-query.js';
import { UserContext } from '../../../providers/user-provider.jsx';
import { PopUpModal } from '../../common/index.js';
import { Button } from '../../ui/button.js';

interface ValidateReportsFilterFormProps {
  filter: ValidatePcn874ReportsQueryVariables;
  setFilter: (filter?: ValidatePcn874ReportsQueryVariables) => void;
  closeModal: () => void;
}

function ValidateReportsFilterForm({
  filter,
  setFilter,
  closeModal,
}: ValidateReportsFilterFormProps): ReactElement {
  const { control, handleSubmit, setValue } = useForm<ValidatePcn874ReportsQueryVariables>({
    defaultValues: { ...filter },
  });
  const { selectableBusinesses: businesses, fetching: feLoading } = useGetBusinesses();

  const onSubmit: SubmitHandler<ValidatePcn874ReportsQueryVariables> = data => {
    setFilter(data);
    closeModal();
  };

  return (
    <>
      {feLoading ? <div>Loading...</div> : <div />}
      <form onSubmit={handleSubmit(onSubmit)}>
        <Controller
          name="businessId"
          control={control}
          defaultValue={undefined}
          render={({ field, fieldState }): ReactElement => (
            <Select
              {...field}
              data={businesses}
              value={field.value}
              disabled={feLoading}
              label="Businesses"
              placeholder="Scroll to see all options"
              maxDropdownHeight={160}
              searchable
              error={fieldState.error?.message}
            />
          )}
        />
        <MonthPickerInput
          label="From date"
          defaultValue={filter?.fromMonthDate ? new Date(filter.fromMonthDate) : new Date()}
          defaultDate={filter?.fromMonthDate ? new Date(filter.fromMonthDate) : new Date()}
          onChange={(date: Date) => {
            const month = new Date(date.getFullYear(), date.getMonth(), 15);
            setValue('fromMonthDate', format(month, 'yyyy-MM-dd') as TimelessDateString);
          }}
          popoverProps={{ withinPortal: true }}
        />
        <MonthPickerInput
          label="To date"
          defaultValue={filter?.toMonthDate ? new Date(filter.toMonthDate) : new Date()}
          defaultDate={filter?.toMonthDate ? new Date(filter.toMonthDate) : new Date()}
          onChange={(date: Date) => {
            const month = new Date(date.getFullYear(), date.getMonth(), 15);
            setValue('toMonthDate', format(month, 'yyyy-MM-dd') as TimelessDateString);
          }}
          popoverProps={{ withinPortal: true }}
        />
        <div className="flex justify-center mt-5 gap-3">
          <Button type="submit">Filter</Button>
          <Button type="button" onClick={closeModal}>
            Cancel
          </Button>
        </div>
      </form>
    </>
  );
}

interface ValidateReportsFilterProps {
  filter: ValidatePcn874ReportsQueryVariables;
  setFilter: (filter: ValidatePcn874ReportsQueryVariables) => void;
}

export function ValidateReportsFilter({
  filter,
  setFilter,
}: ValidateReportsFilterProps): ReactElement {
  const [opened, setOpened] = useState(false);
  const { get, set } = useUrlQuery();

  const { userContext } = useContext(UserContext);

  function onSetFilter(newFilter?: ValidatePcn874ReportsQueryVariables): void {
    newFilter ||= {
      businessId: userContext?.context.adminBusinessId ?? filter.businessId,
      fromMonthDate: format(subYears(new Date(), 1), 'yyyy-MM-15') as TimelessDateString,
      toMonthDate: format(new Date(), 'yyyy-MM-15') as TimelessDateString,
    };
    // looks for actual changes before triggering update
    if (!equal(newFilter, filter)) {
      setFilter(newFilter);
    }
  }

  // update url on filter change
  useEffect(() => {
    const newFilter = isObjectEmpty(filter ?? {})
      ? null
      : encodeURIComponent(JSON.stringify(filter));
    const oldFilter = get('validateReportsFilters');
    if (newFilter !== oldFilter) {
      set('validateReportsFilters', newFilter);
    }
  }, [filter, get, set]);

  return (
    <>
      <PopUpModal
        opened={opened}
        onClose={(): void => setOpened(false)}
        content={
          <ValidateReportsFilterForm
            filter={filter}
            setFilter={onSetFilter}
            closeModal={(): void => setOpened(false)}
          />
        }
      />
      <ActionIcon variant="default" onClick={(): void => setOpened(true)} size={30}>
        <Filter size={20} />
      </ActionIcon>
    </>
  );
}
