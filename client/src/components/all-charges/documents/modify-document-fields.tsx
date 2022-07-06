import { ActionIcon } from '@mantine/core';
import { Control, Controller } from 'react-hook-form';
import { File } from 'tabler-icons-react';

import {
  Currency,
  DocumentType,
  EditDocumentFieldsFragment,
  InsertDocumentInput,
  UpdateDocumentFieldsInput,
} from '../../../__generated__/types';
import { TIMELESS_DATE_REGEX } from '../../../helpers/consts';
import {
  isDocumentInvoice,
  isDocumentInvoiceReceipt,
  isDocumentProforma,
  isDocumentReceipt,
} from '../../../helpers/documents';
import { CurrencyInput, SelectInput, TextInput } from '../../common/inputs';
export interface Props {
  document?: EditDocumentFieldsFragment;
  control: Control<UpdateDocumentFieldsInput | InsertDocumentInput, object>;
}

export const ModifyDocumentFields = ({ document, control }: Props) => {
  const isDocumentProcessed =
    isDocumentInvoice(document) ||
    isDocumentReceipt(document) ||
    isDocumentInvoiceReceipt(document) ||
    isDocumentProforma(document) ||
    !document;

  return (
    <>
      <Controller
        name="documentType"
        control={control}
        rules={{ required: 'Required' }}
        defaultValue={DocumentType.Unprocessed}
        render={({ field, fieldState }) => (
          <SelectInput {...field} selectionEnum={DocumentType} error={fieldState.error?.message} label="Type" />
        )}
      />
      {isDocumentProcessed && (
        <>
          <Controller
            name="date"
            control={control}
            defaultValue={document?.date}
            rules={{
              pattern: {
                value: TIMELESS_DATE_REGEX,
                message: 'Date must be im format yyyy-mm-dd',
              },
            }}
            render={({ field, fieldState }) => (
              <TextInput {...field} error={fieldState.error?.message} isDirty={fieldState.isDirty} label="Date" />
            )}
          />
          <Controller
            name="serialNumber"
            control={control}
            defaultValue={document?.serialNumber}
            render={({ field, fieldState }) => (
              <TextInput
                {...field}
                value={!field || field.value === 'Missing' ? '' : field.value!}
                error={fieldState.error?.message}
                isDirty={fieldState.isDirty}
                label="Serial Number"
              />
            )}
          />
          <Controller
            name="vat.raw"
            control={control}
            defaultValue={document?.vat?.raw}
            render={({ field: vatField, fieldState: vatFieldState }) => (
              <Controller
                name="vat.currency"
                control={control}
                defaultValue={document?.amount?.currency ?? Currency.Ils}
                render={({ field: currencyCodeField, fieldState: currencyCodeFieldState }) => (
                  <CurrencyInput
                    // className="w-full bg-gray-100 rounded border bg-opacity-50 border-gray-300 focus:ring-2 focus:ring-indigo-200 focus:bg-transparent focus:border-indigo-500 text-base outline-none text-gray-700 py-1 px-3 leading-8 transition-colors duration-200 ease-in-out"
                    {...vatField}
                    error={vatFieldState.error?.message || currencyCodeFieldState.error?.message}
                    isDirty={vatFieldState.isDirty || currencyCodeFieldState.isDirty}
                    label="VAT"
                    currencyCodeProps={{ ...currencyCodeField, label: 'Currency', disabled: true }}
                  />
                )}
              />
            )}
          />
          <Controller
            name="amount.raw"
            control={control}
            defaultValue={document?.amount?.raw}
            render={({ field: amountField, fieldState: amountFieldState }) => (
              <Controller
                name="amount.currency"
                control={control}
                defaultValue={document?.amount?.currency}
                render={({ field: currencyCodeField, fieldState: currencyCodeFieldState }) => (
                  <CurrencyInput
                    // className="w-full bg-gray-100 rounded border bg-opacity-50 border-gray-300 focus:ring-2 focus:ring-indigo-200 focus:bg-transparent focus:border-indigo-500 text-base outline-none text-gray-700 py-1 px-3 leading-8 transition-colors duration-200 ease-in-out"
                    {...amountField}
                    error={amountFieldState.error?.message || currencyCodeFieldState.error?.message}
                    isDirty={amountFieldState.isDirty || currencyCodeFieldState.isDirty}
                    label="Amount"
                    currencyCodeProps={{ ...currencyCodeField, label: 'Currency' }}
                  />
                )}
              />
            )}
          />
        </>
      )}
      <Controller
        name="image"
        control={control}
        defaultValue={document?.image}
        render={({ field, fieldState }) => (
          <TextInput {...field} error={fieldState.error?.message} isDirty={fieldState.isDirty} label="Image URL" />
        )}
      />
      <Controller
        name="file"
        control={control}
        defaultValue={document?.file}
        render={({ field, fieldState }) => (
          <div className="flex flex-row gap-1 w-full">
            <TextInput
              className="grow"
              {...field}
              error={fieldState.error?.message}
              isDirty={fieldState.isDirty}
              label="File URL"
            />
            <ActionIcon variant="hover">
              <a rel="noreferrer" target="_blank" href={field.value} type="button">
                <File size={20} />
              </a>
            </ActionIcon>
          </div>
        )}
      />
    </>
  );
};
