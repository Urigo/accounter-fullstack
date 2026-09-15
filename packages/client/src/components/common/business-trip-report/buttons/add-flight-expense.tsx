import { useState, type ReactElement } from 'react';
import { Plus } from 'lucide-react';
import { Controller, useForm, type SubmitHandler } from 'react-hook-form';
import { useQuery } from 'urql';
import {
  AttendeesByBusinessTripDocument,
  FlightClass,
  type AddBusinessTripFlightsExpenseInput,
} from '../../../../gql/graphql.js';
import { useAddBusinessTripFlightsExpense } from '../../../../hooks/use-add-business-trip-flights-expense.js';
import { Button } from '../../../ui/button.js';
import { Form } from '../../../ui/form.js';
import { Label } from '../../../ui/label.js';
import { LoadingOverlay } from '../../../ui/overlay.js';
import { ComboBox, NegatableMultiSelect, PopUpModal, Tooltip } from '../../index.js';
import { FlightPathInput } from '../parts/flight-path-input.js';
import { AddExpenseFields } from './add-expense-fields.js';

export function AddFlightExpense(props: {
  businessTripId: string;
  onAdd?: () => void;
}): ReactElement {
  const { businessTripId, onAdd } = props;
  const [opened, setOpened] = useState(false);

  return (
    <>
      <Tooltip content="Add Flight Expense">
        <Button
          variant="outline"
          size="icon"
          className="size-7.5"
          onClick={(event): void => {
            event.stopPropagation();
            setOpened(true);
          }}
        >
          <Plus className="size-5" />
        </Button>
      </Tooltip>
      {opened && (
        <ModalContent
          businessTripId={businessTripId}
          opened={opened}
          close={() => setOpened(false)}
          onAdd={onAdd}
        />
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
    <PopUpModal opened={opened} onClose={close} withCloseButton title="Add Flight Expense">
      <Form {...formManager}>
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
              <ComboBox
                {...field}
                data={flightClasses}
                value={field.value}
                label="Flight Class"
                placeholder="Scroll to see all options"
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            name="attendeeIds"
            control={control}
            render={({ field, fieldState }): ReactElement => (
              <div>
                <Label asChild className="mb-1">
                  <span id="flight-attendees-label">Attendees</span>
                </Label>
                <NegatableMultiSelect
                  ref={field.ref}
                  onBlur={field.onBlur}
                  options={attendeesData}
                  value={field.value ?? []}
                  onValueChange={field.onChange}
                  loading={fetchingAttendees}
                  placeholder="Scroll to see all options"
                  aria-labelledby="flight-attendees-label"
                  aria-invalid={!!fieldState.error}
                  aria-describedby={fieldState.error ? 'flight-attendees-error' : undefined}
                />
                {fieldState.error?.message ? (
                  <p id="flight-attendees-error" className="text-destructive mt-1 text-xs">
                    {fieldState.error.message}
                  </p>
                ) : null}
              </div>
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
      <LoadingOverlay visible={addingInProcess || fetching} blur={1} />
    </PopUpModal>
  );
}
