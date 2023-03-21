import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  Control,
  Controller,
  UseFormSetValue,
  UseFormUnregister,
  UseFormWatch,
} from 'react-hook-form';
import { FragmentType, getFragmentData } from '../../../gql';
import {
  Currency,
  EditDbLedgerRecordsFieldsFragmentDoc,
  UpdateDbLedgerRecordInput,
} from '../../../gql/graphql';
import { TIMELESS_DATE_REGEX } from '../../../helpers/consts';
import { CurrencyCodeInput, CurrencyInput, NumberInput, TextInput } from '../../common';

type Props = {
  ledgerRecordProps: FragmentType<typeof EditDbLedgerRecordsFieldsFragmentDoc>;
  control: Control<UpdateDbLedgerRecordInput, unknown>;
  watch: UseFormWatch<UpdateDbLedgerRecordInput>;
  unregister: UseFormUnregister<UpdateDbLedgerRecordInput>;
  setValue: UseFormSetValue<UpdateDbLedgerRecordInput>;
};

export const EditDbLedgerRecordFields = ({
  control,
  ledgerRecordProps,
  setValue,
  unregister,
  watch,
}: Props) => {
  const ledgerRecord = getFragmentData(EditDbLedgerRecordsFieldsFragmentDoc, ledgerRecordProps);
  const [currency, setCurrency] = useState<Currency>(Currency.Ils);
  const [isCredit1, setIsCredit1] = useState(false);
  const [isCredit2, setIsCredit2] = useState(false);
  const [isDebit1, setIsDebit1] = useState(false);
  const [isDebit2, setIsDebit2] = useState(false);

  const [
    formCurrency,
    formCreditAccountID1,
    formCreditAccountID2,
    formDebitAccountID1,
    formDebitAccountID2,
  ] = watch([
    'currency',
    'credit_account_id_1',
    'credit_account_id_2',
    'debit_account_id_1',
    'debit_account_id_2',
  ]);

  function isAccountActive(account?: string | null) {
    return !!account;
  }

  useEffect(() => {
    const isActive = isAccountActive(formCreditAccountID1);
    setIsCredit1(isActive);
  }, [formCreditAccountID1]);
  useEffect(() => {
    const isActive = isAccountActive(formCreditAccountID2);
    setIsCredit2(isActive);
  }, [formCreditAccountID2]);
  useEffect(() => {
    const isActive = isAccountActive(formDebitAccountID1);
    setIsDebit1(isActive);
  }, [formDebitAccountID1]);
  useEffect(() => {
    const isActive = isAccountActive(formDebitAccountID2);
    setIsDebit2(isActive);
  }, [formDebitAccountID2]);

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
        defaultValue={ledgerRecord.currency}
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
        name="credit_account_id_1"
        control={control}
        defaultValue={ledgerRecord.credit_account_1?.id}
        render={({ field, fieldState }) => (
          <TextInput
            {...field}
            value={field.value ?? ''}
            error={fieldState.error?.message}
            label="Credit Account 1"
          />
        )}
      />
      <Controller
        name="credit_amount_1"
        shouldUnregister={!isCredit1}
        control={control}
        defaultValue={ledgerRecord.credit_amount_1}
        render={({ field: amountField, fieldState: amountFieldState }) => (
          <CurrencyInput
            {...amountField}
            value={amountField.value ?? undefined}
            error={amountFieldState.error?.message}
            disabled={!isCredit1}
            label="Credit Amount 1"
            currencyCodeProps={{
              value: Currency.Ils,
              label: 'Currency',
              disabled: true,
            }}
          />
        )}
      />
      <Controller
        name="foreign_credit_amount_1"
        shouldUnregister={!(isCredit1 && formCurrency === Currency.Ils)}
        control={control}
        defaultValue={ledgerRecord.foreign_credit_amount_1}
        render={({ field: amountField, fieldState: amountFieldState }) => (
          <CurrencyInput
            {...amountField}
            value={amountField.value ?? undefined}
            error={amountFieldState.error?.message}
            disabled={!isCredit1 || !currency || currency === Currency.Ils}
            label="Foreign Credit Amount 1"
            currencyCodeProps={{
              value: currency,
              label: 'Currency',
              disabled: true,
            }}
          />
        )}
      />

      <Controller
        name="credit_account_id_2"
        control={control}
        defaultValue={ledgerRecord.credit_account_2?.id}
        render={({ field, fieldState }) => (
          <TextInput
            {...field}
            value={field.value ?? undefined}
            error={fieldState.error?.message}
            label="Credit Account 2"
          />
        )}
      />
      <Controller
        name="credit_amount_2"
        shouldUnregister={!isCredit2}
        control={control}
        defaultValue={ledgerRecord.credit_amount_2}
        render={({ field: amountField, fieldState: amountFieldState }) => (
          <CurrencyInput
            {...amountField}
            value={amountField.value ?? undefined}
            error={amountFieldState.error?.message}
            disabled={!isCredit2}
            label="Credit Amount 2"
            currencyCodeProps={{
              value: Currency.Ils,
              label: 'Currency',
              disabled: true,
            }}
          />
        )}
      />
      <Controller
        name="foreign_credit_amount_2"
        shouldUnregister={!(isCredit2 && formCurrency === Currency.Ils)}
        control={control}
        defaultValue={ledgerRecord.foreign_credit_amount_2}
        render={({ field: amountField, fieldState: amountFieldState }) => (
          <CurrencyInput
            {...amountField}
            value={amountField.value ?? undefined}
            error={amountFieldState.error?.message}
            disabled={!isCredit2 || !currency || currency === Currency.Ils}
            label="Foreign Credit Amount 2"
            currencyCodeProps={{
              value: currency,
              label: 'Currency',
              disabled: true,
            }}
          />
        )}
      />

      <Controller
        name="debit_account_id_1"
        control={control}
        defaultValue={ledgerRecord.debit_account_1?.id}
        render={({ field, fieldState }) => (
          <TextInput
            {...field}
            value={field.value ?? undefined}
            error={fieldState.error?.message}
            label="Debit Account 1"
          />
        )}
      />
      <Controller
        name="debit_amount_1"
        shouldUnregister={!isDebit1}
        control={control}
        defaultValue={ledgerRecord.debit_amount_1}
        render={({ field: amountField, fieldState: amountFieldState }) => (
          <CurrencyInput
            {...amountField}
            value={amountField.value ?? undefined}
            error={amountFieldState.error?.message}
            disabled={!isDebit1}
            label="Debit Amount 1"
            currencyCodeProps={{
              value: Currency.Ils,
              label: 'Currency',
              disabled: true,
            }}
          />
        )}
      />
      <Controller
        name="foreign_debit_amount_1"
        shouldUnregister={!(isDebit1 && formCurrency === Currency.Ils)}
        control={control}
        defaultValue={ledgerRecord.foreign_debit_amount_1}
        render={({ field: amountField, fieldState: amountFieldState }) => (
          <CurrencyInput
            {...amountField}
            value={amountField.value ?? undefined}
            error={amountFieldState.error?.message}
            disabled={!isDebit1 || !currency || currency === Currency.Ils}
            label="Foreign Debit Amount 1"
            currencyCodeProps={{
              value: currency,
              label: 'Currency',
              disabled: true,
            }}
          />
        )}
      />

      <Controller
        name="debit_account_id_2"
        control={control}
        defaultValue={ledgerRecord.debit_account_2?.id}
        render={({ field, fieldState }) => (
          <TextInput
            {...field}
            value={field.value ?? undefined}
            error={fieldState.error?.message}
            label="Debit Account 2"
          />
        )}
      />
      <Controller
        name="debit_amount_2"
        shouldUnregister={!isDebit2}
        control={control}
        defaultValue={ledgerRecord.debit_amount_2}
        render={({ field: amountField, fieldState: amountFieldState }) => (
          <CurrencyInput
            {...amountField}
            value={amountField.value ?? undefined}
            error={amountFieldState.error?.message}
            disabled={!isDebit2}
            label="Debit Amount 2"
            currencyCodeProps={{
              value: Currency.Ils,
              label: 'Currency',
              disabled: true,
            }}
          />
        )}
      />
      <Controller
        name="foreign_debit_amount_2"
        shouldUnregister={!(isDebit2 && formCurrency === Currency.Ils)}
        control={control}
        defaultValue={ledgerRecord.foreign_debit_amount_2}
        render={({ field: amountField, fieldState: amountFieldState }) => (
          <CurrencyInput
            {...amountField}
            value={amountField.value ?? undefined}
            error={amountFieldState.error?.message}
            disabled={!isDebit2 || !currency || currency === Currency.Ils}
            label="Foreign Debit Amount 2"
            currencyCodeProps={{
              value: currency,
              label: 'Currency',
              disabled: true,
            }}
          />
        )}
      />

      <Controller
        name="details"
        control={control}
        defaultValue={ledgerRecord.details}
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
        defaultValue={ledgerRecord.reference_1}
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
        defaultValue={ledgerRecord.reference_2}
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
        defaultValue={ledgerRecord.invoice_date}
        rules={{
          required: 'Required',
          pattern: {
            value: TIMELESS_DATE_REGEX,
            message: 'Date must be im format yyyy-mm-dd',
          },
          validate: value => {
            try {
              if (!value) {
                return 'Required';
              }
              format(new Date(value), 'yyyy-MM-dd');
              return;
            } catch {
              return 'Invalid date input';
            }
          },
        }}
        render={({ field, fieldState }) => (
          <TextInput
            {...field}
            value={field.value ?? undefined}
            error={fieldState.error?.message}
            label="Invoice Date"
          />
        )}
      />

      <Controller
        name="value_date"
        control={control}
        defaultValue={ledgerRecord.value_date}
        rules={{
          required: 'Required',
          pattern: {
            value: TIMELESS_DATE_REGEX,
            message: 'Date must be im format yyyy-mm-dd',
          },
          validate: value => {
            try {
              if (!value) {
                return 'Required';
              }
              format(new Date(value), 'yyyy-MM-dd');
              return;
            } catch {
              return 'Invalid date input';
            }
          },
        }}
        render={({ field, fieldState }) => (
          <TextInput
            {...field}
            value={field.value ?? undefined}
            error={fieldState.error?.message}
            label="Value Date"
          />
        )}
      />

      <Controller
        name="date3"
        control={control}
        defaultValue={ledgerRecord.date3}
        rules={{
          required: 'Required',
          pattern: {
            value: TIMELESS_DATE_REGEX,
            message: 'Date must be im format yyyy-mm-dd',
          },
          validate: value => {
            try {
              if (!value) {
                return 'Required';
              }
              format(new Date(value), 'yyyy-MM-dd');
              return;
            } catch {
              return 'Invalid date input';
            }
          },
        }}
        render={({ field, fieldState }) => (
          <TextInput
            {...field}
            value={field.value ?? undefined}
            error={fieldState.error?.message}
            label="Date 3"
          />
        )}
      />

      <Controller
        name="hashavshevet_id"
        control={control}
        defaultValue={ledgerRecord.hashavshevet_id}
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
        defaultValue={ledgerRecord.movement_type}
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
