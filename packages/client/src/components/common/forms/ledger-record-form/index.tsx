import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
} from 'react';
import { useForm, useWatch, type FieldError } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Currency, LedgerRecordOperation } from '../../../../gql/graphql.js';
import type { TimelessDateString } from '../../../../helpers/dates.js';
import { useGetFinancialEntities } from '../../../../hooks/use-get-financial-entities.js';
import { cn } from '../../../../lib/utils.js';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select.js';
import { Spinner } from '../../../ui/spinner.js';
import { CurrencyCodeInput } from '../../inputs/currency-input.js';
import { DatePickerInput } from '../../inputs/date-picker-input.js';
import { useLedgerFormLang } from './i18n.js';
import { LedgerSlotFields } from './ledger-slot-fields.js';
import {
  buildLedgerRecordFormSchema,
  computeLedgerTotals,
  FOREIGN_AMOUNT_FIELDS,
  isForeignCurrency,
  isUnparsableDateText,
  LEDGER_BALANCE_ERROR_PATH,
  ledgerSlotFieldNames,
  type LedgerRecordFormInput,
  type LedgerRecordFormMode,
  type LedgerRecordFormValues,
  type LedgerSlotSide,
} from './schema.js';

type DateFieldName = 'invoiceDate' | 'valueDate';
const DATE_FIELDS: DateFieldName[] = ['invoiceDate', 'valueDate'];

const OPERATIONS = [
  { value: LedgerRecordOperation.MiscExpense, labelKey: 'operationMiscExpense' },
  { value: LedgerRecordOperation.Document, labelKey: 'operationDocument' },
] as const;

/** Placeholder value of the not-yet-supported operation; it is never selectable */
const TRANSACTION_OPERATION_PLACEHOLDER = 'TRANSACTION';

const SLOT_SIDES: LedgerSlotSide[] = ['debit', 'credit'];

const TOTAL_FORMAT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatTotal(amount: number): string {
  // Rounded first so float noise never shows as "-0.00"
  return TOTAL_FORMAT.format(Math.round(amount * 100) / 100 || 0);
}

type LedgerRecordFormProps = {
  mode: LedgerRecordFormMode;
  defaultValues?: LedgerRecordFormInput;
  submitting: boolean;
  onSubmit: (values: LedgerRecordFormValues) => void | Promise<void>;
};

/**
 * Create or edit a manual ledger record: its dates, texts, and debit and credit lines. Its texts
 * and validation messages follow the language of the enclosing `LedgerFormLangProvider` (English
 * without one); the layout's direction comes from the dialog around it.
 */
