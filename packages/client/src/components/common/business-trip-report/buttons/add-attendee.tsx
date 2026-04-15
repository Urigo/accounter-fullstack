import type { ReactElement } from 'react';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { Controller, useForm, type SubmitHandler } from 'react-hook-form';
import { Loader, Modal, Overlay, Select } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import type { InsertBusinessTripAttendeeInput } from '../../../../gql/graphql.js';
import { TIMELESS_DATE_REGEX } from '../../../../helpers/index.js';
import { useGetBusinesses } from '../../../../hooks/use-get-businesses.js';
import { useInsertBusinessTripAttendee } from '../../../../hooks/use-insert-business-trip-attendee.js';
import { Button } from '../../../ui/button.js';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../../ui/form.js';
import { Tooltip } from '../../index.js';
import { DatePickerInput } from '../../inputs/date-picker-input.js';

export function AddAttendee(props: { businessTripId: string; onAdd?: () => void }): ReactElement {
  const { businessTripId, onAdd } = props;
  const [opened, { close, open }] = useDisclosure(false);

  return (
    <>
      <Tooltip content="Add Attendee">
        <Button
          variant="outline"
          size="icon"
          onClick={event => {
            event.stopPropagation();
            open();
          }}
          className="size-7.5"
        >
          <Plus className="size-5" />
        </Button>
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
  const { selectableBusinesses: businesses, fetching: fetchingBusinesses } = useGetBusinesses();

  const form = useForm<InsertBusinessTripAttendeeInput>({
    defaultValues: { businessTripId },
  });
  const { control, handleSubmit } = form;

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
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
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

            <FormField
              name="arrivalDate"
              control={control}
              rules={{
                pattern: {
                  value: TIMELESS_DATE_REGEX,
                  message: 'Date must be im format yyyy-mm-dd',
                },
              }}
              render={({ field, fieldState }): ReactElement => (
                <FormItem className="h-min">
                  <FormLabel htmlFor="arrival-date">Arrival</FormLabel>
                  <FormControl>
                    <DatePickerInput
                      id="arrival-date"
                      value={field.value ? new Date(field.value) : undefined}
                      onChange={(date?: Date | null): void => {
                        const newDate = date ? format(date, 'yyyy-MM-dd') : undefined;
                        if (newDate !== field.value) field.onChange(newDate);
                      }}
                      aria-invalid={!!fieldState.error}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              name="departureDate"
              control={control}
              rules={{
                pattern: {
                  value: TIMELESS_DATE_REGEX,
                  message: 'Date must be im format yyyy-mm-dd',
                },
              }}
              render={({ field, fieldState }): ReactElement => (
                <FormItem className="h-min">
                  <FormLabel htmlFor="departure-date">Departure</FormLabel>
                  <FormControl>
                    <DatePickerInput
                      id="departure-date"
                      value={field.value ? new Date(field.value) : undefined}
                      onChange={(date?: Date | null): void => {
                        const newDate = date ? format(date, 'yyyy-MM-dd') : undefined;
                        if (newDate !== field.value) field.onChange(newDate);
                      }}
                      aria-invalid={!!fieldState.error}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
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
        </Form>
      </Modal.Body>
      {(addingInProcess || fetchingBusinesses) && (
        <Overlay blur={1} center>
          <Loader />
        </Overlay>
      )}
    </Modal>
  );
}
