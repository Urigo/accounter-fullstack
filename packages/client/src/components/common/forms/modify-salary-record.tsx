import { useContext, useEffect, useState, type ReactElement } from 'react';
import { format } from 'date-fns';
import { Controller, useForm, type SubmitHandler } from 'react-hook-form';
import { toast } from 'sonner';
import { useQuery } from 'urql';
import {
  AllEmployeesByEmployerDocument,
  AllPensionFundsDocument,
  AllTrainingFundsDocument,
  type SalaryRecordInput,
} from '../../../gql/graphql.js';
import {
  relevantDataPicker,
  UUID_REGEX,
  type MakeBoolean,
  type TimelessDateString,
} from '../../../helpers/index.js';
import { useGetBusinesses } from '../../../hooks/use-get-businesses.js';
import { UserContext } from '../../../providers/user-provider.js';
import { ComboBox } from '../../common/inputs/combo-box.js';
import { MonthPickerInput } from '../../common/inputs/month-picker-input.js';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form.js';
import { Input } from '../../ui/input.js';
import { CurrencyInput, SimpleGrid } from '../index.js';
import { NumberInput } from '../inputs/number-input.js';

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
  const { selectableBusinesses: businesses, fetching: fetchingBusinesses } = useGetBusinesses();
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
      employerId: userContext?.context.adminBusinessId ?? '',
    },
  });

  const [pensionFunds, setPensionFunds] = useState<Array<{ value: string; label: string }>>([]);
  const [trainingFunds, setTrainingFunds] = useState<Array<{ value: string; label: string }>>([]);
  const [employees, setEmployees] = useState<Array<{ value: string; label: string }>>([]);

  const defaultMonth = defaultValues?.month ?? month;
  const formManager = useForm<SalaryRecordInput>({
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
  } = formManager;

  useEffect(() => {
    if (pensionFundsError) {
      toast.error('Error', {
        description: 'Oh no!, we have an error fetching pension funds! 🤥',
      });
    }
  }, [pensionFundsError]);
  useEffect(() => {
    if (trainingFundsError) {
      toast.error('Error', {
        description: 'Oh no!, we have an error fetching training funds! 🤥',
      });
    }
  }, [trainingFundsError]);
  useEffect(() => {
    if (employeesError) {
      toast.error('Error', {
        description: 'Oh no!, we have an error employees! 🤥',
      });
    }
  }, [employeesError]);

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
    if (!defaultValues?.employer && userContext?.context.adminBusinessId) {
      setValue('employer', userContext.context.adminBusinessId, {
        shouldDirty: true,
        shouldTouch: true,
      });
    }
  }, [setValue, defaultValues?.employer, userContext?.context.adminBusinessId]);

  const onSalaryRecordSubmit: SubmitHandler<SalaryRecordInput> = data => {
    const dataToUpdate = relevantDataPicker(
      data,
      dirtySalaryRecordFields as MakeBoolean<typeof data>,
    );
    if (
      isNewInsert &&
      (!dataToUpdate?.directPaymentAmount ||
        !dataToUpdate?.employeeId ||
        !dataToUpdate?.employer ||
        !dataToUpdate?.month)
    ) {
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
      onDone();
    }
  };

  function onSelectMonth(date: Date | null): void {
    if (!date) {
      return;
    }
    setValue('month', format(date, 'yyyy-MM-dd') as TimelessDateString, {
      shouldDirty: true,
      shouldTouch: true,
    });
  }

  return (
    <Form {...formManager}>
      <form onSubmit={handleSalaryRecordSubmit(onSalaryRecordSubmit)}>
        <div className="flex-row px-10 h-max justify-start block">
          <SimpleGrid cols={4}>
            <div className="flex-column h-max justify-start block">
              <MonthPickerInput
                defaultDate={defaultMonth ? new Date(defaultMonth) : undefined}
                defaultValue={defaultMonth ? new Date(defaultMonth) : undefined}
                onChange={onSelectMonth}
              />
              <Controller
                name="employer"
                control={control}
                defaultValue={defaultValues?.employer}
                rules={{
                  required: 'Required',
                }}
                render={({ field, fieldState }): ReactElement => (
                  <ComboBox
                    {...field}
                    data={businesses}
                    value={field.value}
                    disabled={fetchingBusinesses}
                    label="Employer"
                    placeholder="Scroll to see all options"
                    error={fieldState.error?.message}
                  />
                )}
              />
              <FormField
                name="chargeId"
                control={control}
                defaultValue={defaultValues?.chargeId}
                rules={{
                  pattern: { value: UUID_REGEX, message: 'Invalid UUID' },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Charge ID</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? undefined} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
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
                  <ComboBox
                    {...field}
                    data={employees}
                    value={field.value}
                    disabled={employeesFetching}
                    label="Employee"
                    placeholder="Scroll to see all options"
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
                    currencyCodeProps={{
                      value: 'ILS',
                      label: 'Currency',
                      disabled: true,
                    }}
                  />
                )}
              />
              <Controller
                name="travelAndSubsistence"
                control={control}
                defaultValue={defaultValues?.travelAndSubsistence}
                render={({ field, fieldState }): ReactElement => (
                  <CurrencyInput
                    {...field}
                    value={field.value ?? undefined}
                    error={fieldState.error?.message}
                    label="Travel and Subsistence"
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
                  <ComboBox
                    {...field}
                    data={pensionFunds}
                    value={field.value}
                    disabled={fetchingPensionFunds}
                    label="Pension Fund"
                    placeholder="Scroll to see all options"
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
                    decimalScale={2}
                    suffix="%"
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
                    decimalScale={2}
                    suffix="%"
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
                    decimalScale={2}
                    suffix="%"
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
                  <ComboBox
                    {...field}
                    data={trainingFunds}
                    value={field.value}
                    disabled={fetchingTrainingFunds}
                    label="Training Fund"
                    placeholder="Scroll to see all options"
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
                    decimalScale={2}
                    suffix="%"
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
                    decimalScale={2}
                    suffix="%"
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
                    decimalScale={0}
                    label="Notional Expense"
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
                    decimalScale={2}
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
                  decimalScale={2}
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
                  decimalScale={2}
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
                    decimalScale={2}
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
                    decimalScale={2}
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
                    decimalScale={2}
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
            className="mt-8 text-white bg-indigo-500 border-0 py-2 px-8 focus:outline-hidden hover:bg-indigo-600 rounded-sm text-lg"
            disabled={isModifying || Object.keys(dirtySalaryRecordFields).length === 0}
          >
            Accept
          </button>
          <button
            type="button"
            className="mt-8 text-white bg-rose-500 border-0 py-2 px-8 focus:outline-hidden hover:bg-rose-600 rounded-sm text-lg"
            onClick={() => onDone()}
          >
            Cancel
          </button>
        </div>
      </form>
    </Form>
  );
};
