import { useState, type ReactElement } from 'react';
import { Plus } from 'lucide-react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { type AddBusinessTripAccommodationsExpenseInput } from '../../../../gql/graphql.js';
import { CountryCode } from '../../../../helpers/countries.js';
import { useAddBusinessTripAccommodationsExpense } from '../../../../hooks/use-add-business-trip-accommodations-expense.js';
import { Button } from '../../../ui/button.js';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../../ui/form.js';
import { LoadingOverlay } from '../../../ui/overlay.js';
import { ComboBox, NumberInput, PopUpModal, Tooltip } from '../../index.js';
import { AttendeesStayInput } from '../parts/attendee-stay-input.js';
import { AddExpenseFields } from './add-expense-fields.js';

const countries = Object.entries(CountryCode).map(([label, value]) => ({ value, label }));

export function AddAccommodationExpense(props: {
  businessTripId: string;
  onAdd?: () => void;
}): ReactElement {
  const { businessTripId, onAdd } = props;
  const [opened, setOpened] = useState(false);

  return (
    <>
      <Tooltip content="Add Accommodations Expense">
        <Button
          variant="outline"
          size="icon"
          className="size-7.5"
          onClick={event => {
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

type ModalProps = {
  opened: boolean;
  close: () => void;
  onAdd?: () => void;
  businessTripId: string;
};

function ModalContent({ businessTripId, opened, close, onAdd }: ModalProps): ReactElement {
  const formManager = useForm<AddBusinessTripAccommodationsExpenseInput>({
    defaultValues: { businessTripId },
  });
  const { control, handleSubmit } = formManager;
  const [fetching, setFetching] = useState(false);

  const { addBusinessTripAccommodationsExpense, fetching: addingInProcess } =
    useAddBusinessTripAccommodationsExpense();

  const onSubmit: SubmitHandler<AddBusinessTripAccommodationsExpenseInput> = data => {
    addBusinessTripAccommodationsExpense({ fields: data }).then(() => {
      onAdd?.();
      close();
    });
  };

  return (
    <PopUpModal opened={opened} onClose={close} withCloseButton title="Add Accommodation Expense">
      <Form {...formManager}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <AddExpenseFields
            businessTripId={businessTripId}
            control={control}
            setFetching={setFetching}
          />

          <FormField
            control={control}
            name="country"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Country</FormLabel>
                <ComboBox
                  onChange={field.onChange}
                  data={countries}
                  value={field.value ?? null}
                  placeholder="Select country"
                  formPart
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="nightsCount"
            control={control}
            render={({ field }): ReactElement => (
              <FormItem>
                <FormLabel>Nights Count</FormLabel>
                <FormControl>
                  <NumberInput
                    {...field}
                    value={field.value ?? undefined}
                    hideControls
                    decimalScale={0}
                    thousandSeparator=","
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <AttendeesStayInput
            formManager={formManager}
            attendeesStayPath="attendeesStay"
            businessTripId={businessTripId}
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
