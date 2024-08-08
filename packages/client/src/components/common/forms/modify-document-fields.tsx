import { ReactElement, useEffect, useState } from 'react';
import { Control, Controller, UseFormWatch } from 'react-hook-form';
import { useQuery } from 'urql';
import { Select } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import {
  AllFinancialEntitiesDocument,
  Currency,
  DocumentType,
  EditDocumentQuery,
  InsertDocumentInput,
  UpdateDocumentFieldsInput,
} from '../../../gql/graphql.js';
import { TIMELESS_DATE_REGEX } from '../../../helpers/consts.js';
import {
  isDocumentCreditInvoice,
  isDocumentInvoice,
  isDocumentInvoiceReceipt,
  isDocumentProforma,
  isDocumentReceipt,
} from '../../../helpers/documents.js';
import { CurrencyInput, SelectInput, TextInput } from '../index.js';

export interface ModifyDocumentFieldsProps {
  document?: EditDocumentQuery['documentById'];
  control: Control<UpdateDocumentFieldsInput | InsertDocumentInput, object>;
  watch: UseFormWatch<UpdateDocumentFieldsInput | InsertDocumentInput>;
  defaultCurrency?: Currency;
}

export const ModifyDocumentFields = ({
  document,
  control,
  watch,
  defaultCurrency,
}: ModifyDocumentFieldsProps): ReactElement => {
  const [showExtendedFields, setShowExtendedFields] = useState<boolean>(false);
  const [financialEntities, setFinancialEntities] = useState<
    Array<{ value: string; label: string }>
  >([]);

  const [
    {
      data: financialEntitiesData,
      fetching: fetchingFinancialEntities,
      error: financialEntitiesError,
    },
  ] = useQuery({
    query: AllFinancialEntitiesDocument,
  });

  const isDocumentProcessed =
    isDocumentInvoice(document) ||
    isDocumentReceipt(document) ||
    isDocumentInvoiceReceipt(document) ||
    isDocumentProforma(document) ||
    isDocumentCreditInvoice(document);

  const type = watch('documentType');

  // auto update vat currency according to amount currency
  useEffect(() => {
    setShowExtendedFields(
      !!type &&
        (type === DocumentType.Invoice ||
          type === DocumentType.Receipt ||
          type === DocumentType.InvoiceReceipt ||
          type === DocumentType.Proforma ||
          type === DocumentType.CreditInvoice),
    );
  }, [type]);

  useEffect(() => {
    if (financialEntitiesError) {
      showNotification({
        title: 'Error!',
        message: 'Oh no!, we have an error fetching financial entities! 🤥',
        color: 'red',
      });
    }
  }, [financialEntitiesError]);

  useEffect(() => {
    if (financialEntitiesData?.allFinancialEntities?.nodes.length) {
      setFinancialEntities(
        financialEntitiesData.allFinancialEntities.nodes
          .map(entity => ({
            value: entity.id,
            label: entity.name,
          }))
          .sort((a, b) => (a.label > b.label ? 1 : -1)),
      );
    }
  }, [financialEntitiesData, setFinancialEntities]);

  return (
    <>
      <Controller
        name="documentType"
        control={control}
        rules={{ required: 'Required' }}
        defaultValue={document?.documentType ?? DocumentType.Unprocessed}
        render={({ field, fieldState }): ReactElement => (
          <SelectInput
            {...field}
            selectionEnum={DocumentType}
            error={fieldState.error?.message}
            label="Type"
          />
        )}
      />
      {showExtendedFields && (
        <>
          <Controller
            name="date"
            control={control}
            defaultValue={isDocumentProcessed ? document?.date : undefined}
            rules={{
              pattern: {
                value: TIMELESS_DATE_REGEX,
                message: 'Date must be im format yyyy-mm-dd',
              },
            }}
            render={({ field, fieldState }): ReactElement => (
              <TextInput
                {...field}
                value={field.value ?? undefined}
                error={fieldState.error?.message}
                isDirty={fieldState.isDirty}
                label="Date"
              />
            )}
          />
          <Controller
            name="serialNumber"
            control={control}
            defaultValue={isDocumentProcessed ? document?.serialNumber : undefined}
            render={({ field, fieldState }): ReactElement => (
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
            name="debtorId"
            control={control}
            defaultValue={isDocumentProcessed ? document?.debtor?.id : undefined}
            render={({ field, fieldState }): ReactElement => (
              <Select
                {...field}
                data={financialEntities}
                value={field.value}
                disabled={fetchingFinancialEntities}
                label="Debtor"
                placeholder="Scroll to see all options"
                maxDropdownHeight={160}
                searchable
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            name="creditorId"
            control={control}
            defaultValue={isDocumentProcessed ? document?.creditor?.id : undefined}
            render={({ field, fieldState }): ReactElement => (
              <Select
                {...field}
                data={financialEntities}
                value={field.value}
                disabled={fetchingFinancialEntities}
                label="Creditor"
                placeholder="Scroll to see all options"
                maxDropdownHeight={160}
                searchable
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            name="vat.raw"
            control={control}
            defaultValue={isDocumentProcessed ? document?.vat?.raw : undefined}
            render={({ field: vatField, fieldState: vatFieldState }): ReactElement => (
              <Controller
                name="vat.currency"
                control={control}
                defaultValue={
                  isDocumentProcessed
                    ? (document?.amount?.currency ?? Currency.Ils)
                    : defaultCurrency
                }
                render={({
                  field: currencyCodeField,
                  fieldState: currencyCodeFieldState,
                }): ReactElement => (
                  <CurrencyInput
                    {...vatField}
                    error={vatFieldState.error?.message || currencyCodeFieldState.error?.message}
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
            defaultValue={isDocumentProcessed ? document?.amount?.raw : undefined}
            render={({ field: amountField, fieldState: amountFieldState }): ReactElement => (
              <Controller
                name="amount.currency"
                control={control}
                defaultValue={
                  isDocumentProcessed
                    ? (document?.amount?.currency ?? Currency.Ils)
                    : defaultCurrency
                }
                render={({
                  field: currencyCodeField,
                  fieldState: currencyCodeFieldState,
                }): ReactElement => (
                  <CurrencyInput
                    {...amountField}
                    error={amountFieldState.error?.message || currencyCodeFieldState.error?.message}
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
        render={({ field, fieldState }): ReactElement => (
          <TextInput
            {...field}
            value={field.value?.toString()}
            error={fieldState.error?.message}
            isDirty={fieldState.isDirty}
            label="Image URL"
          />
        )}
      />
      <Controller
        name="file"
        control={control}
        defaultValue={document?.file}
        render={({ field, fieldState }): ReactElement => (
          <div className="flex flex-row">
            <TextInput
              className="grow"
              {...field}
              value={field.value?.toString()}
              error={fieldState.error?.message}
              isDirty={fieldState.isDirty}
              label="File URL"
            />
          </div>
        )}
      />
    </>
  );
};
