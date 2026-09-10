import { Fragment, useState, type ReactElement } from 'react';
import { Check, Edit } from 'lucide-react';
import { Controller, useForm, type SubmitHandler } from 'react-hook-form';
import {
  BusinessTripReportFlightsRowFieldsFragmentDoc,
  FlightClass,
  type UpdateBusinessTripFlightsExpenseInput,
} from '../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../gql/index.js';
import { useUpdateBusinessTripFlightsExpense } from '../../../../hooks/use-update-business-trip-flights-expense.js';
import { cn } from '../../../../lib/utils.js';
import { Button } from '../../../ui/button.js';
import { Form } from '../../../ui/form.js';
import { Label } from '../../../ui/label.js';
import { ComboBox, NegatableMultiSelect, Tooltip } from '../../index.js';
import { CategorizeIntoExistingExpense } from '../buttons/categorize-into-existing-expense.js';
import { DeleteBusinessTripExpense } from '../buttons/delete-business-trip-expense.js';
import { CoreExpenseRow } from './core-expense-row.js';
import { FlightPathInput } from './flight-path-input.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportFlightsRowFields on BusinessTripFlightExpense {
    id
    payedByEmployee
    ...BusinessTripReportCoreExpenseRowFields
    path
    class
    attendees {
      id
      name
    }
  }
`;

const flightClasses = Object.entries(FlightClass).map(([key, value]) => ({
  value,
  label: key,
}));

interface Props {
  data: FragmentType<typeof BusinessTripReportFlightsRowFieldsFragmentDoc>;
  businessTripId: string;
  onChange?: () => void;
  attendees: { id: string; name: string }[];
}

export const FlightsRow = ({ data, businessTripId, onChange, attendees }: Props): ReactElement => {
  const flightExpense = getFragmentData(BusinessTripReportFlightsRowFieldsFragmentDoc, data);
  const [isEditMode, setIsEditMode] = useState(false);

  const formManager = useForm<UpdateBusinessTripFlightsExpenseInput>({
    defaultValues: {
      id: flightExpense.id,
      businessTripId,
      attendeeIds: flightExpense.attendees?.map(attendee => attendee.id) ?? [],
      path: flightExpense.path ?? [],
    },
  });
  const { control, handleSubmit } = formManager;

  const { updateBusinessTripFlightsExpense, fetching: updatingInProcess } =
    useUpdateBusinessTripFlightsExpense();

  const onSubmit: SubmitHandler<UpdateBusinessTripFlightsExpenseInput> = data => {
    updateBusinessTripFlightsExpense({ fields: data }).then(() => {
      onChange?.();
      setIsEditMode(false);
    });
  };

  const attendeesData = attendees.map(attendee => ({
    value: attendee.id,
    label: attendee.name,
  }));

  return (
    <tr key={flightExpense.id}>
      <CoreExpenseRow
        data={flightExpense}
        isEditMode={isEditMode}
        control={control}
        businessTripId={businessTripId}
      />

      <td>
        <Form {...formManager}>
          <form id={`form ${flightExpense.id}`} onSubmit={handleSubmit(onSubmit)}>
            <div className="flex flex-col gap-2 justify-center">
              {isEditMode ? (
                <FlightPathInput
                  formManager={formManager}
                  flightPathPath="path"
                  flightPathData={flightExpense.path ?? undefined}
                />
              ) : (
                <div className="flex gap-2 items-center">
                  {flightExpense.path?.length ? (
                    flightExpense.path.map((destination, i) => (
                      // Keyed on the fragment, not the inner div: the fragment is what `.map`
                      // returns. The index is the key because a path can repeat a destination,
                      // which is exactly the case the separator below distinguishes.
                      <Fragment key={i}>
                        <div className="font-bold">{destination}</div>
                        {i < flightExpense.path!.length - 1 &&
                          (destination === flightExpense.path![i + 1] ? ' | ' : ' → ')}
                      </Fragment>
                    ))
                  ) : (
                    <div className="flex gap-2 items-center font-bold text-red-500">Missing</div>
                  )}
                </div>
              )}
              {isEditMode ? (
                <Controller
                  name="flightClass"
                  control={control}
                  defaultValue={
                    (flightExpense.class as FlightClass | null | undefined) ?? undefined
                  }
                  render={({ field, fieldState }): ReactElement => (
                    <ComboBox
                      form={`form ${flightExpense.id}`}
                      {...field}
                      data={flightClasses}
                      value={field.value}
                      label="Flight Class"
                      placeholder="Scroll to see all options"
                      error={fieldState.error?.message}
                    />
                  )}
                />
              ) : (
                <div
                  className={cn('text-sm', flightExpense.class ? undefined : 'text-red-500')}
                >{`Class: ${flightExpense.class ?? 'Missing'}`}</div>
              )}
            </div>
          </form>
        </Form>
      </td>
      <td>
        {isEditMode ? (
          <Controller
            name="attendeeIds"
            control={control}
            defaultValue={flightExpense.attendees?.map(attendee => attendee.id) ?? undefined}
            render={({ field, fieldState }): ReactElement => (
              <div>
                {/*
                  `form` is not carried over: the replacement renders no native form control to
                  associate, and the value reaches submission through react-hook-form either way.
                  The label is a span wired by `aria-labelledby` — the trigger is a div, so
                  `htmlFor` would associate nothing.
                */}
                <Label asChild className="mb-1">
                  <span id={`flight-attendees-label-${flightExpense.id}`}>Attendees</span>
                </Label>
                <NegatableMultiSelect
                  ref={field.ref}
                  onBlur={field.onBlur}
                  options={attendeesData}
                  value={field.value ?? []}
                  onValueChange={field.onChange}
                  placeholder="Scroll to see all options"
                  aria-labelledby={`flight-attendees-label-${flightExpense.id}`}
                  aria-invalid={!!fieldState.error}
                />
                {fieldState.error?.message ? (
                  <p className="text-destructive mt-1 text-xs">{fieldState.error.message}</p>
                ) : null}
              </div>
            )}
          />
        ) : (
          <ul className="list-disc list-inside">
            {flightExpense.attendees?.length ? (
              flightExpense.attendees.map(attendee => <li key={attendee.id}>{attendee.name}</li>)
            ) : (
              <li className="list-none text-red-500 text-sm">Missing</li>
            )}
          </ul>
        )}
      </td>
      <td>
        {onChange && (
          <>
            <Tooltip content="Edit">
              <Button
                disabled={updatingInProcess}
                variant={isEditMode ? 'default' : 'outline'}
                size="icon"
                className="size-7.5"
                onClick={(event): void => {
                  event.stopPropagation();
                  setIsEditMode(curr => !curr);
                }}
              >
                <Edit className="size-5" />
              </Button>
            </Tooltip>
            {isEditMode && (
              <Tooltip content="Confirm Changes">
                <Button
                  type="submit"
                  form={`form ${flightExpense.id}`}
                  variant="outline"
                  size="icon"
                  className="size-7.5 text-green-500"
                >
                  <Check className="size-5" />
                </Button>
              </Tooltip>
            )}

            <CategorizeIntoExistingExpense
              businessTripExpenseId={flightExpense.id}
              businessTripId={businessTripId}
              onChange={onChange}
            />

            <DeleteBusinessTripExpense
              businessTripExpenseId={flightExpense.id}
              onDelete={onChange}
            />
          </>
        )}
      </td>
    </tr>
  );
};
