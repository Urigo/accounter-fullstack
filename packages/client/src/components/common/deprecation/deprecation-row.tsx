import { ReactElement, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Check, Edit } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { ActionIcon, Select, Tooltip } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import {
  AllDeprecationCategoriesDocument,
  DeprecationRecordRowFieldsFragmentDoc,
  UpdateDeprecationRecordInput,
} from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { MakeBoolean, relevantDataPicker, TIMELESS_DATE_REGEX } from '../../../helpers/index.js';
import { useUpdateDeprecationRecord } from '../../../hooks/use-update-deprecation-record.js';
import { CurrencyInput } from '../index.js';
import { DeleteDeprecationRecord } from './delete-deprecation-record.js';
import { deprecationTypes } from './index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment DeprecationRecordRowFields on DeprecationRecord {
    id
    amount {
      currency
      formatted
      raw
    }
    activationDate
    category {
      id
      name
      percentage
    }
    type
    charge {
      id
      totalAmount {
        currency
        formatted
        raw
      }
    }
  }
`;

interface Props {
  data: FragmentType<typeof DeprecationRecordRowFieldsFragmentDoc>;
  onChange?: () => void;
}

export const DeprecationRow = ({ data, onChange }: Props): ReactElement => {
  const deprecationRecord = getFragmentData(DeprecationRecordRowFieldsFragmentDoc, data);
  console.log('deprecationRecord', deprecationRecord);
  const [isEditMode, setIsEditMode] = useState(false);

  const [{ data: categoriesData, fetching: fetchingCategories }, fetchCategories] = useQuery({
    query: AllDeprecationCategoriesDocument,
    pause: true,
  });

  const {
    control,
    handleSubmit,
    formState: { dirtyFields },
  } = useForm<UpdateDeprecationRecordInput>({
    defaultValues: {
      id: deprecationRecord.id,
    },
  });

  const { updateDeprecationRecord, fetching: updatingInProcess } = useUpdateDeprecationRecord();

  const onSubmit: SubmitHandler<UpdateDeprecationRecordInput> = data => {
    const dataToUpdate = relevantDataPicker(data, dirtyFields as MakeBoolean<typeof data>);
    if (dataToUpdate && Object.keys(dataToUpdate).length > 0) {
      updateDeprecationRecord({
        fields: { ...data, id: deprecationRecord.id },
      }).then(() => {
        onChange?.();
        setIsEditMode(false);
      });
    }
  };

  const categories = categoriesData?.deprecationCategories.map(category => ({
    value: category.id,
    label: category.name,
  }));

  useEffect(() => {
    if (isEditMode && !categoriesData) fetchCategories();
  }, [isEditMode, categoriesData, fetchCategories]);

  return (
    <tr key={deprecationRecord.id}>
      <td>
        <form id={`form ${deprecationRecord.id}`} onSubmit={handleSubmit(onSubmit)}>
          {isEditMode ? (
            <Controller
              name="amount"
              control={control}
              render={({ field: amountField, fieldState: amountFieldState }): ReactElement => (
                <Controller
                  name="currency"
                  control={control}
                  render={({
                    field: currencyCodeField,
                    fieldState: currencyCodeFieldState,
                  }): ReactElement => (
                    <CurrencyInput
                      {...amountField}
                      defaultValue={
                        deprecationRecord.amount?.raw ?? deprecationRecord.charge.totalAmount?.raw
                      }
                      value={amountField.value ?? undefined}
                      error={
                        amountFieldState.error?.message || currencyCodeFieldState.error?.message
                      }
                      label="Amount"
                      currencyCodeProps={{
                        ...currencyCodeField,
                        label: 'Currency',
                        defaultValue:
                          deprecationRecord.amount?.currency ??
                          deprecationRecord.charge.totalAmount?.currency,
                      }}
                    />
                  )}
                />
              )}
            />
          ) : (
            <div>
              {deprecationRecord.amount?.formatted ??
                deprecationRecord.charge.totalAmount?.formatted}
            </div>
          )}
        </form>
      </td>
      <td>
        <div className="flex flex-col gap-2 justify-center">
          {isEditMode ? (
            <Controller
              name="activationDate"
              control={control}
              defaultValue={deprecationRecord.activationDate}
              rules={{
                pattern: {
                  value: TIMELESS_DATE_REGEX,
                  message: 'Date must be im format yyyy-mm-dd',
                },
              }}
              render={({ field: { value, ...field }, fieldState }): ReactElement => {
                const date = value ? new Date(value) : undefined;
                return (
                  <DateInput
                    {...field}
                    form={`form ${deprecationRecord.id}`}
                    onChange={(date?: Date | string | null): void => {
                      const newDate = date
                        ? typeof date === 'string'
                          ? date
                          : format(date, 'yyyy-MM-dd')
                        : undefined;
                      if (newDate !== value) field.onChange(newDate);
                    }}
                    value={date}
                    label="Activation Date"
                    placeholder="Date"
                    error={fieldState.error?.message}
                    popoverProps={{ withinPortal: true }}
                  />
                );
              }}
            />
          ) : (
            <div>{format(new Date(deprecationRecord.activationDate), 'dd/MM/yy')}</div>
          )}
        </div>
      </td>
      <td>
        {isEditMode ? (
          <Controller
            name="categoryId"
            control={control}
            render={({ field, fieldState }): ReactElement => (
              <Select
                {...field}
                form={`form ${deprecationRecord.id}`}
                disabled={fetchingCategories}
                data={categories ?? []}
                label="Category"
                placeholder="Scroll to see all options"
                maxDropdownHeight={160}
                searchable
                error={fieldState.error?.message}
                withinPortal
              />
            )}
          />
        ) : (
          <div>
            {deprecationRecord.category.name} ({deprecationRecord.category.percentage}%)
          </div>
        )}
      </td>
      <td>
        {isEditMode ? (
          <Controller
            name="type"
            control={control}
            render={({ field, fieldState }): ReactElement => (
              <Select
                {...field}
                form={`form ${deprecationRecord.id}`}
                data={deprecationTypes}
                value={field.value}
                label="Type"
                placeholder="Scroll to see all options"
                maxDropdownHeight={160}
                searchable
                error={fieldState.error?.message}
                withinPortal
              />
            )}
          />
        ) : (
          <div>{deprecationRecord.type}</div>
        )}
      </td>
      <td>
        <Tooltip label="Edit">
          <ActionIcon
            loading={updatingInProcess || fetchingCategories}
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
              form={`form ${deprecationRecord.id}`}
              variant="default"
              size={30}
            >
              <Check size={20} color="green" />
            </ActionIcon>
          </Tooltip>
        )}

        <DeleteDeprecationRecord deprecationRecordId={deprecationRecord.id} onDelete={onChange} />
      </td>
    </tr>
  );
};
