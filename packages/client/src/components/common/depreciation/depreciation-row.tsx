import { ReactElement, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Check, Edit } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { ActionIcon, Select, Tooltip } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  AllDepreciationCategoriesDocument,
  DepreciationRecordRowFieldsFragmentDoc,
  UpdateDepreciationRecordInput,
} from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';
import { MakeBoolean, relevantDataPicker, TIMELESS_DATE_REGEX } from '../../../helpers/index.js';
import { useUpdateDepreciationRecord } from '../../../hooks/use-update-depreciation-record.js';
import { CurrencyInput } from '../index.js';
import { DeleteDepreciationRecord } from './delete-depreciation-record.js';
import { depreciationTypes } from './index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment DepreciationRecordRowFields on DepreciationRecord {
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
  data: FragmentType<typeof DepreciationRecordRowFieldsFragmentDoc>;
  onChange?: () => void;
}

export const DepreciationRow = ({ data, onChange }: Props): ReactElement => {
  const depreciationRecord = getFragmentData(DepreciationRecordRowFieldsFragmentDoc, data);
  console.log('depreciationRecord', depreciationRecord);
  const [isEditMode, setIsEditMode] = useState(false);

  const [{ data: categoriesData, fetching: fetchingCategories }, fetchCategories] = useQuery({
    query: AllDepreciationCategoriesDocument,
    pause: true,
  });

  const {
    control,
    handleSubmit,
    formState: { dirtyFields },
  } = useForm<UpdateDepreciationRecordInput>({
    defaultValues: {
      id: depreciationRecord.id,
    },
  });

  const { updateDepreciationRecord, fetching: updatingInProcess } = useUpdateDepreciationRecord();

  const onSubmit: SubmitHandler<UpdateDepreciationRecordInput> = data => {
    const dataToUpdate = relevantDataPicker(data, dirtyFields as MakeBoolean<typeof data>);
    if (dataToUpdate && Object.keys(dataToUpdate).length > 0) {
      updateDepreciationRecord({
        fields: { ...data, id: depreciationRecord.id },
      }).then(() => {
        onChange?.();
        setIsEditMode(false);
      });
    }
  };

  const categories = categoriesData?.depreciationCategories.map(category => ({
    value: category.id,
    label: category.name,
  }));

  useEffect(() => {
    if (isEditMode && !categoriesData) fetchCategories();
  }, [isEditMode, categoriesData, fetchCategories]);

  return (
    <tr key={depreciationRecord.id}>
      <td>
        <form id={`form ${depreciationRecord.id}`} onSubmit={handleSubmit(onSubmit)}>
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
                        depreciationRecord.amount?.raw ?? depreciationRecord.charge.totalAmount?.raw
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
                          depreciationRecord.amount?.currency ??
                          depreciationRecord.charge.totalAmount?.currency,
                      }}
                    />
                  )}
                />
              )}
            />
          ) : (
            <div>
              {depreciationRecord.amount?.formatted ??
                depreciationRecord.charge.totalAmount?.formatted}
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
              defaultValue={depreciationRecord.activationDate}
              rules={{
                pattern: {
                  value: TIMELESS_DATE_REGEX,
                  message: 'Date must be im format yyyy-mm-dd',
                },
              }}
              render={({ field: { value, ...field }, fieldState }): ReactElement => {
                const date = value ? new Date(value) : undefined;
                return (
                  <DatePickerInput
                    {...field}
                    form={`form ${depreciationRecord.id}`}
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
                    error={fieldState.error?.message}
                    popoverProps={{ withinPortal: true }}
                  />
                );
              }}
            />
          ) : (
            <div>{format(new Date(depreciationRecord.activationDate), 'dd/MM/yy')}</div>
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
                form={`form ${depreciationRecord.id}`}
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
            {depreciationRecord.category.name} ({depreciationRecord.category.percentage}%)
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
                form={`form ${depreciationRecord.id}`}
                data={depreciationTypes}
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
          <div>{depreciationRecord.type}</div>
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
              form={`form ${depreciationRecord.id}`}
              variant="default"
              size={30}
            >
              <Check size={20} color="green" />
            </ActionIcon>
          </Tooltip>
        )}

        <DeleteDepreciationRecord
          depreciationRecordId={depreciationRecord.id}
          onDelete={onChange}
        />
      </td>
    </tr>
  );
};
