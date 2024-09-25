import { ReactElement, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Control, Controller } from 'react-hook-form';
import { Check, X } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { NavLink, Select, Text, ThemeIcon } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { showNotification } from '@mantine/notifications';
import {
  AttendeesByBusinessTripDocument,
  BusinessTripReportCoreExpenseRowFieldsFragmentDoc,
  Currency,
  UpdateBusinessTripFlightsExpenseInput,
} from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { TIMELESS_DATE_REGEX } from '../../../../helpers/consts.js';
import { CurrencyInput } from '../../index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportCoreExpenseRowFields on BusinessTripExpense {
    id
    date
    valueDate
    amount {
      formatted
      raw
      currency
    }
    employee {
      id
      name
    }
    payedByEmployee
    transactions {
      id
      chargeId
    }
  }
`;

interface Props {
  data: FragmentType<typeof BusinessTripReportCoreExpenseRowFieldsFragmentDoc>;
  isEditMode: boolean;
  control: Control<UpdateBusinessTripFlightsExpenseInput, unknown>;
  businessTripId: string;
}

export const CoreExpenseRow = ({
  data,
  isEditMode = false,
  control,
  businessTripId,
}: Props): ReactElement => {
  const businessTripExpense = getFragmentData(
    BusinessTripReportCoreExpenseRowFieldsFragmentDoc,
    data,
  );

  const [attendees, setAttendees] = useState<Array<{ value: string; label: string }>>([]);

  const [{ data: attendeesData, fetching: fetchingAttendees, error }] = useQuery({
    query: AttendeesByBusinessTripDocument,
    variables: { businessTripId },
  });

  // On every new data fetch, reorder results by name
  useEffect(() => {
    if (attendeesData?.businessTrip?.attendees.length) {
      setAttendees(
        attendeesData.businessTrip.attendees
          .map(attendee => ({
            value: attendee.id,
            label: attendee.name,
          }))
          .sort((a, b) => (a.label > b.label ? 1 : -1)),
      );
    }
  }, [attendeesData, setAttendees]);

  useEffect(() => {
    if (error) {
      showNotification({
        title: 'Error!',
        message: 'Oops, we have an error fetching attendees',
      });
    }
  }, [error]);

  const linkedChargeIds = Array.from(
    new Set(businessTripExpense.transactions?.map(t => t.chargeId)),
  );

  return (
    <>
      <td>
        <div className="flex flex-col gap-2 justify-center">
          {isEditMode && businessTripExpense.payedByEmployee ? (
            <>
              <Controller
                name="date"
                control={control}
                defaultValue={businessTripExpense.date}
                rules={{
                  pattern: {
                    value: TIMELESS_DATE_REGEX,
                    message: 'Date must be im format yyyy-mm-dd',
                  },
                }}
                render={({ field, fieldState }): ReactElement => (
                  <DatePickerInput
                    {...field}
                    form={`form ${businessTripExpense.id}`}
                    data-autofocus
                    onChange={(date?: Date | string | null): void => {
                      const newDate = date
                        ? typeof date === 'string'
                          ? date
                          : format(date, 'yyyy-MM-dd')
                        : undefined;
                      if (newDate !== field.value) field.onChange(newDate);
                    }}
                    value={field.value ? new Date(field.value) : undefined}
                    label="Date"
                    error={fieldState.error?.message}
                    popoverProps={{ withinPortal: true }}
                  />
                )}
              />
              <Controller
                name="valueDate"
                control={control}
                defaultValue={businessTripExpense.valueDate}
                rules={{
                  pattern: {
                    value: TIMELESS_DATE_REGEX,
                    message: 'Date must be im format yyyy-mm-dd',
                  },
                }}
                render={({ field, fieldState }): ReactElement => (
                  <DatePickerInput
                    {...field}
                    form={`form ${businessTripExpense.id}`}
                    onChange={(date?: Date | string | null): void => {
                      const newDate = date
                        ? typeof date === 'string'
                          ? date
                          : format(date, 'yyyy-MM-dd')
                        : undefined;
                      if (newDate !== field.value) field.onChange(newDate);
                    }}
                    value={field.value ? new Date(field.value) : undefined}
                    label="Value Date"
                    error={fieldState.error?.message}
                    popoverProps={{ withinPortal: true }}
                  />
                )}
              />
            </>
          ) : (
            <>
              {businessTripExpense.date && format(new Date(businessTripExpense.date), 'dd/MM/yy')}
              <Text fz="sm" c="dimmed">
                {businessTripExpense.valueDate &&
                  format(new Date(businessTripExpense.valueDate), 'dd/MM/yy')}
              </Text>
            </>
          )}
        </div>
      </td>
      <td>
        {isEditMode && businessTripExpense.payedByEmployee ? (
          <Controller
            name="amount"
            control={control}
            defaultValue={businessTripExpense.amount?.raw ?? undefined}
            render={({ field: amountField, fieldState: amountFieldState }): ReactElement => (
              <Controller
                name="currency"
                control={control}
                defaultValue={businessTripExpense.amount?.currency ?? Currency.Ils}
                render={({
                  field: currencyCodeField,
                  fieldState: currencyCodeFieldState,
                }): ReactElement => (
                  <CurrencyInput
                    form={`form ${businessTripExpense.id}`}
                    {...amountField}
                    value={amountField.value ?? undefined}
                    error={amountFieldState.error?.message || currencyCodeFieldState.error?.message}
                    label="Amount"
                    currencyCodeProps={{
                      ...currencyCodeField,
                      label: 'Currency',
                      form: `form ${businessTripExpense.id}`,
                    }}
                  />
                )}
              />
            )}
          />
        ) : (
          <div>{businessTripExpense.amount?.formatted}</div>
        )}
      </td>
      <td>
        <div className="flex flex-col gap-2 justify-center">
          {isEditMode && businessTripExpense.payedByEmployee ? (
            <Controller
              name="employeeBusinessId"
              control={control}
              defaultValue={businessTripExpense.employee?.id}
              render={({ field, fieldState }): ReactElement => (
                <Select
                  form={`form ${businessTripExpense.id}`}
                  {...field}
                  data={attendees}
                  value={field.value}
                  disabled={fetchingAttendees}
                  label="Attendee"
                  placeholder="Scroll to see all options"
                  maxDropdownHeight={160}
                  searchable
                  error={fieldState.error?.message}
                  withinPortal
                />
              )}
            />
          ) : (
            <div className="flex flex-row gap-2 items-center">
              {businessTripExpense.payedByEmployee ? (
                <>
                  <ThemeIcon variant="default" radius="lg">
                    <Check />
                  </ThemeIcon>
                  <Text c={businessTripExpense.employee?.name ? undefined : 'red'}>
                    {businessTripExpense.employee?.name ?? 'Missing'}
                  </Text>
                </>
              ) : (
                <>
                  <ThemeIcon variant="default" radius="lg">
                    <X />
                  </ThemeIcon>
                  <div className="flex flex-col gap-2">
                    {linkedChargeIds?.length &&
                      linkedChargeIds.map(id => (
                        <NavLink
                          key={id}
                          label="To Charge"
                          className="[&>*>.mantine-NavLink-label]:font-semibold"
                          onClick={event => {
                            event.stopPropagation();
                            window.open(`/charges/${id}`, '_blank', 'noreferrer');
                          }}
                        />
                      ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </td>
    </>
  );
};

export const CoreExpenseHeader = (): ReactElement => {
  return (
    <>
      <th>Date</th>
      <th>Amount</th>
      <th>Payed By Attendee</th>
    </>
  );
};
