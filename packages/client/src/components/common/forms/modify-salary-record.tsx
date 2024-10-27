import { ReactElement, useContext, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { useQuery } from 'urql';
import { NumberInput, Select } from '@mantine/core';
import { MonthPickerInput } from '@mantine/dates';
import { showNotification } from '@mantine/notifications';
import {
  AllBusinessesDocument,
  AllEmployeesByEmployerDocument,
  AllPensionFundsDocument,
  AllTrainingFundsDocument,
  SalaryRecordInput,
} from '../../../gql/graphql.js';
import {
  MakeBoolean,
  relevantDataPicker,
  TimelessDateString,
  UUID_REGEX,
} from '../../../helpers/index.js';
import { UserContext } from '../../../providers/user-provider.js';
import { CurrencyInput, SimpleGrid, TextInput } from '../index.js';

type Props = {
  isNewInsert: boolean;
  defaultValues?: SalaryRecordInput;
  month?: string;
  onDone: (salaryRecord?: SalaryRecordInput) => void;
  isModifying?: boolean;
};

export const ModifySalaryRecord = ({
  isNewInsert = true,
  defaultValues,
  month,
  onDone,
  isModifying,
}: Props): ReactElement => {
  const [{ data: businessesData, fetching: fetchingBusinesses, error: businessesError }] = useQuery(
    {
      query: AllBusinessesDocument,
    },
  );
  const [{ data: pensionFundsData, fetching: fetchingPensionFunds, error: pensionFundsError }] =
    useQuery({
      query: AllPensionFundsDocument,
    });
  const { userContext } = useContext(UserContext);
  const [{ data: trainingFundsData, fetching: fetchingTrainingFunds, error: trainingFundsError }] =
    useQuery({
      query: AllTrainingFundsDocument,
    });
  const [{ data: employeesData, fetching: employeesFetching, error: employeesError }] = useQuery({
    query: AllEmployeesByEmployerDocument,
    variables: {
      employerId: userContext?.ownerId,
    },
  });

  const [businesses, setBusinesses] = useState<Array<{ value: string; label: string }>>([]);
  const [pensionFunds, setPensionFunds] = useState<Array<{ value: string; label: string }>>([]);
  const [trainingFunds, setTrainingFunds] = useState<Array<{ value: string; label: string }>>([]);
  const [employees, setEmployees] = useState<Array<{ value: string; label: string }>>([]);

  const defaultMonth = defaultValues?.month ?? month;
  const useFormManager = useForm<SalaryRecordInput>({
    defaultValues: {
      ...defaultValues,
      month: defaultMonth,
    },
  });

  const {
    control,
    handleSubmit: handleSalaryRecordSubmit,
    formState: { dirtyFields: dirtySalaryRecordFields },
    setValue,
  } = useFormManager;

  useEffect(() => {
    if (businessesError) {
      showNotification({
        title: 'Error!',
        message: 'Oh no!, we have an error businesses entities! 🤥',
      });
    }
  }, [businessesError]);
  useEffect(() => {
    if (pensionFundsError) {
      showNotification({
        title: 'Error!',
        message: 'Oh no!, we have an error fetching pension funds! 🤥',
      });
    }
  }, [pensionFundsError]);
  useEffect(() => {
    if (trainingFundsError) {
      showNotification({
        title: 'Error!',
        message: 'Oh no!, we have an error fetching training funds! 🤥',
      });
    }
  }, [trainingFundsError]);
  useEffect(() => {
    if (employeesError) {
      showNotification({
        title: 'Error!',
        message: 'Oh no!, we have an error employees! 🤥',
      });
    }
  }, [employeesError]);

  // On every new data fetch, reorder results by name
  useEffect(() => {
    if (businessesData?.allBusinesses?.nodes.length) {
      setBusinesses(
        businessesData.allBusinesses.nodes
          .map(entity => ({
            value: entity.id,
            label: entity.name,
          }))
          .sort((a, b) => (a.label > b.label ? 1 : -1)),
      );
    }
  }, [businessesData, setBusinesses]);
  useEffect(() => {
    if (pensionFundsData?.allPensionFunds?.length) {
      setPensionFunds(
        pensionFundsData.allPensionFunds
          .map(fund => ({
            value: fund.id,
            label: fund.name,
          }))
          .sort((a, b) => (a.label > b.label ? 1 : -1)),
      );
    }
  }, [pensionFundsData, setTrainingFunds]);
  useEffect(() => {
    if (trainingFundsData?.allTrainingFunds?.length) {
      setTrainingFunds(
        trainingFundsData.allTrainingFunds
          .map(fund => ({
            value: fund.id,
            label: fund.name,
          }))
          .sort((a, b) => (a.label > b.label ? 1 : -1)),
      );
    }
  }, [trainingFundsData, setTrainingFunds]);
  useEffect(() => {
    if (employeesData?.employeesByEmployerId.length) {
      setEmployees(
        employeesData.employeesByEmployerId
          .filter(employee => !employee.name.toLocaleLowerCase().includes('batched'))
          .map(employee => ({
            value: employee.id,
            label: employee.name,
          }))
          .sort((a, b) => (a.label > b.label ? 1 : -1)),
      );
    }
  }, [employeesData, setTrainingFunds]);

  useEffect(() => {
    if (!defaultValues?.employer) {
      setValue('employer', userContext?.ownerId, { shouldDirty: true, shouldTouch: true });
    }
  }, [setValue, defaultValues?.employer, userContext?.ownerId]);

  const onSalaryRecordSubmit: SubmitHandler<SalaryRecordInput> = data => {
    console.log('data', data);
    const dataToUpdate = relevantDataPicker(
      data,
      dirtySalaryRecordFields as MakeBoolean<typeof data>,
    );
    console.log('dataToUpdate', dataToUpdate);
    if (
      isNewInsert &&
      (!dataToUpdate?.directPaymentAmount ||
        !dataToUpdate?.employeeId ||
        !dataToUpdate?.employer ||
        !dataToUpdate?.month)
    ) {
      console.log('insert missing data');
      return;
    }

    if (dataToUpdate && Object.keys(dataToUpdate).length > 0) {
      if (!isNewInsert) {
        if (!defaultValues) {
          return;
        }
        dataToUpdate.employeeId ??= defaultValues.employeeId;
        dataToUpdate.month ??= defaultValues.month;
      }
      onDone(dataToUpdate as SalaryRecordInput);
    } else {
      console.log('no data to update');
      onDone();
    }
  };

  function onSelectMonth(date: Date): void {
    setValue('month', format(date, 'yyyy-MM-dd') as TimelessDateString, {
      shouldDirty: true,
      shouldTouch: true,
    });
  }

  return (
    <form onSubmit={handleSalaryRecordSubmit(onSalaryRecordSubmit)}>
      <div className="flex-row px-10 h-max justify-start block">
        <SimpleGrid cols={4}>
          <div className="flex-column h-max justify-start block">
            <MonthPickerInput
              defaultDate={defaultMonth ? new Date(defaultMonth) : undefined}
              defaultValue={defaultMonth ? new Date(defaultMonth) : undefined}
              onChange={onSelectMonth}
              popoverProps={{ withinPortal: true }}
            />
            <Controller
              name="employer"
              control={control}
              defaultValue={defaultValues?.employer}
              rules={{
                required: 'Required',
              }}
              render={({ field, fieldState }): ReactElement => (
                <Select
                  {...field}
                  data={businesses}
                  value={field.value}
                  disabled={fetchingBusinesses}
                  label="Employer"
                  placeholder="Scroll to see all options"
                  maxDropdownHeight={160}
                  searchable
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="chargeId"
              control={control}
              defaultValue={defaultValues?.chargeId}
              rules={{
                pattern: { value: UUID_REGEX, message: 'Invalid UUID' },
              }}
              render={({ field: { value, ...field }, fieldState }): ReactElement => (
                <TextInput
                  {...field}
                  value={value ?? undefined}
                  error={fieldState.error?.message}
                  label="Charge ID"
                />
              )}
            />
            <Controller
              name="employeeId"
              control={control}
              defaultValue={defaultValues?.employeeId}
              rules={{
                required: 'Required',
              }}
              render={({ field, fieldState }): ReactElement => (
                <Select
                  {...field}
                  data={employees}
                  value={field.value}
                  disabled={employeesFetching}
                  label="Employee"
                  placeholder="Scroll to see all options"
                  maxDropdownHeight={160}
                  searchable
                  error={fieldState.error?.message}
                />
              )}
            />
          </div>
          <div className="flex-row px-10 h-max justify-start block">
            <Controller
              name="baseSalary"
              control={control}
              defaultValue={defaultValues?.baseSalary}
              render={({ field, fieldState }): ReactElement => (
                <CurrencyInput
                  {...field}
                  value={field.value ?? undefined}
                  error={fieldState.error?.message}
                  label="Base Salary"
                  removeTrailingZeros
                  currencyCodeProps={{
                    value: 'ILS',
                    label: 'Currency',
                    disabled: true,
                  }}
                />
              )}
            />
            <Controller
              name="globalAdditionalHours"
              control={control}
              defaultValue={defaultValues?.globalAdditionalHours}
              render={({ field, fieldState }): ReactElement => (
                <CurrencyInput
                  {...field}
                  value={field.value ?? undefined}
                  error={fieldState.error?.message}
                  label="Global Additional Hours"
                  removeTrailingZeros
                  currencyCodeProps={{
                    value: 'ILS',
                    label: 'Currency',
                    disabled: true,
                  }}
                />
              )}
            />
            <Controller
              name="bonus"
              control={control}
              defaultValue={defaultValues?.bonus}
              render={({ field, fieldState }): ReactElement => (
                <CurrencyInput
                  {...field}
                  value={field.value ?? undefined}
                  error={fieldState.error?.message}
                  label="Bonus"
                  removeTrailingZeros
                  currencyCodeProps={{
                    value: 'ILS',
                    label: 'Currency',
                    disabled: true,
                  }}
                />
              )}
            />
            <Controller
              name="gift"
              control={control}
              defaultValue={defaultValues?.gift}
              render={({ field, fieldState }): ReactElement => (
                <CurrencyInput
                  {...field}
                  value={field.value ?? undefined}
                  error={fieldState.error?.message}
                  label="Gift"
                  removeTrailingZeros
                  currencyCodeProps={{
                    value: 'ILS',
                    label: 'Currency',
                    disabled: true,
                  }}
                />
              )}
            />
            <Controller
              name="recovery"
              control={control}
              defaultValue={defaultValues?.recovery}
              render={({ field, fieldState }): ReactElement => (
                <CurrencyInput
                  {...field}
                  value={field.value ?? undefined}
                  error={fieldState.error?.message}
                  label="Recovery"
                  removeTrailingZeros
                  currencyCodeProps={{
                    value: 'ILS',
                    label: 'Currency',
                  }}
                />
              )}
            />
            <Controller
              name="vacationTakeout"
              control={control}
              defaultValue={defaultValues?.vacationTakeout}
              render={({ field, fieldState }): ReactElement => (
                <CurrencyInput
                  {...field}
                  value={field.value ?? undefined}
                  error={fieldState.error?.message}
                  label="Vacation Takeout"
                  removeTrailingZeros
                  currencyCodeProps={{
                    value: 'ILS',
                    label: 'Currency',
                    disabled: true,
                  }}
                />
              )}
            />
            <Controller
              name="directPaymentAmount"
              control={control}
              defaultValue={defaultValues?.directPaymentAmount}
              rules={{
                required: 'Required',
              }}
              render={({ field, fieldState }): ReactElement => (
                <CurrencyInput
                  {...field}
                  value={field.value ?? undefined}
                  error={fieldState.error?.message}
                  label="Direct Payment"
                  removeTrailingZeros
                  currencyCodeProps={{
                    value: 'ILS',
                    label: 'Currency',
                    disabled: true,
                  }}
                />
              )}
            />
          </div>
          <div className="flex-row px-10 h-max justify-start block">
            <Controller
              name="pensionFundId"
              control={control}
              defaultValue={defaultValues?.pensionFundId}
              render={({ field, fieldState }): ReactElement => (
                <Select
                  {...field}
                  data={pensionFunds}
                  value={field.value}
                  disabled={fetchingPensionFunds}
                  label="Pension Fund"
                  placeholder="Scroll to see all options"
                  maxDropdownHeight={160}
                  searchable
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="pensionEmployeeAmount"
              control={control}
              defaultValue={defaultValues?.pensionEmployeeAmount}
              render={({ field, fieldState }): ReactElement => (
                <CurrencyInput
                  {...field}
                  value={field.value ?? undefined}
                  error={fieldState.error?.message}
                  label="Pension Employee Amount"
                  removeTrailingZeros
                  currencyCodeProps={{
                    value: 'ILS',
                    label: 'Currency',
                    disabled: true,
                  }}
                />
              )}
            />
            <Controller
              name="pensionEmployeePercentage"
              control={control}
              defaultValue={defaultValues?.pensionEmployeePercentage}
              render={({ field: { value, ...field }, fieldState }): ReactElement => (
                <NumberInput
                  {...field}
                  hideControls
                  precision={2}
                  removeTrailingZeros
                  rightSection="%"
                  value={value ?? undefined}
                  error={fieldState.error?.message}
                  label="Pension Employee Percentage"
                />
              )}
            />
            <Controller
              name="pensionEmployerAmount"
              control={control}
              defaultValue={defaultValues?.pensionEmployerAmount}
              render={({ field, fieldState }): ReactElement => (
                <CurrencyInput
                  {...field}
                  value={field.value ?? undefined}
                  error={fieldState.error?.message}
                  label="Pension Employer Amount"
                  removeTrailingZeros
                  currencyCodeProps={{
                    value: 'ILS',
                    label: 'Currency',
                    disabled: true,
                  }}
                />
              )}
            />
            <Controller
              name="pensionEmployerPercentage"
              control={control}
              defaultValue={defaultValues?.pensionEmployerPercentage}
              render={({ field: { value, ...field }, fieldState }): ReactElement => (
                <NumberInput
                  {...field}
                  hideControls
                  precision={2}
                  removeTrailingZeros
                  rightSection="%"
                  value={value ?? undefined}
                  error={fieldState.error?.message}
                  label="Pension Employer Percentage"
                />
              )}
            />
          </div>
          <div className="flex-row px-10 h-max justify-start block">
            <Controller
              name="compensationsEmployerAmount"
              control={control}
              defaultValue={defaultValues?.compensationsEmployerAmount}
              render={({ field, fieldState }): ReactElement => (
                <CurrencyInput
                  {...field}
                  value={field.value ?? undefined}
                  error={fieldState.error?.message}
                  label="Compensations Amount"
                  removeTrailingZeros
                  currencyCodeProps={{
                    value: 'ILS',
                    label: 'Currency',
                    disabled: true,
                  }}
                />
              )}
            />
            <Controller
              name="compensationsEmployerPercentage"
              control={control}
              defaultValue={defaultValues?.compensationsEmployerPercentage}
              render={({ field: { value, ...field }, fieldState }): ReactElement => (
                <NumberInput
                  {...field}
                  hideControls
                  precision={2}
                  removeTrailingZeros
                  rightSection="%"
                  value={value ?? undefined}
                  error={fieldState.error?.message}
                  label="Compensations Percentage"
                />
              )}
            />
          </div>
          <div className="flex-row px-10 h-max justify-start block">
            <Controller
              name="trainingFundId"
              control={control}
              defaultValue={defaultValues?.trainingFundId}
              render={({ field, fieldState }): ReactElement => (
                <Select
                  {...field}
                  data={trainingFunds}
                  value={field.value}
                  disabled={fetchingTrainingFunds}
                  label="Training Fund"
                  placeholder="Scroll to see all options"
                  maxDropdownHeight={160}
                  searchable
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="trainingFundEmployeeAmount"
              control={control}
              defaultValue={defaultValues?.trainingFundEmployeeAmount}
              render={({ field, fieldState }): ReactElement => (
                <CurrencyInput
                  {...field}
                  value={field.value ?? undefined}
                  error={fieldState.error?.message}
                  label="Training Employee Amount"
                  removeTrailingZeros
                  currencyCodeProps={{
                    value: 'ILS',
                    label: 'Currency',
                    disabled: true,
                  }}
                />
              )}
            />
            <Controller
              name="trainingFundEmployeePercentage"
              control={control}
              defaultValue={defaultValues?.trainingFundEmployeePercentage}
              render={({ field: { value, ...field }, fieldState }): ReactElement => (
                <NumberInput
                  {...field}
                  hideControls
                  precision={2}
                  removeTrailingZeros
                  rightSection="%"
                  value={value ?? undefined}
                  error={fieldState.error?.message}
                  label="Training Employee Percentage"
                />
              )}
            />
            <Controller
              name="trainingFundEmployerAmount"
              control={control}
              defaultValue={defaultValues?.trainingFundEmployerAmount}
              render={({ field, fieldState }): ReactElement => (
                <CurrencyInput
                  {...field}
                  value={field.value ?? undefined}
                  error={fieldState.error?.message}
                  label="Training Employer Amount"
                  removeTrailingZeros
                  currencyCodeProps={{
                    value: 'ILS',
                    label: 'Currency',
                    disabled: true,
                  }}
                />
              )}
            />
            <Controller
              name="trainingFundEmployerPercentage"
              control={control}
              defaultValue={defaultValues?.trainingFundEmployerPercentage}
              render={({ field: { value, ...field }, fieldState }): ReactElement => (
                <NumberInput
                  {...field}
                  hideControls
                  precision={2}
                  removeTrailingZeros
                  rightSection="%"
                  value={value ?? undefined}
                  error={fieldState.error?.message}
                  label="Training Employer Percentage"
                />
              )}
            />
          </div>
          <div className="flex-row px-10 h-max justify-start block">
            <Controller
              name="socialSecurityAmountEmployee"
              control={control}
              defaultValue={defaultValues?.socialSecurityAmountEmployee}
              render={({ field, fieldState }): ReactElement => (
                <CurrencyInput
                  {...field}
                  value={field.value ?? undefined}
                  error={fieldState.error?.message}
                  label="Social Security - Employee"
                  removeTrailingZeros
                  currencyCodeProps={{
                    value: 'ILS',
                    label: 'Currency',
                    disabled: true,
                  }}
                />
              )}
            />
            <Controller
              name="socialSecurityAmountEmployer"
              control={control}
              defaultValue={defaultValues?.socialSecurityAmountEmployer}
              render={({ field, fieldState }): ReactElement => (
                <CurrencyInput
                  {...field}
                  value={field.value ?? undefined}
                  error={fieldState.error?.message}
                  label="Social Security - Employer"
                  removeTrailingZeros
                  currencyCodeProps={{
                    value: 'ILS',
                    label: 'Currency',
                    disabled: true,
                  }}
                />
              )}
            />
            <Controller
              name="healthPaymentAmount"
              control={control}
              defaultValue={defaultValues?.healthPaymentAmount}
              render={({ field, fieldState }): ReactElement => (
                <CurrencyInput
                  {...field}
                  value={field.value ?? undefined}
                  error={fieldState.error?.message}
                  label="Health Insurance"
                  removeTrailingZeros
                  currencyCodeProps={{
                    value: 'ILS',
                    label: 'Currency',
                    disabled: true,
                  }}
                />
              )}
            />
          </div>
          <div className="flex-row px-10 h-max justify-start block">
            <Controller
              name="taxAmount"
              control={control}
              defaultValue={defaultValues?.taxAmount}
              render={({ field, fieldState }): ReactElement => (
                <CurrencyInput
                  {...field}
                  value={field.value ?? undefined}
                  error={fieldState.error?.message}
                  label="Income Tax"
                  removeTrailingZeros
                  currencyCodeProps={{
                    value: 'ILS',
                    label: 'Currency',
                    disabled: true,
                  }}
                />
              )}
            />
            <Controller
              name="zkufot"
              control={control}
              defaultValue={defaultValues?.zkufot}
              render={({ field, fieldState }): ReactElement => (
                <CurrencyInput
                  {...field}
                  value={field.value ?? undefined}
                  error={fieldState.error?.message}
                  precision={0}
                  label="Notional Expense"
                  removeTrailingZeros
                  currencyCodeProps={{
                    value: 'ILS',
                    label: 'Currency',
                    disabled: true,
                  }}
                />
              )}
            />
          </div>
          <div className="flex-row px-10 h-max justify-start block">
            <Controller
              name="workDays"
              control={control}
              defaultValue={defaultValues?.workDays}
              render={({ field: { value, ...field }, fieldState }): ReactElement => (
                <NumberInput
                  {...field}
                  hideControls
                  precision={2}
                  removeTrailingZeros
                  value={value ?? undefined}
                  error={fieldState.error?.message}
                  label="Work Days"
                />
              )}
            />
            {/* <Controller
              name="hours"
              control={control}
              defaultValue={defaultValues?.hours}
              render={({ field: { value, ...field }, fieldState }): ReactElement => (
                <NumberInput
                  {...field}
                  hideControls
                  precision={2}
                  removeTrailingZeros
                  value={value ?? undefined}
                  error={fieldState.error?.message}
                  label="Hours"
                />
              )}
            />
            <Controller
              name="hourlyRate"
              control={control}
              defaultValue={defaultValues?.hourlyRate}
              render={({ field: { value, ...field }, fieldState }): ReactElement => (
                <NumberInput
                  {...field}
                  hideControls
                  precision={2}
                  removeTrailingZeros
                  value={value ?? undefined}
                  error={fieldState.error?.message}
                  label="Hourly Rate"
                />
              )}
            /> */}
            <Controller
              name="addedVacationDays"
              control={control}
              defaultValue={defaultValues?.addedVacationDays}
              render={({ field: { value, ...field }, fieldState }): ReactElement => (
                <NumberInput
                  {...field}
                  hideControls
                  precision={2}
                  removeTrailingZeros
                  value={value ?? undefined}
                  error={fieldState.error?.message}
                  label="Added Vacation Days"
                />
              )}
            />
            <Controller
              name="vacationDaysBalance"
              control={control}
              defaultValue={defaultValues?.vacationDaysBalance}
              render={({ field: { value, ...field }, fieldState }): ReactElement => (
                <NumberInput
                  {...field}
                  hideControls
                  precision={2}
                  removeTrailingZeros
                  value={value ?? undefined}
                  error={fieldState.error?.message}
                  label="Vacation Days Balance"
                />
              )}
            />
            <Controller
              name="sicknessDaysBalance"
              control={control}
              defaultValue={defaultValues?.sicknessDaysBalance}
              render={({ field: { value, ...field }, fieldState }): ReactElement => (
                <NumberInput
                  {...field}
                  hideControls
                  precision={2}
                  removeTrailingZeros
                  value={value ?? undefined}
                  error={fieldState.error?.message}
                  label="Sickness Days Balance"
                />
              )}
            />
          </div>
        </SimpleGrid>
      </div>
      <div className="mt-10 mb-5 flex justify-center gap-5">
        <button
          type="submit"
          onClick={(): (() => Promise<void>) => handleSalaryRecordSubmit(onSalaryRecordSubmit)}
          className="mt-8 text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-none hover:bg-indigo-600 rounded text-lg"
          disabled={isModifying || Object.keys(dirtySalaryRecordFields).length === 0}
        >
          Accept
        </button>
        <button
          type="button"
          className="mt-8 text-white bg-rose-500 border-0 py-2 px-8 focus:outline-none hover:bg-rose-600 rounded text-lg"
          onClick={() => onDone()}
        >
          Cancel
        </button>
      </div>
    </form>
  );
};
