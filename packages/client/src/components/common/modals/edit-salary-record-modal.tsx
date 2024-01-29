import { ReactElement, useCallback } from 'react';
import { format } from 'date-fns';
import { useQuery } from 'urql';
import { Loader } from '@mantine/core';
import { ModifySalaryRecord, PopUpDrawer } from '..';
import { EditSalaryRecordDocument, SalaryRecordInput } from '../../../gql/graphql.js';
import { TimelessDateString } from '../../../helpers';
import { useUpdateSalaryRecord } from '../../../hooks/use-update-salary-record.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  query EditSalaryRecord($month: TimelessDate!, $employeeIDs: [UUID!]!) {
    salaryRecordsByDates(fromDate: $month, toDate: $month, employeeIDs: $employeeIDs) {
      month
      charge {
        id
      }
      directAmount {
        raw
      }
      baseAmount {
        raw
      }
      employee {
        id
        name
      }
      employer {
        id
        name
      }
      pensionFund {
        id
        name
      }
      pensionEmployeeAmount {
        raw
      }
      pensionEmployeePercentage
      pensionEmployerAmount {
        raw
      }
      pensionEmployerPercentage
      compensationsAmount {
        raw
      }
      compensationsPercentage
      trainingFund {
        id
        name
      }
      trainingFundEmployeeAmount {
        raw
      }
      trainingFundEmployeePercentage
      trainingFundEmployerAmount {
        raw
      }
      trainingFundEmployerPercentage
      socialSecurityEmployeeAmount {
        raw
      }
      socialSecurityEmployerAmount {
        raw
      }
      incomeTaxAmount {
        raw
      }
      healthInsuranceAmount {
        raw
      }
      globalAdditionalHoursAmount {
        raw
      }
      bonus {
        raw
      }
      gift {
        raw
      }
      recovery {
        raw
      }
      notionalExpense {
        raw
      }
      vacationDays {
        added
        balance
      }
      vacationTakeout {
        raw
      }
      workDays
      sicknessDays {
        balance
      }
    }
  }
`;

interface Props {
  recordVariables?: {
    employeeId: string;
    month: string;
  };
  onDone: () => void;
}

export const EditSalaryRecordModal = ({ recordVariables, onDone }: Props): ReactElement | null => {
  return recordVariables ? (
    <EditSalaryRecordModalContent recordVariables={recordVariables} onDone={onDone} />
  ) : null;
};

export const EditSalaryRecordModalContent = ({
  recordVariables,
  onDone,
}: Omit<Props, 'recordVariables'> & {
  recordVariables: {
    employeeId: string;
    month: string;
  };
}): ReactElement => {
  const { updateSalaryRecord, fetching } = useUpdateSalaryRecord();
  const [{ data: salaryRecordData, fetching: fetchingSalaryRecord }] = useQuery({
    query: EditSalaryRecordDocument,
    variables: {
      employeeIDs: [recordVariables.employeeId],
      month: format(new Date(recordVariables.month), 'yyyy-MM-dd') as TimelessDateString,
    },
  });

  const salaryRecord = salaryRecordData?.salaryRecordsByDates?.[0];

  const doUpdate = useCallback(
    (salaryRecord?: SalaryRecordInput) => {
      onDone();
      if (salaryRecord) {
        updateSalaryRecord({
          salaryRecord,
        });
      }
    },
    [onDone, updateSalaryRecord],
  );

  if (!salaryRecord) {
    // eslint-disable-next-line react/jsx-no-useless-fragment
    return <></>;
  }

  const defaultValues = {
    addedVacationDays: salaryRecord?.vacationDays?.added,
    baseSalary: salaryRecord?.baseAmount?.raw,
    bonus: salaryRecord?.bonus?.raw,
    chargeId: salaryRecord?.charge?.id,
    compensationsEmployerAmount: salaryRecord?.compensationsAmount?.raw,
    compensationsEmployerPercentage: salaryRecord?.compensationsPercentage,
    directPaymentAmount: salaryRecord?.directAmount?.raw,
    employer: salaryRecord?.employer?.id,
    employeeId: salaryRecord?.employee?.id,
    gift: salaryRecord?.gift?.raw,
    globalAdditionalHours: salaryRecord?.globalAdditionalHoursAmount?.raw,
    healthPaymentAmount: salaryRecord?.healthInsuranceAmount?.raw,
    // hourlyRate: salaryRecord?.,
    // hours: salaryRecord?.,
    month: salaryRecord?.month,
    pensionEmployeeAmount: salaryRecord?.pensionEmployeeAmount?.raw,
    pensionEmployeePercentage: salaryRecord?.pensionEmployeePercentage,
    pensionEmployerAmount: salaryRecord?.pensionEmployerAmount?.raw,
    pensionEmployerPercentage: salaryRecord?.pensionEmployerPercentage,
    pensionFundId: salaryRecord?.pensionFund?.id,
    recovery: salaryRecord?.recovery?.raw,
    sicknessDaysBalance: salaryRecord?.sicknessDays?.balance,
    socialSecurityAmountEmployee: salaryRecord?.socialSecurityEmployeeAmount?.raw,
    socialSecurityAmountEmployer: salaryRecord?.socialSecurityEmployerAmount?.raw,
    taxAmount: salaryRecord?.incomeTaxAmount?.raw,
    trainingFundEmployeeAmount: salaryRecord?.trainingFundEmployeeAmount?.raw,
    trainingFundEmployeePercentage: salaryRecord?.trainingFundEmployeePercentage,
    trainingFundEmployerAmount: salaryRecord?.trainingFundEmployerAmount?.raw,
    trainingFundEmployerPercentage: salaryRecord?.trainingFundEmployerPercentage,
    trainingFundId: salaryRecord?.trainingFund?.id,
    vacationDaysBalance: salaryRecord?.vacationDays?.balance,
    vacationTakeout: salaryRecord?.vacationTakeout?.raw,
    workDays: salaryRecord?.workDays,
    zkufot: salaryRecord?.notionalExpense?.raw,
  };

  return (
    <PopUpDrawer
      modalSize="fit-content"
      position="bottom"
      title={
        <div className="flex flex-row mx-3 pt-3 sm:text-1xl gap-10">
          <h1 className="sm:text-2xl font-small text-gray-900">Edit Salary Record:</h1>
          <div className="flex flex-row gap-2">
            month: {recordVariables.month} employeeId: {recordVariables.employeeId}
          </div>
        </div>
      }
      opened={!!recordVariables}
      onClose={onDone}
    >
      {fetchingSalaryRecord || !salaryRecord ? (
        <Loader className="flex self-center my-5" color="dark" size="xl" variant="dots" />
      ) : (
        <ModifySalaryRecord
          isNewInsert={false}
          defaultValues={defaultValues}
          onDone={doUpdate}
          isModifying={fetching}
        />
      )}
    </PopUpDrawer>
  );
};
