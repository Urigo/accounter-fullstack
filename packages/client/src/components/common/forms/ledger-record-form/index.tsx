import { useContext, useId, useMemo, useRef, type FormEvent, type ReactElement } from 'react';
import { useForm, useFormContext, type FieldError } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Currency, LedgerRecordOperation } from '../../../../gql/graphql.js';
import type { TimelessDateString } from '../../../../helpers/dates.js';
import { useGetFinancialEntities } from '../../../../hooks/use-get-financial-entities.js';
import { usePortalContainer } from '../../../../providers/portal-container.js';
import { UserContext } from '../../../../providers/user-provider.js';
import { Button } from '../../../ui/button.js';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../../../ui/form.js';
import { Input } from '../../../ui/input.js';
import { Label } from '../../../ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select.js';
import { Spinner } from '../../../ui/spinner.js';
import { ComboBox } from '../../inputs/combo-box.js';
import { DatePickerInput } from '../../inputs/date-picker-input.js';
import { NumberInput } from '../../inputs/number-input.js';
import {
  buildLedgerRecordFormSchema,
  isUnparsableDateText,
  LEDGER_BALANCE_ERROR_PATH,
  TIMELESS_DATE_FORMAT_MESSAGE,
  type LedgerRecordFormInput,
  type LedgerRecordFormMode,
  type LedgerRecordFormValues,
} from './schema.js';

type DateFieldName = 'invoiceDate' | 'valueDate';
const DATE_FIELDS: DateFieldName[] = ['invoiceDate', 'valueDate'];

const OPERATION_OPTIONS: Array<{ value: LedgerRecordOperation; label: string }> = [
  { value: LedgerRecordOperation.MiscExpense, label: 'Misc expense' },
  { value: LedgerRecordOperation.Document, label: 'Document' },
];

/** Placeholder value of the not-yet-supported operation; it is never selectable */
const TRANSACTION_OPERATION_PLACEHOLDER = 'TRANSACTION';

type LineProps = {
  side: 'debit' | 'credit';
  label: string;
  entities: Array<{ value: string; label: string }>;
  fetchingEntities: boolean;
};

function LedgerLineFields({ side, label, entities, fetchingEntities }: LineProps): ReactElement {
  const { control } = useFormContext<LedgerRecordFormInput>();
  const entityId = useId();
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 items-start">
      <Label htmlFor={entityId} className="sm:pt-2">
        {label}
      </Label>
      <FormField
        control={control}
        name={`${side}Entity1`}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <ComboBox
                {...field}
                id={entityId}
                data={entities}
                value={field.value ?? null}
                onChange={value => field.onChange(value ?? '')}
                disabled={fetchingEntities}
                placeholder={`${label} entity`}
                formPart
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={`${side}LocalAmount1`}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <NumberInput
                ref={field.ref}
                name={field.name}
                onBlur={field.onBlur}
                value={field.value ?? undefined}
                onChange={value => field.onChange(value ?? undefined)}
                aria-label={`${label} amount`}
                placeholder="Amount"
                hideControls
                decimalScale={2}
                min={0}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

type LedgerRecordFormProps = {
  mode: LedgerRecordFormMode;
  defaultValues?: LedgerRecordFormInput;
  submitting: boolean;
  onSubmit: (values: LedgerRecordFormValues) => void | Promise<void>;
};

/** Create or edit a manual ledger record: its dates, texts, and debit and credit lines. */
export function LedgerRecordForm({
  mode,
  defaultValues,
  submitting,
  onSubmit,
}: LedgerRecordFormProps): ReactElement {
  const { userContext } = useContext(UserContext);
  const localCurrency = (userContext?.context.defaultLocalCurrency || Currency.Ils) as Currency;
  const ledgerLock = userContext?.context.ledgerLock ?? null;

  const schema = useMemo(
    () => buildLedgerRecordFormSchema({ mode, localCurrency, ledgerLock }),
    [mode, localCurrency, ledgerLock],
  );

  const form = useForm<LedgerRecordFormInput, unknown, LedgerRecordFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { description: '', reference: '', ...defaultValues },
  });
  const { control, handleSubmit, formState, setError } = form;

  // Date fields whose input text the date picker can't parse. The picker keeps such text to itself,
  // so the form still holds the last valid date; submitting must not send that stale value.
  const unparsableDates = useRef<Set<DateFieldName>>(new Set());

  const { selectableFinancialEntities, fetching: fetchingEntities } = useGetFinancialEntities();
  const portalContainer = usePortalContainer();

  // The balance check is record-level, so its error sits on a path that is not a form field
  const balanceError = (formState.errors as Record<string, FieldError | undefined>)[
    LEDGER_BALANCE_ERROR_PATH
  ];

  function onDateInput(name: DateFieldName, text: string): void {
    if (isUnparsableDateText(text)) {
      unparsableDates.current.add(name);
    } else {
      unparsableDates.current.delete(name);
    }
  }

  async function onFormSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    // React bubbles events through portals: keep the submit from reaching any ancestor form
    event.stopPropagation();
    await handleSubmit(values => {
      if (unparsableDates.current.size > 0) {
        return;
      }
      return onSubmit(values);
    })(event);
    // Set after validation, which replaces the form's errors with the schema's own
    for (const name of DATE_FIELDS) {
      if (unparsableDates.current.has(name)) {
        setError(name, { type: 'format', message: TIMELESS_DATE_FORMAT_MESSAGE });
      }
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={event => void onFormSubmit(event)} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {mode === 'insert' && (
            <FormField
              control={control}
              name="operation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Operation</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select operation" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent container={portalContainer}>
                      {OPERATION_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                      <SelectItem value={TRANSACTION_OPERATION_PLACEHOLDER} disabled>
                        Transaction (coming soon)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="ledger-record-currency">Currency</Label>
            <Input id="ledger-record-currency" value={localCurrency} readOnly disabled />
          </div>
          <FormField
            control={control}
            name="invoiceDate"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>Invoice date</FormLabel>
                <FormControl>
                  <DatePickerInput
                    value={(field.value as TimelessDateString) || undefined}
                    onChange={date => {
                      if (date !== field.value) field.onChange(date ?? undefined);
                    }}
                    onInput={event => onDateInput('invoiceDate', event.currentTarget.value)}
                    aria-invalid={!!fieldState.error}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="valueDate"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>Value date</FormLabel>
                <FormControl>
                  <DatePickerInput
                    value={(field.value as TimelessDateString) || undefined}
                    onChange={date => {
                      if (date !== field.value) field.onChange(date ?? undefined);
                    }}
                    onInput={event => onDateInput('valueDate', event.currentTarget.value)}
                    aria-invalid={!!fieldState.error}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="reference"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reference</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <LedgerLineFields
            side="debit"
            label="Debit"
            entities={selectableFinancialEntities}
            fetchingEntities={fetchingEntities}
          />
          <LedgerLineFields
            side="credit"
            label="Credit"
            entities={selectableFinancialEntities}
            fetchingEntities={fetchingEntities}
          />
          {balanceError?.message && (
            <p role="alert" className="text-red-500 text-sm dark:text-red-900">
              {balanceError.message}
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={submitting}>
            {submitting && <Spinner />}
            {mode === 'insert' ? 'Add record' : 'Save'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
