import { ReactElement } from 'react';
import { format } from 'date-fns';
import { FragmentOf, graphql, readFragment } from '../../../graphql.js';

export const SalariesRecordEmployeeFieldsFragmentDoc = graphql(`
  fragment SalariesRecordEmployeeFields on Salary {
    month
    employee {
      id
      name
    }
  }
`);

interface Props {
  data: FragmentOf<typeof SalariesRecordEmployeeFieldsFragmentDoc>;
}

export const EmployeeCell = ({ data }: Props): ReactElement => {
  const { employee, month } = readFragment(SalariesRecordEmployeeFieldsFragmentDoc, data);
  const formattedMonth = format(new Date(month), 'MMMM yyyy');

  return (
    <td className="">
      <div className="flex items-center pl-5">
        <div className="flex flex-col">
          <p className="text-base font-bold text-gray-800">{employee?.name}</p>
          <p className="text-base font-medium text-gray-800">{formattedMonth}</p>
        </div>
      </div>
    </td>
  );
};
