import { ReactElement, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { Plus } from 'tabler-icons-react';
import { useQuery } from 'urql';
import { Loader, Modal, Overlay, Select, Tooltip } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import {
  AllDepreciationCategoriesDocument,
  InsertDepreciationRecordInput,
} from '../../../gql/graphql.js';
import { TIMELESS_DATE_REGEX } from '../../../helpers/index.js';
import { useAddDepreciationRecord } from '../../../hooks/use-add-depreciation-record.js';
import { Button } from '../../ui/button.js';
import { CurrencyInput } from '../index.js';
import { depreciationTypes } from './index.js';

export function AddDepreciationRecord(props: {
  chargeId: string;
  onAdd?: () => void;
}): ReactElement {
  const { chargeId, onAdd } = props;
  const [opened, { close, open }] = useDisclosure(false);

  return (
    <>
      <Tooltip label="Add Depreciation Record">
        <Button
          variant="outline"
          size="icon"
          className="size-7.5"
          onClick={(event: React.MouseEvent<HTMLAnchorElement, MouseEvent>): void => {
            event.stopPropagation();
            open();
          }}
        >
          <Plus className="size-5" />
        </Button>
      </Tooltip>
      {opened && <ModalContent chargeId={chargeId} opened={opened} close={close} onAdd={onAdd} />}
    </>
  );
}

type ModalProps = {
  opened: boolean;
  close: () => void;
  onAdd?: () => void;
  chargeId: string;
};

function ModalContent({ chargeId, opened, close, onAdd }: ModalProps): ReactElement {
  const { control, handleSubmit } = useForm<InsertDepreciationRecordInput>({
    defaultValues: { chargeId },
  });
  const [fetching, setFetching] = useState(false);

  const [{ data, fetching: fetchingCategories }] = useQuery({
    query: AllDepreciationCategoriesDocument,
  });

  const { addDepreciationRecord, fetching: addingInProcess } = useAddDepreciationRecord();

  const onSubmit: SubmitHandler<InsertDepreciationRecordInput> = data => {
    addDepreciationRecord({ fields: data }).then(() => {
      onAdd?.();
      close();
    });
  };

  const categories =
    data?.depreciationCategories?.map(category => ({
      value: category.id,
      label: category.name,
    })) ?? [];

  useEffect(() => {
    if (fetchingCategories || addingInProcess) setFetching(true);
    else setFetching(false);
  }, [fetchingCategories, addingInProcess]);

  return (
    <Modal opened={opened} onClose={close} centered lockScroll>
      <Modal.Title>Add Depreciation Record</Modal.Title>
      <Modal.Body>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Controller
            name="activationDate"
            control={control}
            rules={{
              pattern: {
                value: TIMELESS_DATE_REGEX,
                message: 'Date must be im format yyyy-mm-dd',
              },
            }}
            render={({ field: { value, ...field } }): ReactElement => {
              const date = value ? new Date(value) : undefined;
              return (
                <DatePickerInput
                  {...field}
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
                  popoverProps={{ withinPortal: true }}
                />
              );
            }}
          />
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
                    value={amountField.value ?? undefined}
                    error={amountFieldState.error?.message || currencyCodeFieldState.error?.message}
                    label="Amount"
                    currencyCodeProps={{ ...currencyCodeField, label: 'Currency' }}
                  />
                )}
              />
            )}
          />
          <Controller
            name="categoryId"
            control={control}
            render={({ field, fieldState }): ReactElement => (
              <Select
                {...field}
                disabled={fetchingCategories}
                data={categories}
                label="Category"
                placeholder="Scroll to see all options"
                maxDropdownHeight={160}
                searchable
                error={fieldState.error?.message}
                withinPortal
              />
            )}
          />
          <Controller
            name="type"
            control={control}
            render={({ field, fieldState }): ReactElement => (
              <Select
                {...field}
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
