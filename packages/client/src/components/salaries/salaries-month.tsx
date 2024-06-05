import { ReactElement } from 'react';
import { FragmentOf, graphql, readFragment } from '../../graphql.js';
import { MonthTitleRow } from './record-cells/index.js';
import { SalariesRecordFieldsFragmentDoc, SalaryRecord } from './salary-record.js';

export const SalariesMonthFieldsFragmentDoc = graphql(
  `
    fragment SalariesMonthFields on Salary {
      month
      employee {
        id
      }
      ...SalariesRecordFields
    }
  `,
  [SalariesRecordFieldsFragmentDoc],
);

interface Props {
  setEditSalaryRecord: (employeeId?: string) => void;
  setInsertSalaryRecord: () => void;
  data?: FragmentOf<typeof SalariesMonthFieldsFragmentDoc>[];
}

export const SalariesMonth = ({
  setEditSalaryRecord,
  setInsertSalaryRecord,
  data,
}: Props): ReactElement => {
  const salaryRecords =
    data?.map(salaryRecord => readFragment(SalariesMonthFieldsFragmentDoc, salaryRecord)) ?? [];

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
