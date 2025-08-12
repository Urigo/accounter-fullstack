import { useState, type ReactElement } from 'react';
import { Check, Edit } from 'lucide-react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { Text, Tooltip } from '@mantine/core';
import {
  BusinessTripReportOtherRowFieldsFragmentDoc,
  type UpdateBusinessTripOtherExpenseInput,
} from '../../../../gql/graphql.js';
import { getFragmentData, type FragmentType } from '../../../../gql/index.js';
import { useUpdateBusinessTripOtherExpense } from '../../../../hooks/use-update-business-trip-other-expense.js';
import { Button } from '../../../ui/button.js';
import { Form, FormControl, FormField, FormItem, FormMessage } from '../../../ui/form.js';
import { Input } from '../../../ui/input.js';
import { Switch } from '../../../ui/switch.js';
import { CategorizeIntoExistingExpense } from '../buttons/categorize-into-existing-expense.js';
import { DeleteBusinessTripExpense } from '../buttons/delete-business-trip-expense.js';
import { CoreExpenseRow } from './core-expense-row.jsx';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment BusinessTripReportOtherRowFields on BusinessTripOtherExpense {
    id
    ...BusinessTripReportCoreExpenseRowFields
    payedByEmployee
    description
    deductibleExpense
  }
`;

interface Props {
  data: FragmentType<typeof BusinessTripReportOtherRowFieldsFragmentDoc>;
  businessTripId: string;
  onChange: () => void;
}

export const OtherRow = ({ data, businessTripId, onChange }: Props): ReactElement => {
  const otherExpense = getFragmentData(BusinessTripReportOtherRowFieldsFragmentDoc, data);
  const [isEditMode, setIsEditMode] = useState(false);

  const form = useForm<UpdateBusinessTripOtherExpenseInput>({
    defaultValues: {
      id: otherExpense.id,
      businessTripId,
    },
  });
  const { control, handleSubmit } = form;

  const { updateBusinessTripOtherExpense, fetching: updatingInProcess } =
    useUpdateBusinessTripOtherExpense();

  const onSubmit: SubmitHandler<UpdateBusinessTripOtherExpenseInput> = data => {
    updateBusinessTripOtherExpense({ fields: data }).then(() => {
      onChange?.();
      setIsEditMode(false);
    });
  };

  return (
    <tr key={otherExpense.id}>
      <CoreExpenseRow
        data={otherExpense}
        isEditMode={isEditMode}
        control={control}
        businessTripId={businessTripId}
      />

      <td>
        <Form {...form}>
          <form id={`form ${otherExpense.id}`} onSubmit={handleSubmit(onSubmit)}>
            {isEditMode ? (
              <FormField
                name="description"
                control={control}
                defaultValue={otherExpense.description}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        form={`form ${otherExpense.id}`}
                        {...field}
                        value={field.value ?? undefined}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <Text c={otherExpense.description ? undefined : 'red'}>
                {otherExpense.description ?? 'Missing'}
              </Text>
            )}
          </form>
        </Form>
      </td>
      <td>
        <div className="flex flex-col gap-2 justify-center">
          {isEditMode ? (
            <Form {...form}>
              <FormField
                name="deductibleExpense"
                control={form.control}
                defaultValue={otherExpense.deductibleExpense}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Switch
                        form={`form ${otherExpense.id}`}
                        checked={field.value === true}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </Form>
          ) : (
            <Text c={otherExpense.deductibleExpense ? undefined : 'red'}>
              {otherExpense.deductibleExpense === true
                ? 'Yes'
                : otherExpense.deductibleExpense === false
                  ? 'No'
                  : 'Missing'}
            </Text>
          )}
        </div>
      </td>
      <td>
        <Tooltip label="Edit">
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
          <Tooltip label="Confirm Changes">
            <Button
              type="submit"
              form={`form ${otherExpense.id}`}
              variant="outline"
              size="icon"
              className="size-7.5 text-green-500"
            >
              <Check className="size-5" />
            </Button>
          </Tooltip>
        )}

        <CategorizeIntoExistingExpense
          businessTripExpenseId={otherExpense.id}
          businessTripId={businessTripId}
          onChange={onChange}
        />

        <DeleteBusinessTripExpense businessTripExpenseId={otherExpense.id} onDelete={onChange} />
      </td>
    </tr>
  );
};
