import { ReactElement, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Plus } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { ActionIcon, Loader, Modal, MultiSelect, Overlay, Select, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  AddBusinessTripFlightsExpenseInput,
  AttendeesByBusinessTripDocument,
  FlightClass,
} from '../../../../gql/graphql.js';
import { useAddBusinessTripFlightsExpense } from '../../../../hooks/use-add-business-trip-flights-expense.js';
import { FlightPathInput } from '../parts/flight-path-input.js';
import { AddExpenseFields } from './add-expense-fields.js';

export function AddFlightExpense(props: {
  businessTripId: string;
  onAdd?: () => void;
}): ReactElement {
  const { businessTripId, onAdd } = props;
  const [opened, { close, open }] = useDisclosure(false);

  return (
    <>
      <Tooltip label="Add Flight Expense">
        <ActionIcon
          variant="default"
          onClick={(event: React.MouseEvent<HTMLAnchorElement, MouseEvent>): void => {
            event.stopPropagation();
            open();
          }}
          size={30}
        >
          <Plus size={20} />
        </ActionIcon>
      </Tooltip>
      {opened && (
        <ModalContent businessTripId={businessTripId} opened={opened} close={close} onAdd={onAdd} />
      )}
    </>
  );
}

const flightClasses = Object.entries(FlightClass).map(([key, value]) => ({
  value,
  label: key,
}));

type ModalProps = {
  opened: boolean;
  close: () => void;
  onAdd?: () => void;
  businessTripId: string;
};

function ModalContent({ businessTripId, opened, close, onAdd }: ModalProps): ReactElement {
  const formManager = useForm<AddBusinessTripFlightsExpenseInput>({
    defaultValues: { businessTripId },
  });
  const { control, handleSubmit } = formManager;
  const [fetching, setFetching] = useState(false);

  const [{ data, fetching: fetchingAttendees }] = useQuery({
    query: AttendeesByBusinessTripDocument,
    variables: {
      businessTripId,
    },
  });

  const { addBusinessTripFlightsExpense, fetching: addingInProcess } =
    useAddBusinessTripFlightsExpense();

  const onSubmit: SubmitHandler<AddBusinessTripFlightsExpenseInput> = data => {
    addBusinessTripFlightsExpense({ fields: data }).then(() => {
      onAdd?.();
      close();
    });
  };

  const attendeesData =
    data?.businessTrip?.attendees.map(attendee => ({
      value: attendee.id,
      label: attendee.name,
    })) ?? [];

  return (
    <Modal opened={opened} onClose={close} centered lockScroll>
      <Modal.Title>Add Flight Expense</Modal.Title>
      <Modal.Body>
        <form onSubmit={handleSubmit(onSubmit)}>
          <AddExpenseFields
            businessTripId={businessTripId}
            control={control}
            setFetching={setFetching}
          />

          <FlightPathInput formManager={formManager} flightPathPath="path" />
          <Controller
            name="flightClass"
            control={control}
            render={({ field, fieldState }): ReactElement => (
              <Select
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
          <Controller
            name="attendeeIds"
            control={control}
            render={({ field, fieldState }): ReactElement => (
              <MultiSelect
                {...field}
                disabled={fetchingAttendees}
                data={attendeesData}
                value={field.value ?? []}
                label="Attendees"
                placeholder="Scroll to see all options"
                maxDropdownHeight={160}
                searchable
                error={fieldState.error?.message}
                withinPortal
              />
            )}
          />

          <div className="flex justify-center mt-5 gap-3">
            <button
              type="submit"
              className="text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-hidden hover:bg-indigo-600 rounded-sm text-lg"
            >
              Add
            </button>
          </div>
        </form>
      </Modal.Body>
      {(addingInProcess || fetching) && (
        <Overlay blur={1} center>
          <Loader />
        </Overlay>
      )}
    </Modal>
  );
}
