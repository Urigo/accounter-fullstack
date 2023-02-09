import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  Control,
  Controller,
  UseFormSetValue,
  UseFormUnregister,
  UseFormWatch,
} from 'react-hook-form';
import { Currency, InsertDbLedgerRecordInput } from '../../../../gql/graphql';
import { TIMELESS_DATE_REGEX } from '../../../../helpers/consts';
import { CurrencyCodeInput, CurrencyInput, NumberInput, TextInput } from '../..';

type Props = {
  control: Control<InsertDbLedgerRecordInput, unknown>;
  watch: UseFormWatch<InsertDbLedgerRecordInput>;
  unregister: UseFormUnregister<InsertDbLedgerRecordInput>;
  setValue: UseFormSetValue<InsertDbLedgerRecordInput>;
};

export const InsertDbLedgerRecordFields = ({ control, watch, setValue, unregister }: Props) => {
  const [currency, setCurrency] = useState<Currency>(Currency.Ils);
  const [isCredit1, setIsCredit1] = useState(false);
  const [isCredit2, setIsCredit2] = useState(false);
  const [isDebit1, setIsDebit1] = useState(false);
  const [isDebit2, setIsDebit2] = useState(false);

  const [
    formCurrency,
    formCreditAccount1,
    formCreditAccount2,
    formDebitAccount1,
    formDebitAccount2,
  ] = watch([
    'currency',
    'credit_account_1',
    'credit_account_2',
    'debit_account_1',
    'debit_account_2',
  ]);

  function isAccountActive(account?: string | null) {
    return !!(account);
  }

  // add amount fields to credit/debit account only when name exists
  useEffect(() => {
    const isActive = isAccountActive(formCreditAccount1);
    !isActive && setValue('credit_account_1', undefined);
    setIsCredit1(isActive);
    if (!isActive) {
      setValue('credit_account_1', undefined);
      setValue('credit_amount_1', undefined);
      setValue('foreign_credit_amount_1', undefined);
      unregister(['credit_amount_1', 'foreign_credit_amount_1']);
    }
  }, [formCreditAccount1, setValue, unregister]);
  useEffect(() => {
    const isActive = isAccountActive(formCreditAccount2);
    !isActive && setValue('credit_account_2', undefined);
    setIsCredit2(isActive);
    if (!isActive) {
      setValue('credit_account_2', undefined);
      setValue('credit_amount_2', undefined);
      setValue('foreign_credit_amount_2', undefined);
      unregister(['credit_amount_2', 'foreign_credit_amount_2']);
    }
  }, [formCreditAccount2, setValue, unregister]);
  useEffect(() => {
    const isActive = isAccountActive(formDebitAccount1);
    !isActive && setValue('debit_account_1', undefined);
    setIsDebit1(isActive);
    if (!isActive) {
      setValue('debit_account_1', undefined);
      setValue('debit_amount_1', undefined);
      setValue('foreign_debit_amount_1', undefined);
      unregister(['debit_amount_1', 'foreign_debit_amount_1']);
    }
  }, [formDebitAccount1, setValue, unregister]);
  useEffect(() => {
    const isActive = isAccountActive(formDebitAccount2);
    setIsDebit2(isActive);
    if (!isActive) {
      setValue('debit_account_2', undefined);
      setValue('debit_amount_2', undefined);
      setValue('foreign_debit_amount_2', undefined);
      unregister(['debit_amount_2', 'foreign_debit_amount_2']);
    }
  }, [formDebitAccount2, setValue, unregister]);

  useEffect(() => {
    setCurrency(formCurrency ?? Currency.Ils);
    if (!formCurrency || formCurrency === Currency.Ils) {
      setValue('foreign_credit_amount_1', undefined);
      setValue('foreign_credit_amount_2', undefined);
      setValue('foreign_debit_amount_1', undefined);
      setValue('foreign_debit_amount_2', undefined);
      unregister([
        'foreign_credit_amount_1',
        'foreign_credit_amount_2',
        'foreign_debit_amount_1',
        'foreign_debit_amount_2',
      ]);
    }
  }, [formCurrency, setValue, unregister]);

  return (
    <>
      <Controller
        name="currency"
        control={control}
        defaultValue={Currency.Ils}
        rules={{ required: 'Required' }}
        render={({ field, fieldState }) => (
          <CurrencyCodeInput
            {...field}
            value={field.value ?? Currency.Ils}
            error={fieldState.error?.message}
            label="Currency"
          />
        )}
      />

      <Controller
        name="credit_account_1"
        control={control}
        render={({ field, fieldState }) => (
          <TextInput
            {...field}
            value={field.value ?? ''}
            error={fieldState.error?.message}
            label="Credit Account 1"
          />
        )}
      />
      {isCredit1 && (
        <Controller
          name="credit_amount_1"
          shouldUnregister={!isCredit1}
          defaultValue={undefined}
          control={control}
          render={({ field: amountField, fieldState: amountFieldState }) => (
            <CurrencyInput
              {...amountField}
              value={amountField.value ?? undefined}
              error={amountFieldState.error?.message}
              label="Credit Amount 1"
              currencyCodeProps={{
                value: Currency.Ils,
                label: 'Currency',
                disabled: true,
              }}
            />
          )}
        />
      )}
      {isCredit1 && currency && currency !== Currency.Ils && (
        <Controller
          name="foreign_credit_amount_1"
          shouldUnregister={!(isCredit1 && formCurrency === Currency.Ils)}
          control={control}
          render={({ field: amountField, fieldState: amountFieldState }) => (
            <CurrencyInput
              {...amountField}
              value={amountField.value ?? undefined}
              error={amountFieldState.error?.message}
              label="Foreign Credit Amount 1"
              currencyCodeProps={{
                value: currency,
                label: 'Currency',
                disabled: true,
              }}
            />
          )}
        />
      )}

      <Controller
        name="credit_account_2"
        control={control}
        render={({ field, fieldState }) => (
          <TextInput
            {...field}
            value={field.value ?? undefined}
            error={fieldState.error?.message}
            label="Credit Account 2"
          />
        )}
      />
      {isCredit2 && (
        <>
          <Controller
            name="credit_amount_2"
            shouldUnregister={!isCredit2}
            control={control}
            render={({ field: amountField, fieldState: amountFieldState }) => (
              <CurrencyInput
                {...amountField}
                value={amountField.value ?? undefined}
                error={amountFieldState.error?.message}
                label="Credit Amount 2"
                currencyCodeProps={{
                  value: Currency.Ils,
                  label: 'Currency',
                  disabled: true,
                }}
              />
            )}
          />
          {currency && currency !== Currency.Ils && (
            <Controller
              name="foreign_credit_amount_2"
              shouldUnregister={!(isCredit2 && formCurrency === Currency.Ils)}
              control={control}
              render={({ field: amountField, fieldState: amountFieldState }) => (
                <CurrencyInput
                  {...amountField}
                  value={amountField.value ?? undefined}
                  error={amountFieldState.error?.message}
                  label="Foreign Credit Amount 2"
                  currencyCodeProps={{
                    value: currency,
                    label: 'Currency',
                    disabled: true,
                  }}
                />
              )}
            />
          )}
        </>
      )}

      <Controller
        name="debit_account_1"
        control={control}
        render={({ field, fieldState }) => (
          <TextInput
            {...field}
            value={field.value ?? undefined}
            error={fieldState.error?.message}
            label="Debit Account 1"
          />
        )}
      />
      {isDebit1 && (
        <>
          <Controller
            name="debit_amount_1"
            shouldUnregister={!isDebit1}
            control={control}
            render={({ field: amountField, fieldState: amountFieldState }) => (
              <CurrencyInput
                {...amountField}
                value={amountField.value ?? undefined}
                error={amountFieldState.error?.message}
                label="Debit Amount 1"
                currencyCodeProps={{
                  value: Currency.Ils,
                  label: 'Currency',
                  disabled: true,
                }}
              />
            )}
          />
          {currency && currency !== Currency.Ils && (
            <Controller
              name="foreign_debit_amount_1"
              shouldUnregister={!(isDebit1 && formCurrency === Currency.Ils)}
              control={control}
              render={({ field: amountField, fieldState: amountFieldState }) => (
                <CurrencyInput
                  {...amountField}
                  value={amountField.value ?? undefined}
                  error={amountFieldState.error?.message}
                  label="Foreign Debit Amount 1"
                  currencyCodeProps={{
                    value: currency,
                    label: 'Currency',
                    disabled: true,
                  }}
                />
              )}
            />
          )}
        </>
      )}

      <Controller
        name="debit_account_2"
        control={control}
        render={({ field, fieldState }) => (
          <TextInput
            {...field}
            value={field.value ?? undefined}
            error={fieldState.error?.message}
            label="Debit Account 2"
          />
        )}
      />
      {isDebit2 && (
        <>
          <Controller
            name="debit_amount_2"
            shouldUnregister={!isDebit2}
            control={control}
            render={({ field: amountField, fieldState: amountFieldState }) => (
              <CurrencyInput
                {...amountField}
                value={amountField.value ?? undefined}
                error={amountFieldState.error?.message}
                label="Debit Amount 2"
                currencyCodeProps={{
                  value: Currency.Ils,
                  label: 'Currency',
                  disabled: true,
                }}
              />
            )}
          />
          {currency && currency !== Currency.Ils && (
            <Controller
              name="foreign_debit_amount_2"
              shouldUnregister={!(isDebit2 && formCurrency === Currency.Ils)}
              control={control}
              render={({ field: amountField, fieldState: amountFieldState }) => (
                <CurrencyInput
                  {...amountField}
                  value={amountField.value ?? undefined}
                  error={amountFieldState.error?.message}
                  label="Foreign Debit Amount 2"
                  currencyCodeProps={{
                    value: currency,
                    label: 'Currency',
                    disabled: true,
                  }}
                />
              )}
            />
          )}
        </>
      )}

      <Controller
        name="details"
        control={control}
        render={({ field, fieldState }) => (
          <TextInput
            {...field}
            value={field.value ?? undefined}
            error={fieldState.error?.message}
            label="Details"
          />
        )}
      />

      <Controller
        name="reference_1"
        control={control}
        render={({ field, fieldState }) => (
          <TextInput
            {...field}
            value={field.value ?? undefined}
            error={fieldState.error?.message}
            label="Reference 1"
          />
        )}
      />

      <Controller
        name="reference_2"
        control={control}
        render={({ field, fieldState }) => (
          <TextInput
            {...field}
            value={field.value ?? undefined}
            error={fieldState.error?.message}
            label="Reference 2"
          />
        )}
      />

      <Controller
        name="invoice_date"
        control={control}
        rules={{
          required: 'Required',
          pattern: {
            value: TIMELESS_DATE_REGEX,
            message: 'Date must be im format yyyy-mm-dd',
          },
          validate: value => {
            try {
              format(new Date(value), 'yyyy-MM-dd');
              return;
            } catch {
              return 'Invalid date input';
            }
          },
        }}
        render={({ field, fieldState }) => (
          <TextInput {...field} error={fieldState.error?.message} label="Invoice Date" />
        )}
      />

      <Controller
        name="value_date"
        control={control}
        rules={{
          required: 'Required',
          pattern: {
            value: TIMELESS_DATE_REGEX,
            message: 'Date must be im format yyyy-mm-dd',
          },
          validate: value => {
            try {
              format(new Date(value), 'yyyy-MM-dd');
              return;
            } catch {
              return 'Invalid date input';
            }
          },
        }}
        render={({ field, fieldState }) => (
          <TextInput {...field} error={fieldState.error?.message} label="Value Date" />
        )}
      />

      <Controller
        name="date3"
        control={control}
        rules={{
          required: 'Required',
          pattern: {
            value: TIMELESS_DATE_REGEX,
            message: 'Date must be im format yyyy-mm-dd',
          },
          validate: value => {
            try {
              format(new Date(value), 'yyyy-MM-dd');
              return;
            } catch {
              return 'Invalid date input';
            }
          },
        }}
        render={({ field, fieldState }) => (
          <TextInput {...field} error={fieldState.error?.message} label="Date 3" />
        )}
      />

      <Controller
        name="hashavshevet_id"
        control={control}
        render={({ field, fieldState }) => (
          <NumberInput
            precision={0}
            {...field}
            value={field.value ?? undefined}
            error={fieldState.error?.message}
            label="Hashavshevet ID"
          />
        )}
      />

      <Controller
        name="movement_type"
        control={control}
        render={({ field, fieldState }) => (
          <TextInput
            {...field}
            value={field.value ?? undefined}
            error={fieldState.error?.message}
            label="Movement Type"
          />
        )}
      />
    </>
  );
};
