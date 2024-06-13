import { ReactElement, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Check, Edit } from 'tabler-icons-react';
import { ActionIcon, Select, Text, TextInput, Tooltip } from '@mantine/core';
import { FlightClass, UpdateBusinessTripFlightsTransactionInput } from '../../../../gql/graphql.js';
import { graphql } from '../../../../graphql.js';
import { useUpdateBusinessTripFlightsTransaction } from '../../../../hooks/use-update-business-trip-flights-transaction.js';
import { DeleteBusinessTripTransaction } from '../buttons/delete-business-trip-transaction.js';
import { CoreTransactionRow } from './core-transaction-row.js';

export const BusinessTripReportFlightsRowFieldsFragmentDoc = graphql(`
  fragment BusinessTripReportFlightsRowFields on BusinessTripFlightTransaction {
    id
    payedByEmployee
    ...BusinessTripReportCoreTransactionRowFields
    origin
    destination
    class
  }
`);

const flightClasses = Object.entries(FlightClass).map(([key, value]) => ({
  value,
  label: key,
}));

interface Props {
  data: FragmentOf<typeof BusinessTripReportFlightsRowFieldsFragmentDoc>;
  businessTripId: string;
  onChange: () => void;
}

export const FlightsRow = ({ data, businessTripId, onChange }: Props): ReactElement => {
  const flightTransaction = readFragment(BusinessTripReportFlightsRowFieldsFragmentDoc, data);
  const [isEditMode, setIsEditMode] = useState(false);

  const { control, handleSubmit } = useForm<UpdateBusinessTripFlightsTransactionInput>({
    defaultValues: {
      id: flightTransaction.id,
      businessTripId,
    },
  });

  const { updateBusinessTripFlightsTransaction, fetching: updatingInProcess } =
    useUpdateBusinessTripFlightsTransaction();

  const onSubmit: SubmitHandler<UpdateBusinessTripFlightsTransactionInput> = data => {
    updateBusinessTripFlightsTransaction({ fields: data }).then(() => {
      onChange?.();
      setIsEditMode(false);
      close();
    });
  };

  return (
    <tr key={flightTransaction.id}>
      <CoreTransactionRow
        data={flightTransaction}
        isEditMode={isEditMode}
        control={control}
        businessTripId={businessTripId}
      />

      <td>
        <form id={`form ${flightTransaction.id}`} onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-2 justify-center">
            {isEditMode ? (
              <div className="flex gap-2 items-center">
                <Controller
                  name="origin"
                  control={control}
                  defaultValue={flightTransaction.origin}
                  render={({ field, fieldState }): ReactElement => (
                    <TextInput
                      data-autofocus={flightTransaction.payedByEmployee ? undefined : true}
                      form={`form ${flightTransaction.id}`}
                      {...field}
                      value={field.value ?? undefined}
                      error={fieldState.error?.message}
                      label="Origin"
                    />
                  )}
                />
                {' → '}
                <Controller
                  name="destination"
                  control={control}
                  defaultValue={flightTransaction.destination}
                  render={({ field, fieldState }): ReactElement => (
                    <TextInput
                      form={`form ${flightTransaction.id}`}
                      {...field}
                      value={field.value ?? undefined}
                      error={fieldState.error?.message}
                      label="Destination"
                    />
                  )}
                />
              </div>
            ) : (
              <div>
                <Text fw={700} className="flex gap-2 items-center">
                  <Text c={flightTransaction.origin ? undefined : 'red'}>
                    {flightTransaction.origin ?? 'Missing'}
                  </Text>
                  {' → '}
                  <Text c={flightTransaction.destination ? undefined : 'red'}>
                    {flightTransaction.destination ?? 'Missing'}
                  </Text>
                </Text>
              </div>
            )}
            {isEditMode ? (
              <Controller
                name="flightClass"
                control={control}
                defaultValue={
                  (flightTransaction.class as FlightClass | null | undefined) ?? undefined
                }
                render={({ field, fieldState }): ReactElement => (
                  <Select
                    form={`form ${flightTransaction.id}`}
                    data-autofocus
                    {...field}
                    data={flightClasses}
                    value={field.value}
                    label="Flight Class"
                    placeholder="Scroll to see all options"
                    maxDropdownHeight={160}
                    searchable
                    error={fieldState.error?.message}
                    withinPortal
                  />
                )}
              />
            ) : (
              <Text
                c={flightTransaction.class ? undefined : 'red'}
                fz="sm"
              >{`Class: ${flightTransaction.class ?? 'Missing'}`}</Text>
            )}
          </div>
        </form>
      </td>
      <td>
        <Tooltip label="Edit">
          <ActionIcon
            loading={updatingInProcess}
            variant={isEditMode ? 'filled' : 'default'}
            onClick={(event): void => {
              event.stopPropagation();
              setIsEditMode(curr => !curr);
            }}
            size={30}
          >
            <Edit size={20} />
          </ActionIcon>
        </Tooltip>
        {isEditMode && (
          <Tooltip label="Confirm Changes">
            <ActionIcon
              type="submit"
              form={`form ${flightTransaction.id}`}
              variant="default"
              size={30}
            >
              <Check size={20} color="green" />
            </ActionIcon>
          </Tooltip>
        )}

        <DeleteBusinessTripTransaction
          businessTripTransactionId={flightTransaction.id}
          onDelete={onChange}
        />
      </td>
    </tr>
  );
};
