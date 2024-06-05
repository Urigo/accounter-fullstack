import { Dispatch, ReactElement, SetStateAction, useMemo } from 'react';
import { FragmentOf, graphql, readFragment, ResultOf } from '../../graphql.js';
import { SalariesMonth, SalariesMonthFieldsFragmentDoc } from './salaries-month.js';

export const SalariesTableFieldsFragmentDoc = graphql(
  `
    fragment SalariesTableFields on Salary {
      month
      employee {
        id
      }
      ...SalariesMonthFields
    }
  `,
  [SalariesMonthFieldsFragmentDoc],
);

type SalariesTableFieldsFragment = ResultOf<typeof SalariesTableFieldsFragmentDoc>;

interface Props {
  setEditSalaryRecord: Dispatch<SetStateAction<{ month: string; employeeId: string } | undefined>>;
  setInsertSalaryRecord: Dispatch<SetStateAction<{ month?: string } | undefined>>;
  data?: FragmentOf<typeof SalariesTableFieldsFragmentDoc>[];
}

export const SalariesTable = ({
  setEditSalaryRecord,
  setInsertSalaryRecord,
  data,
}: Props): ReactElement => {
  const monthlySalaries = useMemo(() => {
    const salaryRecords =
      data?.map(salaryRecord => readFragment(SalariesTableFieldsFragmentDoc, salaryRecord)) ?? [];

    const byMonth = new Map<string, SalariesTableFieldsFragment[]>();
    salaryRecords.map(salary => {
      const { month } = salary;
      const salaries = byMonth.get(month) ?? [];
      byMonth.set(month, [...salaries, salary]);
    });
    return byMonth;
  }, [data]);

  return (
    <div className="sm:px-6 w-full">
      <div className="bg-white py-4 md:py-7 px-4 md:px-8 xl:px-10">
        <div className="sm:flex items-center justify-between">
          <div className="flex items-center">
            <div className="rounded-full focus:outline-none focus:ring-2  focus:bg-indigo-50 focus:ring-indigo-800">
              <div className="py-2 px-8 bg-indigo-100 text-indigo-700 rounded-full">
                <p>All</p>
              </div>
            </div>
            <div className="rounded-full focus:outline-none focus:ring-2 focus:bg-indigo-50 focus:ring-indigo-800 ml-4 sm:ml-8">
              <div className="py-2 px-8 text-gray-600 hover:text-indigo-700 hover:bg-indigo-100 rounded-full ">
                <p>Done</p>
              </div>
            </div>
            <div className="rounded-full focus:outline-none focus:ring-2 focus:bg-indigo-50 focus:ring-indigo-800 ml-4 sm:ml-8">
              <div className="py-2 px-8 text-gray-600 hover:text-indigo-700 hover:bg-indigo-100 rounded-full ">
                <p>Pending</p>
              </div>
            </div>
          </div>
          <button className="focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 mt-4 sm:mt-0 inline-flex items-start justify-start px-6 py-3 bg-indigo-700 hover:bg-indigo-600 focus:outline-none rounded">
            <p className="text-sm font-medium leading-none text-white">Add Task</p>
          </button>
        </div>
        <div className="mt-7 overflow-x-auto">
          <table className="w-full whitespace-nowrap">
            <tbody>
              {Array.from(monthlySalaries).map(([month, salaries]) => (
                <SalariesMonth
                  key={month}
                  data={salaries}
                  setEditSalaryRecord={(employeeId?: string) =>
                    setEditSalaryRecord(employeeId ? { month, employeeId } : undefined)
                  }
                  setInsertSalaryRecord={() => setInsertSalaryRecord({ month })}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