export function LedgerRecordForm({
  mode,
  defaultValues,
  submitting,
  onSubmit,
}: LedgerRecordFormProps): ReactElement {
  const { userContext } = useContext(UserContext);
  const localCurrency = (userContext?.context.defaultLocalCurrency || Currency.Ils) as Currency;
  const ledgerLock = userContext?.context.ledgerLock ?? null;
  const { strings } = useLedgerFormLang();
  const { messages } = strings;

  const schema = useMemo(
    () => buildLedgerRecordFormSchema({ mode, localCurrency, ledgerLock, messages }),
    [mode, localCurrency, ledgerLock, messages],
  );

  const form = useForm<LedgerRecordFormInput, unknown, LedgerRecordFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currency: localCurrency, description: '', reference: '', ...defaultValues },
  });
  const { control, handleSubmit, formState, setError, setValue, clearErrors, trigger } = form;

  const currency = useWatch({ control, name: 'currency' });
  const showForeign = isForeignCurrency(currency, localCurrency);

  function onCurrencyChange(next: Currency): void {
    if (isForeignCurrency(next, localCurrency)) {
      return;
    }
    // Back in the local currency the foreign inputs disappear: drop their values (and any errors
    // on them) so nothing stale stays in the form. The mapper never sends them either. `null`, not
    // `undefined`, so the inputs don't re-mount with their default values in a foreign currency.
    for (const field of FOREIGN_AMOUNT_FIELDS) {
      setValue(field, null, { shouldDirty: true });
    }
    clearErrors([...FOREIGN_AMOUNT_FIELDS]);
  }

  // Bumped when a secondary line is cleared, to re-mount its amount inputs: an amount input keeps
  // showing its last number when its field is emptied from outside
  const [clearedSlots, setClearedSlots] = useState<Record<LedgerSlotSide, number>>({
    debit: 0,
    credit: 0,
  });

  function clearSecondarySlot(side: LedgerSlotSide): void {
    const { entity, localAmount, foreignAmount } = ledgerSlotFieldNames(side, 2);
    for (const field of [entity, localAmount, foreignAmount]) {
      setValue(field, null, { shouldDirty: true });
    }
    clearErrors([entity, localAmount, foreignAmount]);
    setClearedSlots(previous => ({ ...previous, [side]: previous[side] + 1 }));
  }

  const [debitLocalAmount1, creditLocalAmount1, debitLocalAmount2, creditLocalAmount2] = useWatch({
    control,
    name: ['debitLocalAmount1', 'creditLocalAmount1', 'debitLocalAmount2', 'creditLocalAmount2'],
  });
  const totals = computeLedgerTotals({
    debitLocalAmount1,
    creditLocalAmount1,
    debitLocalAmount2,
    creditLocalAmount2,
  });

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

  /** Flag the dates whose text can't be parsed; call after validation, which replaces errors */
  function setUnparsableDateErrors(): void {
    for (const name of DATE_FIELDS) {
      if (unparsableDates.current.has(name)) {
        setError(name, { type: 'format', message: messages.dateFormat });
      }
    }
  }

  // Once errors are showing, re-validate in a newly picked language so they are translated too
  const shownMessages = useRef(messages);
  useEffect(() => {
    if (shownMessages.current === messages) {
      return;
    }
    shownMessages.current = messages;
    if (formState.isSubmitted) {
      void trigger().then(setUnparsableDateErrors);
    }
    // Only a language change re-validates; the other values are read at that moment
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

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
    setUnparsableDateErrors();
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
                  <FormLabel>{strings.operation}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={strings.selectOperation} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent container={portalContainer}>
                      {OPERATIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {strings[option.labelKey]}
                        </SelectItem>
                      ))}
                      <SelectItem value={TRANSACTION_OPERATION_PLACEHOLDER} disabled>
                        {strings.operationTransactionComingSoon}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <FormField
            control={control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{strings.currency}</FormLabel>
                <FormControl>
                  <CurrencyCodeInput
                    name={field.name}
                    value={field.value ?? ''}
                    onChange={value => {
                      const next = value as Currency;
                      field.onChange(next);
                      onCurrencyChange(next);
                    }}
                    // Labelled here, so no label-row margin; as wide as the other inputs
                    className="mt-0"
                    triggerClassName="w-full"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="invoiceDate"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>{strings.invoiceDate}</FormLabel>
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
                <FormLabel>{strings.valueDate}</FormLabel>
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
                <FormLabel>{strings.description}</FormLabel>
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
                <FormLabel>{strings.reference}</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          {SLOT_SIDES.map(side => (
            <LedgerSlotFields
              key={`${side}-1`}
              side={side}
              index={1}
              showForeign={showForeign}
              currency={currency}
              required
              entities={selectableFinancialEntities}
              fetchingEntities={fetchingEntities}
            />
          ))}
          {SLOT_SIDES.map(side => (
            <LedgerSlotFields
              key={`${side}-2`}
              clearCount={clearedSlots[side]}
              side={side}
              index={2}
              showForeign={showForeign}
              currency={currency}
              required={false}
              entities={selectableFinancialEntities}
              fetchingEntities={fetchingEntities}
              onClear={() => clearSecondarySlot(side)}
            />
          ))}
        </div>

        <div data-testid="ledger-totals" className="flex flex-col gap-1 border-t pt-2 text-sm">
          <dl className="flex flex-wrap justify-end gap-x-6 gap-y-1">
            <div className="flex gap-2">
              <dt className="text-muted-foreground">{strings.debitTotal}</dt>
              <dd className="tabular-nums">{formatTotal(totals.debit)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">{strings.creditTotal}</dt>
              <dd className="tabular-nums">{formatTotal(totals.credit)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">{strings.difference}</dt>
              <dd
                data-testid="ledger-difference"
                className={cn('tabular-nums', !totals.balanced && 'font-medium text-destructive')}
              >
                {formatTotal(totals.difference)}
              </dd>
            </div>
          </dl>
          {/* The error is set on submit and not re-checked as amounts change: it is hidden once
              they balance, and its text leaves the numbers to the live totals above */}
          {balanceError && !totals.balanced && (
            <p role="alert" className="text-end text-destructive">
              {strings.balanceError}
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={submitting}>
            {submitting && <Spinner />}
            {mode === 'insert' ? strings.addRecord : strings.save}
          </Button>
        </div>
      </form>
    </Form>
  );
}
