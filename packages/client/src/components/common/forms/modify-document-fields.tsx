import { ReactElement, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Controller, UseFormReturn } from 'react-hook-form';
import { DatePickerInput, MonthPickerInput } from '@mantine/dates';
import {
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
import { useGetFinancialEntities } from '../../../hooks/use-get-financial-entities.js';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form.js';
import { Input } from '../../ui/input.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select.js';
import { ComboBox, CurrencyInput, NumberInput } from '../index.js';

export interface ModifyDocumentFieldsProps {
  formManager: UseFormReturn<
    UpdateDocumentFieldsInput | InsertDocumentInput,
    unknown,
    UpdateDocumentFieldsInput | InsertDocumentInput
  >;
  document?: EditDocumentQuery['documentById'];
  defaultCurrency?: Currency;
}

export const ModifyDocumentFields = ({
  formManager,
  document,
  defaultCurrency,
}: ModifyDocumentFieldsProps): ReactElement => {
  const { control, watch, trigger } = formManager;
  const [showExtendedFields, setShowExtendedFields] = useState<boolean>(false);

  const { selectableFinancialEntities: financialEntities, fetching: fetchingFinancialEntities } =
    useGetFinancialEntities();

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

  return (
    <>
      <FormField
        name="documentType"
        control={control}
        rules={{ required: 'Required' }}
        defaultValue={document?.documentType ?? DocumentType.Unprocessed}
        render={({ field }): ReactElement => (
          <FormItem>
            <FormLabel>Type</FormLabel>
            <Select onValueChange={field.onChange} value={field.value ?? undefined}>
              <FormControl>
                <SelectTrigger className="w-full truncate">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
              </FormControl>
              <SelectContent onClick={event => event.stopPropagation()}>
                {Object.entries(DocumentType).map(([label, value]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
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
              <DatePickerInput
                {...field}
                onChange={(date?: Date | string | null): void => {
                  const newDate = date
                    ? typeof date === 'string'
                      ? date
                      : format(date, 'yyyy-MM-dd')
                    : undefined;
                  if (newDate !== field.value) field.onChange(newDate);
                }}
                value={field.value ? new Date(field.value) : undefined}
                error={fieldState.error?.message}
                label="Date"
                popoverProps={{ withinPortal: true }}
              />
            )}
          />

          <FormField
            name="serialNumber"
            control={control}
            defaultValue={isDocumentProcessed ? document?.serialNumber : undefined}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Serial Number</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={!field || field.value === 'Missing' ? '' : field.value!}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="allocationNumber"
            control={control}
            defaultValue={isDocumentProcessed ? document?.allocationNumber : undefined}
            rules={{
              pattern: {
                value: /^\d{9}$/,
                message: 'Allocation number must be 9 characters long',
              },
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Allocation Number</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? undefined} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="debtorId"
            control={control}
            defaultValue={isDocumentProcessed ? document?.debtor?.id : undefined}
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Debtor</FormLabel>
                <ComboBox
                  {...field}
                  data={financialEntities}
                  value={field.value ?? undefined}
                  disabled={fetchingFinancialEntities}
                  placeholder="Scroll to see all options"
                  formPart
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="creditorId"
            control={control}
            defaultValue={isDocumentProcessed ? document?.creditor?.id : undefined}
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Creditor</FormLabel>
                <ComboBox
                  {...field}
                  data={financialEntities}
                  value={field.value ?? undefined}
                  disabled={fetchingFinancialEntities}
                  placeholder="Scroll to see all options"
                  formPart
                />
                <FormMessage />
              </FormItem>
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
          <Controller
            name="vatReportDateOverride"
            control={control}
            defaultValue={isDocumentProcessed ? document?.vatReportDateOverride : undefined}
            rules={{
              pattern: {
                value: TIMELESS_DATE_REGEX,
                message: 'Date must be im format yyyy-mm-dd',
              },
            }}
            render={({ field, fieldState }): ReactElement => (
              <MonthPickerInput
                {...field}
                label="VAT report date"
                value={field.value ? new Date(field.value) : undefined}
                onChange={date => {
                  trigger('vatReportDateOverride');
                  field.onChange(date ? `${format(date, 'yyyy-MM')}-15` : undefined);
                }}
                error={fieldState.error?.message}
                popoverProps={{ withinPortal: true }}
              />
            )}
          />
          <Controller
            name="noVatAmount"
            control={control}
            defaultValue={isDocumentProcessed ? (document?.noVatAmount ?? undefined) : undefined}
            render={({ field: noVatField, fieldState: noVatFieldState }): ReactElement => (
              <Controller
                name="amount.currency"
                control={control}
                defaultValue={
                  isDocumentProcessed
                    ? (document?.amount?.currency ?? Currency.Ils)
                    : defaultCurrency
                }
                render={({ field: currencyCodeField }): ReactElement => (
                  <CurrencyInput
                    {...noVatField}
                    value={noVatField.value ?? undefined}
                    error={noVatFieldState.error?.message}
                    label="no VAT amount"
                    currencyCodeProps={{ ...currencyCodeField, label: 'Currency', disabled: true }}
                  />
                )}
              />
            )}
          />
        </>
      )}

      <FormField
        name="image"
        control={control}
        defaultValue={document?.image}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Image URL</FormLabel>
            <FormControl>
              <Input {...field} value={field.value?.toString()} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        name="file"
        control={control}
        defaultValue={document?.file}
        render={({ field }) => (
          <div className="flex flex-row">
            <FormItem>
              <FormLabel>File URL</FormLabel>
              <FormControl>
                <Input className="grow" {...field} value={field.value?.toString()} />
              </FormControl>
              <FormMessage />
            </FormItem>
          </div>
        )}
      />

      <FormField
        name="exchangeRateOverride"
        control={control}
        defaultValue={isDocumentProcessed ? document?.exchangeRateOverride : undefined}
        render={({ field }): ReactElement => (
          <FormItem>
            <FormLabel>
              Exchange Rate Override
              <span className="text-xs text-muted-foreground">
                {`(${
                  isDocumentProcessed
                    ? (document?.amount?.currency ?? Currency.Ils)
                    : defaultCurrency
                } => ${Currency.Ils})`}
              </span>
            </FormLabel>
            <FormControl>
              <NumberInput
                onValueChange={value => field.onChange(Number(value))}
                value={field.value ?? undefined}
                hideControls
                decimalScale={5}
                thousandSeparator=","
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
};
