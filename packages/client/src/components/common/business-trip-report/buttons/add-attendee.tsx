import { ReactElement, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Plus } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { ActionIcon, Loader, Modal, Overlay, Select, Tooltip } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { showNotification } from '@mantine/notifications';
import { AllBusinessesDocument, InsertBusinessTripAttendeeInput } from '../../../../gql/graphql.js';
import { TIMELESS_DATE_REGEX } from '../../../../helpers/index.js';
import { useInsertBusinessTripAttendee } from '../../../../hooks/use-insert-business-trip-attendee.js';

export function AddAttendee(props: { businessTripId: string; onAdd?: () => void }): ReactElement {
  const { businessTripId, onAdd } = props;
  const [opened, { close, open }] = useDisclosure(false);

  return (
    <>
      <Tooltip label="Add Attendee">
        <ActionIcon
          variant="default"
          onClick={(event): void => {
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

type ModalProps = {
  opened: boolean;
  close: () => void;
  onAdd?: () => void;
  businessTripId: string;
};

function ModalContent({ businessTripId, opened, close, onAdd }: ModalProps): ReactElement {
  const [businesses, setBusinesses] = useState<Array<{ value: string; label: string }>>([]);
  const [{ data, fetching: fetchingBusinesses, error }] = useQuery({
    query: AllBusinessesDocument,
  });

  const { control, handleSubmit } = useForm<InsertBusinessTripAttendeeInput>({
    defaultValues: { businessTripId },
  });

  // On every new data fetch, reorder results by name
  useEffect(() => {
    if (data?.allBusinesses?.nodes.length) {
      setBusinesses(
        data.allBusinesses.nodes
          .map(entity => ({
            value: entity.id,
            label: entity.name,
          }))
          .sort((a, b) => (a.label > b.label ? 1 : -1)),
      );
    }
  }, [data, setBusinesses]);

  useEffect(() => {
    if (error) {
      showNotification({
        title: 'Error!',
        message: 'Oops, we have an error fetching businesses',
      });
    }
  }, [error]);

  const { insertBusinessTripAttendee, fetching: addingInProcess } = useInsertBusinessTripAttendee();

  const onSubmit: SubmitHandler<InsertBusinessTripAttendeeInput> = data => {
    insertBusinessTripAttendee({ fields: data }).then(() => {
      onAdd?.();
      close();
    });
  };

  return (
    <Modal opened={opened} onClose={close} centered>
      <Modal.Title>Add Attendee</Modal.Title>
      <Modal.Body>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Controller
            name="attendeeId"
            control={control}
            render={({ field, fieldState }): ReactElement => (
              <Select
                data-autofocus
                {...field}
                data={businesses}
                value={field.value}
                disabled={fetchingBusinesses}
                label="Attendee"
                placeholder="Scroll to see all options"
                maxDropdownHeight={160}
                searchable
                error={fieldState.error?.message}
                withAsterisk
                withinPortal
              />
            )}
          />

          <Controller
            name="arrivalDate"
            control={control}
            rules={{
              pattern: {
                value: TIMELESS_DATE_REGEX,
                message: 'Date must be im format yyyy-mm-dd',
              },
            }}
            render={({ field, fieldState }): ReactElement => (
              <DatePickerInput
                {...field}
                onChange={(date?: Date | string | null): void => {
                  const newDate = date
                    ? typeof date === 'string'
                      ? date
                      : format(date, 'yyyy-MM-dd')
                    : undefined;
                  if (newDate !== field.value) field.onChange(newDate);
                }}
                value={field.value ? new Date(field.value) : undefined}
                error={fieldState.error?.message}
                label="Arrival"
                popoverProps={{ withinPortal: true }}
              />
            )}
          />

          <Controller
            name="departureDate"
            control={control}
            rules={{
              pattern: {
                value: TIMELESS_DATE_REGEX,
                message: 'Date must be im format yyyy-mm-dd',
              },
            }}
            render={({ field, fieldState }): ReactElement => (
              <DatePickerInput
                {...field}
                onChange={(date?: Date | string | null): void => {
                  const newDate = date
                    ? typeof date === 'string'
                      ? date
                      : format(date, 'yyyy-MM-dd')
                    : undefined;
                  if (newDate !== field.value) field.onChange(newDate);
                }}
                value={field.value ? new Date(field.value) : undefined}
                error={fieldState.error?.message}
                label="Departure"
                popoverProps={{ withinPortal: true }}
              />
            )}
          />

          <div className="flex justify-center mt-5 gap-3">
            <button
              type="submit"
              className="text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-lg"
            >
              Add
            </button>
          </div>
        </form>
      </Modal.Body>
      {(addingInProcess || fetchingBusinesses) && (
        <Overlay blur={1} center>
          <Loader />
        </Overlay>
      )}
    </Modal>
  );
}
