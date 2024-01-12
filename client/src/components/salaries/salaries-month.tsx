import { ReactElement } from 'react';
import { SalariesMonthFieldsFragmentDoc } from '../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../gql/index.js';
import { MonthTitleRow } from './record-cells/month-title.js';
import { SalaryRecord } from './salary-record.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment SalariesMonthFields on Salary {
    month
    employee {
      id
    }
    ...SalariesRecordFields
  }
`;

interface Props {
  setEditSalaryRecord: (employeeId?: string) => void;
  setInsertSalaryRecord: () => void;
  data?: FragmentType<typeof SalariesMonthFieldsFragmentDoc>[];
}

export const SalariesMonth = ({
  setEditSalaryRecord,
  setInsertSalaryRecord,
  data,
}: Props): ReactElement => {
  const salaryRecords =
    data?.map(salaryRecord => getFragmentData(SalariesMonthFieldsFragmentDoc, salaryRecord)) ?? [];

  return (
    <>
      <tr className="h-3" />
      <MonthTitleRow month={salaryRecords[0].month} setInsertSalaryRecord={setInsertSalaryRecord} />
      <tr className="h-3" />
      {salaryRecords.map(record => (
        <SalaryRecord
          key={`${record.month} ${record.employee?.id}`}
          data={record}
          setEditSalaryRecord={() => setEditSalaryRecord(record.employee?.id)}
        />
      ))}
    </>
  );
};
