import { ReactElement } from 'react';
import { FragmentOf, graphql, readFragment } from '../../graphql.js';
import { EditMiniButton } from '../common/index.js';
import {
  EmployeeCell,
  FundsCell,
  InsurancesAndTaxesCell,
  MainSalaryCell,
  SalariesRecordEmployeeFieldsFragmentDoc,
  SalariesRecordFundsFieldsFragmentDoc,
  SalariesRecordInsurancesAndTaxesFieldsFragmentDoc,
  SalariesRecordMainSalaryFieldsFragmentDoc,
  SalariesRecordWorkFrameFieldsFragmentDoc,
  WorkFrameCell,
} from './record-cells/index.js';

export const SalariesRecordFieldsFragmentDoc = graphql(
  `
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
  `,
  [
    SalariesRecordEmployeeFieldsFragmentDoc,
    SalariesRecordMainSalaryFieldsFragmentDoc,
    SalariesRecordFundsFieldsFragmentDoc,
    SalariesRecordInsurancesAndTaxesFieldsFragmentDoc,
    SalariesRecordWorkFrameFieldsFragmentDoc,
  ],
);

interface Props {
  setEditSalaryRecord: () => void;
  data: FragmentOf<typeof SalariesRecordFieldsFragmentDoc>;
}

export const SalaryRecord = ({ setEditSalaryRecord, data }: Props): ReactElement => {
  const salaryRecord = readFragment(SalariesRecordFieldsFragmentDoc, data);

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
