import { ReactElement, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Control, Controller } from 'react-hook-form';
import { Check, X } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { NavLink, Select, Text, TextInput, ThemeIcon } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import {
  AllBusinessTripAttendeesDocument,
  BusinessTripReportCoreTransactionRowFieldsFragmentDoc,
  Currency,
  UpdateBusinessTripFlightsTransactionInput,
} from '../../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../../gql/index.js';
import { TIMELESS_DATE_REGEX } from '../../../../helpers/consts.js';
import { CurrencyInput } from '../../index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportCoreTransactionRowFields on BusinessTripTransaction {
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
    transaction {
      id
      chargeId
    }
  }
`;

interface Props {
  data: FragmentType<typeof BusinessTripReportCoreTransactionRowFieldsFragmentDoc>;
  isEditMode: boolean;
  control: Control<UpdateBusinessTripFlightsTransactionInput, unknown>;
  businessTripId: string;
}

export const CoreTransactionRow = ({
  data,
  isEditMode = false,
  control,
  businessTripId,
}: Props): ReactElement => {
  const businessTripTransaction = getFragmentData(
    BusinessTripReportCoreTransactionRowFieldsFragmentDoc,
    data,
  );

  const [attendees, setAttendees] = useState<Array<{ value: string; label: string }>>([]);

  const [{ data: attendeesData, fetching: fetchingAttendees, error }] = useQuery({
    query: AllBusinessTripAttendeesDocument,
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

  return (
    <>
      <td>
        <div className="flex flex-col gap-2 justify-center">
          {isEditMode && businessTripTransaction.payedByEmployee ? (
            <>
              <Controller
                name="date"
                control={control}
                defaultValue={businessTripTransaction.date}
                rules={{
                  pattern: {
                    value: TIMELESS_DATE_REGEX,
                    message: 'Date must be im format yyyy-mm-dd',
                  },
                }}
                render={({ field, fieldState }): ReactElement => (
                  <TextInput
                    {...field}
                    data-autofocus
                    form={`form ${businessTripTransaction.id}`}
                    value={field.value ?? undefined}
                    error={fieldState.error?.message}
                    label="Date"
                  />
                )}
              />
              <Controller
                name="valueDate"
                control={control}
                defaultValue={businessTripTransaction.valueDate}
                rules={{
                  pattern: {
                    value: TIMELESS_DATE_REGEX,
                    message: 'Date must be im format yyyy-mm-dd',
                  },
                }}
                render={({ field, fieldState }): ReactElement => (
                  <TextInput
                    {...field}
                    form={`form ${businessTripTransaction.id}`}
                    value={field.value ?? undefined}
                    error={fieldState.error?.message}
                    label="Value Date"
                  />
                )}
              />
            </>
          ) : (
            <>
              {businessTripTransaction.date &&
                format(new Date(businessTripTransaction.date), 'dd/MM/yy')}
              <Text fz="sm" c="dimmed">
                {businessTripTransaction.valueDate &&
                  format(new Date(businessTripTransaction.valueDate), 'dd/MM/yy')}
              </Text>
            </>
          )}
        </div>
      </td>
      <td>
        {isEditMode && businessTripTransaction.payedByEmployee ? (
          <Controller
            name="amount"
            control={control}
            defaultValue={businessTripTransaction.amount?.raw ?? undefined}
            render={({ field: amountField, fieldState: amountFieldState }): ReactElement => (
              <Controller
                name="currency"
                control={control}
                defaultValue={businessTripTransaction.amount?.currency ?? Currency.Ils}
                render={({
                  field: currencyCodeField,
                  fieldState: currencyCodeFieldState,
                }): ReactElement => (
                  <CurrencyInput
                    form={`form ${businessTripTransaction.id}`}
                    {...amountField}
                    value={amountField.value ?? undefined}
                    error={amountFieldState.error?.message || currencyCodeFieldState.error?.message}
                    label="Amount"
                    currencyCodeProps={{
                      ...currencyCodeField,
                      label: 'Currency',
                      form: `form ${businessTripTransaction.id}`,
                    }}
                  />
                )}
              />
            )}
          />
        ) : (
          <div>{businessTripTransaction.amount?.formatted}</div>
        )}
      </td>
      <td>
        <div className="flex flex-col gap-2 justify-center">
          {isEditMode && businessTripTransaction.payedByEmployee ? (
            <Controller
              name="employeeBusinessId"
              control={control}
              defaultValue={businessTripTransaction.employee?.id}
              render={({ field, fieldState }): ReactElement => (
                <Select
                  form={`form ${businessTripTransaction.id}`}
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
              {businessTripTransaction.payedByEmployee ? (
                <>
                  <ThemeIcon variant="default" radius="lg">
                    <Check />
                  </ThemeIcon>
                  <Text c={businessTripTransaction.employee?.name ? undefined : 'red'}>
                    {businessTripTransaction.employee?.name ?? 'Missing'}
                  </Text>
                </>
              ) : (
                <>
                  <ThemeIcon variant="default" radius="lg">
                    <X />
                  </ThemeIcon>
                  <NavLink
                    label="To Charge"
                    className="[&>*>.mantine-NavLink-label]:font-semibold"
                    onClick={event => {
                      event.stopPropagation();
                      window.open(
                        `/charges/${businessTripTransaction.transaction?.chargeId}`,
                        '_blank',
                        'noreferrer',
                      );
                    }}
                  />
                </>
              )}
            </div>
          )}
        </div>
      </td>
    </>
  );
};

export const CoreTransactionHeader = (): ReactElement => {
  return (
    <>
      <th>Date</th>
      <th>Amount</th>
      <th>Payed By Attendee</th>
    </>
  );
};
