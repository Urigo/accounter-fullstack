import { ReactElement } from 'react';
import { TableSalariesFieldsFragmentDoc } from '../../../gql/graphql.js';
import { FragmentType, getFragmentData } from '../../../gql/index.js';

// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- used by codegen
/* GraphQL */ `
  fragment TableSalariesFields on SalaryCharge {
    id
    salaryRecords {
      directAmount {
        formatted
      }
      baseAmount {
        formatted
      }
			employee {
        name
      }
      pensionFund {
        id
        name
      }
      pensionEmployeeAmount {
        formatted
      }
      pensionEmployerAmount {
        formatted
      }
      compensationsAmount {
        formatted
      }
      trainingFund {
        id
        name
      }
      trainingFundEmployeeAmount {
        formatted
      }
      trainingFundEmployerAmount {
        formatted
      }
      socialSecurityEmployeeAmount {
        formatted
      }
      socialSecurityEmployerAmount {
        formatted
      }
      incomeTaxAmount {
        formatted
      }
      healthInsuranceAmount {
        formatted
      }
    }
  }
`;

type Props = {
  salaryRecordsProps: FragmentType<typeof TableSalariesFieldsFragmentDoc>;
};

export const SalariesTable = ({ salaryRecordsProps }: Props): ReactElement => {
  const { salaryRecords } = getFragmentData(TableSalariesFieldsFragmentDoc, salaryRecordsProps);
  return (
    <table className="w-full h-full">
      <thead>
        <tr>
          <th>Employee</th>
          <th>Direct Salary</th>
          <th>Base Salary</th>
          <th>Pension</th>
          <th>Training Fund</th>
          <th>Social Security</th>
          <th>Tax</th>
        </tr>
      </thead>
      <tbody>
        {salaryRecords.map(record => (
          <tr key={`${record.employee?.name}-${record.baseAmount}`}>
            <td>
              <div>{record.employee?.name ?? 'Missing'}</div>
            </td>
            <td>
              <div>{record.directAmount.formatted}</div>
            </td>
            <td>
              <div>{record.baseAmount?.formatted}</div>
            </td>
            <td>
              <div>{record.pensionFund?.name}</div>
              <div>Employee: {record.pensionEmployeeAmount?.formatted}</div>
              <div>Employer: {record.pensionEmployerAmount?.formatted}</div>
              <div>Compensation: {record.compensationsAmount?.formatted}</div>
            </td>
            <td>
              <div>{record.trainingFund?.name}</div>
              <div>Employee: {record.trainingFundEmployeeAmount?.formatted}</div>
              <div>Employer: {record.trainingFundEmployerAmount?.formatted}</div>
            </td>
            <td>
              <div>Employee: {record.socialSecurityEmployeeAmount?.formatted}</div>
              <div>Employer: {record.socialSecurityEmployerAmount?.formatted}</div>
              <div>Health: {record.healthInsuranceAmount?.formatted}</div>
            </td>
            <td>
              <div>{record.incomeTaxAmount?.formatted}</div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
