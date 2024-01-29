import { ReactElement } from 'react';
import { SalariesRecordFieldsFragmentDoc } from '../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../gql/index.js';
import { EditMiniButton } from '../common/index.js';
import { EmployeeCell } from './record-cells/employee.js';
import { FundsCell } from './record-cells/funds.js';
import { InsurancesAndTaxesCell } from './record-cells/insurances-and-taxes.js';
import { MainSalaryCell } from './record-cells/main-salary.js';
import { WorkFrameCell } from './record-cells/work-frame.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment SalariesRecordFields on Salary {
    month
    employee {
      id
    }
    ...SalariesRecordEmployeeFields
    ...SalariesRecordMainSalaryFields
    ...SalariesRecordFundsFields
    ...SalariesRecordInsurancesAndTaxesFields
    ...SalariesRecordWorkFrameFields
  }
`;

interface Props {
  setEditSalaryRecord: () => void;
  data: FragmentType<typeof SalariesRecordFieldsFragmentDoc>;
}

export const SalaryRecord = ({ setEditSalaryRecord, data }: Props): ReactElement => {
  const salaryRecord = getFragmentData(SalariesRecordFieldsFragmentDoc, data);

  return (
    <>
      <tr tabIndex={0} className="h-16 border border-gray-100 hover:bg-gray-100 rounded">
        <EmployeeCell data={salaryRecord} />
        <MainSalaryCell data={salaryRecord} />
        <FundsCell data={salaryRecord} />
        <InsurancesAndTaxesCell data={salaryRecord} />
        <WorkFrameCell data={salaryRecord} />
        <td className="pl-2">
          <div className="flex items-center">
            <div className="flex flex-col">
              <EditMiniButton onClick={setEditSalaryRecord} />
            </div>
          </div>
        </td>
      </tr>
      <tr className="h-3" />
    </>
  );
};
